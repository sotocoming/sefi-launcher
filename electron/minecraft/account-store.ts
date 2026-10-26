import { app, safeStorage } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import type { Account } from '../../src/types';
import { atomicWrite } from './atomic-files';

let operations: Promise<unknown> = Promise.resolve();
let migration: Promise<unknown> | undefined;
const protectedKeys = ['communityToken','accessToken'] as const;
type ProtectedAccount = Account & {protectedTokens?: Partial<Record<typeof protectedKeys[number], string>>};
function file(): string { return path.join(app.getPath('userData'),'accounts.json'); }
function validate(value: unknown): Account[] {
  if (!Array.isArray(value) || value.some(a => !a || typeof a.id !== 'string' || typeof a.username !== 'string' || typeof a.uuid !== 'string' || !['offline','microsoft'].includes(a.type))) throw new Error('Некорректный файл аккаунтов.');
  if (new Set(value.map(a => a.id)).size !== value.length) throw new Error('Повторяющиеся записи аккаунтов.');
  if(value.some(a=>a.protectedTokens!==undefined && (!a.protectedTokens || typeof a.protectedTokens!=='object' || Array.isArray(a.protectedTokens)
    || Object.entries(a.protectedTokens).some(([key,token])=>!protectedKeys.includes(key as typeof protectedKeys[number]) || typeof token!=='string' || token.length>65536 || !/^dpapi:[A-Za-z0-9+/]+={0,2}$/.test(token))))){
    throw new Error('Некорректный файл аккаунтов.');
  }
  return value;
}
function decode(value: Account[]): Account[] {
  return value.map(a => {
    const result: ProtectedAccount = {...a};
    for(const key of protectedKeys){
      const stored = (a as ProtectedAccount).protectedTokens?.[key];
      if(!stored)continue;
      // Preserve opaque ciphertext for future saves, but never use it as a bearer token.
      result[key] = '';
      try{if(stored.startsWith('dpapi:'))result[key]=safeStorage.decryptString(Buffer.from(stored.slice(6),'base64'));}catch{}
    }
    if(a.msRefreshToken?.startsWith('dpapi:')){
      try{result.msRefreshToken=safeStorage.decryptString(Buffer.from(a.msRefreshToken.slice(6),'base64'));}catch{}
    }
    return result;
  });
}
function encode(value: Account[]): Account[] {
  return value.map(a => {
    const result: ProtectedAccount = {...a,accessToken:'',communityToken:undefined,protectedTokens:{}};
    const protect = (secret:string) => {
      if(!safeStorage.isEncryptionAvailable())throw new Error('Система не позволяет безопасно сохранить вход. Проверьте доступ к профилю Windows и повторите попытку.');
      return 'dpapi:'+safeStorage.encryptString(secret).toString('base64');
    };
    for(const key of protectedKeys){
      const prior=(a as ProtectedAccount).protectedTokens?.[key];
      if(a[key])result.protectedTokens![key]=protect(a[key]!);
      else if(prior)result.protectedTokens![key]=prior;
    }
    if(a.msRefreshToken&&!a.msRefreshToken.startsWith('dpapi:'))result.msRefreshToken=protect(a.msRefreshToken);
    return result;
  });
}
async function read(): Promise<Account[]> {
  let missing = false;
  try { return decode(validate(JSON.parse(await fs.readFile(file(),'utf8')))); }
  catch(error: any) {
    missing = error.code === 'ENOENT';
    if (!missing && !(error instanceof SyntaxError) && error.message !== 'Некорректный файл аккаунтов.' && error.message !== 'Повторяющиеся записи аккаунтов.') throw new Error('Не удалось прочитать аккаунты. Проверьте доступ к папке лаунчера.');
  }
  try {
    const backup = decode(validate(JSON.parse(await fs.readFile(file()+'.bak','utf8'))));
    console.warn('[Accounts] recovered from backup'); return backup;
  } catch(error: any) {
    if (missing && error.code === 'ENOENT') return [];
    throw new Error('Файл аккаунтов повреждён, резервную копию прочитать не удалось. Файлы сохранены; обратитесь к администратору.');
  }
}
export async function readAccounts(): Promise<Account[]> {
  await operations;
  const accounts=await read();
  let legacyBackup=false;
  try{
    const backup=validate(JSON.parse(await fs.readFile(file()+'.bak','utf8')));
    legacyBackup=backup.some(a=>protectedKeys.some(key=>!!a[key]));
  }catch{/* An invalid backup is preserved until a valid main file can replace it. */}
  if(legacyBackup || accounts.some(a=>protectedKeys.some(key=>a[key]&&!(a as ProtectedAccount).protectedTokens?.[key]))){
    // Migrate legacy plaintext and its valid backup through the same serialized writer.
    if(!migration)migration=updateAccounts(()=>{}).finally(()=>{migration=undefined;});
    await migration;
    return readAccounts();
  }
  return accounts;
}
export function updateAccounts<T>(change: (accounts: Account[]) => T): Promise<T> {
  const task = operations.then(async () => {
    const accounts = await read();
    const result = change(accounts);
    validate(accounts);
    const encoded = JSON.stringify(encode(accounts),null,2);
    // Backup only a valid prior document; a corrupt file must never replace a good backup.
    let prior: string | undefined;
    try { prior=await fs.readFile(file(),'utf8'); prior=JSON.stringify(encode(decode(validate(JSON.parse(prior)))),null,2); } catch { prior=undefined; }
    if (prior !== undefined) await atomicWrite(file()+'.bak',prior);
    await atomicWrite(file(),encoded);
    return result;
  });
  operations=task.catch(() => {});
  return task;
}
export function publicAccount(account: Account | null): Account | null {
  if (!account) return null;
  const {msRefreshToken:_secret, communityToken:_communitySecret, protectedTokens:_vault, ...visible}=account as ProtectedAccount;
  return {...visible,communityConnected:!!account.communityToken,accessToken:'',clientToken:''};
}
