import { communityBrowserCode } from './community-browser';
import { microsoftCodeSession, MicrosoftSessionError, microsoftFailure } from './microsoft-session';
import { randomUUID, randomBytes, createHash } from 'crypto';
import type { Account } from '../../src/types';
import { readAccounts, updateAccounts } from './account-store';
import { ensureMicrosoftAccount } from './account-session';
import { communityRequest } from './community-request';

export const getAccounts = readAccounts;

export async function addOfflineAccount(username: string): Promise<Account> {
  const cleanName = (username || '').trim();
  if (!cleanName) {
    throw new Error('Никнейм не может быть пустым');
  }
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(cleanName)) {
    throw new Error('Никнейм должен состоять из латинских букв, цифр и знака _ (от 3 до 16 символов)');
  }

  const newAccount: Account = {
    id: randomUUID(),
    username: cleanName,
    uuid: randomUUID(),
    accessToken: randomUUID(),
    clientToken: randomUUID(),
    type: 'offline',
    active: true,
  };

  await updateAccounts(accounts=>{accounts.forEach(a=>a.active=false);accounts.push(newAccount);});
  return newAccount;
}

export async function loginMicrosoft(): Promise<Account> {
  // Use msmc with electron modal window
  const msmc = require('msmc');
  const authManager = new msmc.Auth('select_account');

  // Bind the desktop callback to this window and this attempt.
  const { BrowserWindow } = require('electron');
  const state = randomBytes(32).toString('base64url');
  const authUrl = new URL(authManager.createLink());
  authUrl.searchParams.set('state', state);
  const redirect = new URL(authManager.token.redirect);
  const code = await new Promise<string>((resolve, reject) => {
    const win = new BrowserWindow({ width: 500, height: 650, resizable: false,
      title: 'Авторизация Microsoft / Minecraft', autoHideMenuBar: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
    });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    let done = false;
    const finish = (value?: string, message?: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (!win.isDestroyed()) win.close();
      if (value) resolve(value); else reject(new Error(message || 'Вход Microsoft отменён.'));
    };
    const timer = setTimeout(() => finish(undefined, 'Время входа Microsoft истекло.'), 10 * 60 * 1000);
    const check = (event: any, target: string) => {
      let url: URL;
      try { url = new URL(target); } catch { return; }
      if (url.origin !== redirect.origin || url.pathname !== redirect.pathname) return;
      event.preventDefault();
      if (url.searchParams.get('state') !== state) return finish(undefined, 'Подтверждение Microsoft не соответствует этому входу.');
      const code = url.searchParams.get('code');
      finish(code || undefined);
    };
    win.webContents.on('will-navigate', check);
    win.webContents.on('will-redirect', check);
    win.on('closed', () => finish());
    void win.loadURL(authUrl.toString()).catch(() => finish(undefined, 'Страница Microsoft недоступна.'));
  });
  try {
    const token = await microsoftCodeSession(code, authManager.token);
    const profile = token.profile;
    const accounts = await getAccounts();

    const newAccount: Account = {
      id: profile.id || randomUUID(),
      username: profile.name,
      uuid: profile.id,
      accessToken: token.accessToken,
      msRefreshToken: token.refreshToken,
      msAccessTokenExpiresAt: token.expiresAt,
      msClientId: authManager.token.client_id,
      clientToken: randomUUID(),
      type: 'microsoft',
      skinUrl: `https://mc-heads.net/avatar/${profile.id || profile.name}/64`,
      active: true,
    };

    const existingComm = accounts.find((a) => a.communityToken);

    accounts.forEach((a) => (a.active = false));
    const existingIdx = accounts.findIndex((a) => a.uuid === newAccount.uuid);
    if (existingIdx !== -1) {
      // Preserve any previously bound community data
      newAccount.twitchLogin = accounts[existingIdx].twitchLogin || existingComm?.twitchLogin;
      newAccount.twitchAvatar = accounts[existingIdx].twitchAvatar || existingComm?.twitchAvatar;
      newAccount.whitelistStatus = accounts[existingIdx].whitelistStatus || existingComm?.whitelistStatus;
      newAccount.communityToken = accounts[existingIdx].communityToken || existingComm?.communityToken;
      accounts[existingIdx] = newAccount;
    } else {
      if (existingComm) {
        newAccount.twitchLogin = existingComm.twitchLogin;
        newAccount.twitchAvatar = existingComm.twitchAvatar;
        newAccount.whitelistStatus = existingComm.whitelistStatus;
        newAccount.communityToken = existingComm.communityToken;
      }
      accounts.push(newAccount);
    }

    // A local Twitch session is not proof of a completed Minecraft binding.
    newAccount.mcType = 'offline';
    newAccount.mcUuid = undefined;
    newAccount.mcVerifiedAt = 0;
    if (newAccount.communityToken) {
      try {
        const resData = await communityRequest('/api/public/community/launcher/minecraft/auto-link',newAccount.communityToken,{minecraft_access_token:newAccount.accessToken},false,60000);
        const user = resData?.user;
        if (!user?.mc_verified_at || user.mc_type !== 'microsoft' || typeof user.mc_uuid !== 'string'
          || user.mc_uuid.replace(/-/g, '').toLowerCase() !== newAccount.uuid.replace(/-/g, '').toLowerCase()) {
          throw new Error('Сервер не подтвердил привязку этого Minecraft-профиля.');
        }
        newAccount.mcType = 'microsoft';
        newAccount.mcUuid = user.mc_uuid;
        newAccount.mcVerifiedAt = user.mc_verified_at;
        newAccount.whitelistStatus = user.whitelist_status;
      } catch (error) {
        newAccount.communityLinkError = 'Вход Microsoft выполнен, но привязка к Twitch не завершена. '
          + (error instanceof Error ? error.message : 'Повторите привязку.');
      }
    }

    // Keep the standard profile until the backend confirms the new identity.

    await updateAccounts(latest=>{
      const previous=latest.find(a=>a.id===newAccount.id || a.uuid===newAccount.uuid);
      const merged={...previous,...newAccount};
      const remaining=latest.filter(a=>a.id!==merged.id && a.uuid!==merged.uuid && !(merged.mcVerifiedAt && a.type==='offline' && a.communityToken===merged.communityToken));
      remaining.forEach(a=>a.active=false);latest.splice(0,latest.length,...remaining,merged);
    });
    return newAccount;
  } catch (err: any) {
    if (err instanceof MicrosoftSessionError) throw err;
    if(err instanceof Error)throw err;
    throw microsoftFailure(err, 'Microsoft / Xbox login');
  }
}

const linkGrants = new Map<string, { code: string; token: string; expiresAt: number }>();
let linkingMinecraft = false;

function offlineUuid(username: string): string {
  const bytes = createHash('md5').update('OfflinePlayer:' + username, 'utf8').digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x30;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytes.toString('hex');
}

export async function loginCommunity(fresh = false): Promise<Account> {
  const authSessionId = randomUUID();
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const code = await communityBrowserCode(authSessionId, challenge, fresh);
  const data = await communityRequest('/api/public/community/auth/exchange',undefined,{code,code_verifier:verifier},false,20000) as {token?:string;user?:any;minecraft_link_grant?:string};
  if(!data.token || !data.user)throw new Error('Не удалось подтвердить вход SEFI.');
    const user = data.user;
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(user.mc_nickname || '')) throw new Error('Игровой профиль требует проверки администратором');
    const newAccount: Account = {
      id: `comm_${user.id}`, username: user.mc_nickname,
      uuid: offlineUuid(user.mc_nickname), accessToken: randomUUID(), clientToken: randomUUID(),
      // A website binding is not a Microsoft session and cannot supply its game token.
      type: 'offline', active: true, communityToken: data.token,
      whitelistStatus: user.whitelist_status || 'pending',
      twitchLogin: user.twitch_login, twitchAvatar: user.twitch_avatar,
      mcType: user.mc_verified_at && user.mc_uuid && user.mc_type === 'microsoft' ? 'microsoft' : 'offline',
      mcUuid: user.mc_verified_at ? user.mc_uuid : undefined,
      mcVerifiedAt: user.mc_verified_at || 0,
    };
    await updateAccounts(latest=>{
      latest.forEach(account=>{account.active=false;});
      const index=latest.findIndex(account=>account.id===newAccount.id);
      if(index>=0)latest[index]={...latest[index],...newAccount};else latest.push(newAccount);
    });
    const resolved = newAccount.mcType === 'microsoft' ? await refreshCommunityProfile(data.token) : null;
    const result = resolved || newAccount;
    if (data.minecraft_link_grant) linkGrants.set(result.id, {
      code: data.minecraft_link_grant, token: data.token, expiresAt: Date.now() + 8 * 60 * 1000,
    });
    return result;
}

export async function refreshCommunityProfile(token: string): Promise<Account | null> {
  try {
    const profData = await communityRequest('/api/public/community/me', token) as {user?:any};
    const user = profData?.user;
    if (!user) return null;

    return await updateAccounts(accounts=>{
    if (!accounts.some(account => account.communityToken === token)) return null;
    // Check if there is an associated Microsoft account
    const msIdx = accounts.findIndex(a => a.type === 'microsoft' && user.mc_verified_at && user.mc_uuid
      && a.uuid.replace(/-/g, '').toLowerCase() === user.mc_uuid.replace(/-/g, '').toLowerCase());
    if (msIdx !== -1 && user.mc_type === 'microsoft') {
      const transferSelection = accounts.some(a => a.active && a.type === 'offline'
        && (a.id === `comm_${user.id}` || a.twitchLogin === user.twitch_login));
      if (transferSelection) accounts.forEach(a => { a.active = a.id === accounts[msIdx].id; });
      accounts[msIdx].mcType = 'microsoft';
      accounts[msIdx].mcUuid = user.mc_uuid;
      accounts[msIdx].mcVerifiedAt = user.mc_verified_at;
      delete accounts[msIdx].communityLinkError;
      accounts[msIdx].whitelistStatus = user.whitelist_status;
      accounts[msIdx].twitchLogin = user.twitch_login;
      accounts[msIdx].twitchAvatar = user.twitch_avatar;
      accounts[msIdx].communityToken = token;
      if (user.mc_nickname) accounts[msIdx].username = user.mc_nickname;
      const cleaned = accounts.filter(a => a.id === accounts[msIdx].id || !(a.type === 'offline' && (a.id === `comm_${user.id}` || a.twitchLogin === user.twitch_login)));
      const selected=accounts[msIdx];
      accounts.splice(0,accounts.length,...cleaned);
      return selected;
    }

    for (const account of accounts) {
      if (account.type === 'microsoft' && account.communityToken === token) {
        account.mcType = user.mc_verified_at && user.mc_uuid && user.mc_type === 'microsoft' ? 'microsoft' : 'offline';
        account.mcUuid = user.mc_verified_at ? user.mc_uuid : undefined;
        account.mcVerifiedAt = user.mc_verified_at || 0;
        account.whitelistStatus = user.whitelist_status;
      }
    }


    const idx = accounts.findIndex((a) => a.type === 'offline' && (a.communityToken === token || a.id === `comm_${user.id}`));
    if (idx !== -1) {
      if (user.mc_nickname) {
        accounts[idx].username = user.mc_nickname;
        accounts[idx].uuid = offlineUuid(user.mc_nickname);
        accounts[idx].type = 'offline';
      }
      accounts[idx].whitelistStatus = user.whitelist_status;
      accounts[idx].twitchLogin = user.twitch_login;
      accounts[idx].twitchAvatar = user.twitch_avatar;
      accounts[idx].mcVerifiedAt = user.mc_verified_at || 0;
      accounts[idx].mcType = user.mc_verified_at && user.mc_uuid && user.mc_type === 'microsoft' ? 'microsoft' : 'offline';
      accounts[idx].mcUuid = user.mc_uuid;

      return accounts[idx];
    }
    return null;
    });
  } catch (err) {
    console.warn('[Community] profile refresh unavailable; accounts preserved');
  }
  return null;
}

// Renderer passes only an account ID. Proofs stay in the main process.
export async function linkMinecraftAccount(accountId: string): Promise<Account | null> {
  if (linkingMinecraft) throw new Error('Привязка уже выполняется.');
  linkingMinecraft = true;
  let community: Account | undefined;
  try {
    let microsoft = (await getAccounts()).find(a => a.id === accountId && a.type === 'microsoft');
    if (!microsoft) throw new Error('Сначала добавьте аккаунт Microsoft.');
    const { dialog } = require('electron');
    if (!microsoft.accessToken) {
      const retry = await dialog.showMessageBox({ type: 'question', title: 'Обновить вход Microsoft',
        message: `Для ${microsoft.username} не сохранился игровой токен.`,
        detail: 'Войдите повторно в тот же аккаунт Microsoft. Затем продолжится привязка к Twitch.',
        buttons: ['Войти через Microsoft', 'Отмена'], defaultId: 0, cancelId: 1 });
      if (retry.response !== 0) return null;
      const expectedUuid = microsoft.uuid.replace(/-/g, '').toLowerCase();
      microsoft = await loginMicrosoft();
      if (microsoft.uuid.replace(/-/g, '').toLowerCase() !== expectedUuid) {
        throw new Error('Вы вошли в другой Minecraft-профиль. Привязка отменена. Выберите нужный аккаунт и повторите.');
      }
    }
    microsoft = await ensureMicrosoftAccount(microsoft.id);
    // Reuse the one-time grant from the just-completed Twitch login in either order.
    // Old grants, other sessions and restarts still require browser authorization.
    community = (await getAccounts()).find(account => {
      const grant = linkGrants.get(account.id);
      return account.communityToken && grant?.token === account.communityToken && grant.expiresAt > Date.now();
    });
    if (!community) community = await loginCommunity(true);
    const grant = linkGrants.get(community.id);
    linkGrants.delete(community.id);
    if (!grant) throw new Error('Сервер ещё не поддерживает привязку из лаунчера.');
    const post = (action:string,body:object)=>communityRequest('/api/public/community/launcher/minecraft/'+action,community!.communityToken,body,false,60000);
    const preview = await post('preview', { code: grant.code, minecraft_access_token: microsoft.accessToken });
    const candidate = preview.candidate;
    if (!candidate || !/^[a-zA-Z0-9_]{3,16}$/.test(candidate.name) || typeof candidate.uuid !== 'string') {
      throw new Error('Сервер вернул некорректный игровой профиль.');
    }
    if (candidate.uuid.replace(/-/g, '').toLowerCase() !== microsoft.uuid.replace(/-/g, '').toLowerCase()) {
      throw new Error('Игровая сессия относится к другому профилю. Повторите вход Microsoft.');
    }
    const confirmation = await dialog.showMessageBox({ type: 'question', title: 'Подтвердить привязку',
      message: `Twitch @${community.twitchLogin} → Minecraft ${candidate.name}`,
      detail: 'Этот Minecraft-профиль станет игровым профилем сообщества. При переходе меняется UUID: инвентарь и прогресс автоматически не переносятся. После привязки играйте через Microsoft; доступ к выживанию зависит от одобрения.',
      buttons: ['Привязать', 'Отмена'], defaultId: 1, cancelId: 1 });
    if (confirmation.response !== 0) return null;
    await post('confirm', { code: preview.code });
    const freshCommunity = await refreshCommunityProfile(community.communityToken!);
    return await updateAccounts(accounts=>{
    const index = accounts.findIndex(a => a.id === microsoft!.id && a.type === 'microsoft');
    if (index < 0) throw new Error('Привязка завершена. Войдите через Microsoft заново.');
    // Transfer twitch login, avatar, and whitelist status to the Microsoft account
    accounts[index].twitchLogin = community!.twitchLogin;
    accounts[index].twitchAvatar = community!.twitchAvatar;
    accounts[index].whitelistStatus = freshCommunity?.whitelistStatus || community!.whitelistStatus;
    accounts[index].communityToken = community!.communityToken;
    if (!freshCommunity?.mcVerifiedAt || freshCommunity.mcUuid?.replace(/-/g, '').toLowerCase() !== candidate.uuid.replace(/-/g, '').toLowerCase()) {
      throw new Error('Подтверждение отправлено. Обновите профиль сообщества, чтобы проверить результат привязки.');
    }
    accounts[index].mcType = 'microsoft';
    accounts[index].mcUuid = freshCommunity.mcUuid;
    accounts[index].mcVerifiedAt = freshCommunity.mcVerifiedAt;
    delete accounts[index].communityLinkError;
    accounts[index].username = candidate.name;
    accounts[index].active = true;

    // Remove redundant/duplicate offline community account now that official license is linked
    const remaining = accounts.filter(a => a.id === accounts[index].id || (a.id !== community?.id && a.uuid !== candidate.uuid));
    remaining.forEach(a => { if (a.id !== accounts[index].id) a.active = false; });
    accounts.splice(0,accounts.length,...remaining);
    return remaining.find(a=>a.id===microsoft!.id)!;
    });
  } finally {
    if (community) linkGrants.delete(community.id);
    linkingMinecraft = false;
  }
}

export async function removeAccount(id: string): Promise<void> {
  await updateAccounts(accounts=>{
    const remaining=accounts.filter(a=>a.id!==id);
    if(remaining.length && !remaining.some(a=>a.active))remaining[0].active=true;
    accounts.splice(0,accounts.length,...remaining);
  });
}
export async function setActiveAccount(id: string): Promise<void> {
  await updateAccounts(accounts=>{
    if(!accounts.some(a=>a.id===id))throw new Error('Аккаунт не найден. Обновите список аккаунтов.');
    accounts.forEach(a=>{a.active=a.id===id;});
  });
}
