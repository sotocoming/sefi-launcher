import { app, safeStorage } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import type { Account } from '../../src/types';
import { atomicWrite } from './atomic-files';

let operations: Promise<unknown> = Promise.resolve();
function file(): string { return path.join(app.getPath('userData'),'accounts.json'); }
function validate(value: unknown): Account[] {
  if (!Array.isArray(value) || value.some(a => !a || typeof a.id !== 'string' || typeof a.username !== 'string' || typeof a.uuid !== 'string' || !['offline','microsoft'].includes(a.type))) throw new Error('Некорректный файл аккаунтов.');
  if (new Set(value.map(a => a.id)).size !== value.length) throw new Error('Повторяющиеся записи аккаунтов.');
  return value;
}
function decode(value: Account[]): Account[] {
  return value.map(a => {
    if (!a.msRefreshToken?.startsWith('dpapi:')) return {...a};
    try { return {...a, msRefreshToken:safeStorage.decryptString(Buffer.from(a.msRefreshToken.slice(6),'base64'))}; }
    catch { return {...a}; } // Access token survives; one-time sign-in is requested if it expires.
  });
}
function encode(value: Account[]): Account[] {
  return value.map(a => {
    if (!a.msRefreshToken || a.msRefreshToken.startsWith('dpapi:')) return {...a};
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Система не позволяет безопасно сохранить продление Microsoft. Проверьте доступ к профилю Windows и повторите вход.');
    return {...a,msRefreshToken:'dpapi:'+safeStorage.encryptString(a.msRefreshToken).toString('base64')};
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
export async function readAccounts(): Promise<Account[]> { await operations; return read(); }
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
  const {msRefreshToken:_secret, communityToken:_communitySecret, ...visible}=account;
  return {...visible,communityConnected:!!account.communityToken,accessToken:'',clientToken:''};
}
