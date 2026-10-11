import type { Account } from '../../src/types';
import { readAccounts, updateAccounts } from './account-store';
import { MicrosoftSessionError, renewMicrosoftSession, tokenExpiry, validateMinecraftToken } from './microsoft-session';

const pending=new Map<string,Promise<Account>>();
const WINDOW=30*60*1000;
const uuid=(value:string)=>value.replace(/-/g,'').toLowerCase();
export function ensureMicrosoftAccount(id: string, checkSession=false): Promise<Account> {
  const existing=pending.get(id); if(existing)return existing;
  const task=ensure(id,checkSession).finally(()=>pending.delete(id)); pending.set(id,task); return task;
}
async function ensure(id: string, checkSession: boolean): Promise<Account> {
  const account=(await readAccounts()).find(a=>a.id===id);
  if(!account || account.type!=='microsoft') throw new Error('Аккаунт Microsoft удалён или изменён. Выберите профиль заново.');
  let expiry=account.msAccessTokenExpiresAt || tokenExpiry(account.accessToken);
  if(account.accessToken && expiry && expiry>Date.now()+WINDOW) {
    if(!checkSession)return account;
    try {
      const profile=await validateMinecraftToken(account.accessToken);
      if(uuid(profile.id)!==uuid(account.uuid))throw new MicrosoftSessionError('Игровая сессия относится к другому профилю. Повторите вход Microsoft.','auth');
      return account;
    } catch(error) {
      if(!(error instanceof MicrosoftSessionError))throw error;
      if(['network','service','rate-limit'].includes(error.kind))return account;
      if(![401,403].includes(error.status || 0))throw error;
      // The token can be revoked before expires_in; renew it once before spawning Minecraft.
    }
  }
  if(!account.msRefreshToken || account.msRefreshToken.startsWith('dpapi:')) {
    if(account.accessToken && (!expiry || expiry>Date.now())) {
      const profile=await validateMinecraftToken(account.accessToken);
      if(uuid(profile.id)!==uuid(account.uuid))throw new MicrosoftSessionError('Игровая сессия относится к другому профилю. Повторите вход Microsoft.','auth');
      return account;
    }
    throw new MicrosoftSessionError('Старый лаунчер не сохранил продление Microsoft. Один раз войдите в этот аккаунт заново; следующие продления будут автоматическими.','auth');
  }
  let expectedRefresh=account.msRefreshToken;
  try {
    const clientId=account.msClientId || new (require('msmc').Auth)('none').token.client_id;
    const session=await renewMicrosoftSession(expectedRefresh,clientId,async next=>{
      await updateAccounts(accounts=>{
        const current=accounts.find(a=>a.id===id);
        if(!current || current.msRefreshToken!==expectedRefresh)throw new Error('Аккаунт изменился во время продления. Повторите запуск.');
        current.msRefreshToken=next; current.msClientId=clientId;
      });
      expectedRefresh=next;
    });
    if(uuid(session.profile.id)!==uuid(account.uuid))throw new MicrosoftSessionError('Microsoft вернул другой Minecraft-профиль. Повторите вход в нужный аккаунт.','auth');
    return await updateAccounts(accounts=>{
      const current=accounts.find(a=>a.id===id);
      if(!current || current.msRefreshToken!==expectedRefresh)throw new Error('Аккаунт изменился во время продления. Повторите запуск.');
      current.accessToken=session.accessToken;current.msAccessTokenExpiresAt=session.expiresAt;current.username=session.profile.name;
      return {...current};
    });
  } catch(error) {
    // A service outage must not log out a still-valid session or erase its renewal key.
    if(error instanceof MicrosoftSessionError && ['network','service','rate-limit'].includes(error.kind) && expiry && expiry>Date.now()+60000) {
      console.warn('[Microsoft auth] refresh postponed; cached game session remains valid');
      const current=(await readAccounts()).find(a=>a.id===id);
      if(!current)throw new Error('Аккаунт удалён во время продления. Выберите профиль заново.');
      return current;
    }
    throw error;
  }
}
