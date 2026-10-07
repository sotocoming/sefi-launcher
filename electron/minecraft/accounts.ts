import { app } from 'electron';
import { communityBrowserCode } from './community-browser';
import { minecraftSession, MicrosoftSessionError, microsoftFailure } from './microsoft-session';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID, randomBytes, createHash } from 'crypto';
import type { Account } from '../../src/types';

export async function getAccounts(): Promise<Account[]> {
  const accountsFile = path.join(app.getPath('userData'), 'accounts.json');
  try {
    const data = await fs.readFile(accountsFile, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

async function saveAccounts(accounts: Account[]): Promise<void> {
  const accountsFile = path.join(app.getPath('userData'), 'accounts.json');
  await fs.writeFile(accountsFile, JSON.stringify(accounts, null, 2));
}

export async function addOfflineAccount(username: string): Promise<Account> {
  const cleanName = (username || '').trim();
  if (!cleanName) {
    throw new Error('Никнейм не может быть пустым');
  }
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(cleanName)) {
    throw new Error('Никнейм должен состоять из латинских букв, цифр и знака _ (от 3 до 16 символов)');
  }

  const accounts = await getAccounts();
  const newAccount: Account = {
    id: randomUUID(),
    username: cleanName,
    uuid: randomUUID(),
    accessToken: randomUUID(),
    clientToken: randomUUID(),
    type: 'offline',
    active: true,
  };

  accounts.forEach((a) => (a.active = false));
  accounts.push(newAccount);
  await saveAccounts(accounts);
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
    const xboxManager = await authManager.login(code);
    const token = await minecraftSession(xboxManager);
    const profile = token.profile;
    const accounts = await getAccounts();

    const newAccount: Account = {
      id: profile.id || randomUUID(),
      username: profile.name,
      uuid: profile.id,
      accessToken: token.accessToken,
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

    // Auto-link with backend if communityToken is present
    if (newAccount.communityToken) {
      try {
        const linkRes = await fetch(COMMUNITY_ORIGIN + '/api/public/community/launcher/minecraft/auto-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Community-Token': newAccount.communityToken },
          body: JSON.stringify({ minecraft_access_token: newAccount.accessToken }),
        });
        if (linkRes.ok) {
          const resData = await linkRes.json() as any;
          if (resData?.user) {
            newAccount.whitelistStatus = resData.user.whitelist_status;
            newAccount.username = resData.user.mc_nickname || newAccount.username;
          }
        }
      } catch {
        // Silently continue - local token still attached
      }
    }

    // Clean duplicate offline community accounts
    const cleaned = accounts.filter(a => a.id === newAccount.id || !(a.type === 'offline' && a.communityToken));
    await saveAccounts(cleaned);
    return newAccount;
  } catch (err: any) {
    if (err instanceof MicrosoftSessionError) throw err;
    throw microsoftFailure(err, 'Microsoft / Xbox login');
  }
}

const COMMUNITY_ORIGIN = 'https://mc.sotocoming.ru';
const linkGrants = new Map<string, string>();
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
  let response: Response;
  try {
    response = await fetch(COMMUNITY_ORIGIN + '/api/public/community/auth/exchange', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, code_verifier: verifier }),
    });
  } catch { throw new Error('Не удалось завершить вход. Проверьте сеть и повторите вход через браузер.'); }
  const data = await response.json() as { token?: string; user?: any; error?: string; minecraft_link_grant?: string };
  if (!response.ok || !data.token || !data.user) throw new Error(data.error || 'Не удалось подтвердить вход');
    const user = data.user;
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(user.mc_nickname || '')) throw new Error('Игровой профиль требует проверки администратором');
    const accounts = await getAccounts();
    const newAccount: Account = {
      id: `comm_${user.id}`, username: user.mc_nickname,
      uuid: offlineUuid(user.mc_nickname), accessToken: randomUUID(), clientToken: randomUUID(),
      // A website binding is not a Microsoft session and cannot supply its game token.
      type: 'offline', active: true, communityToken: data.token,
      whitelistStatus: user.whitelist_status || 'pending',
      twitchLogin: user.twitch_login, twitchAvatar: user.twitch_avatar,
      mcType: user.mc_verified_at && user.mc_uuid && user.mc_type === 'microsoft' ? 'microsoft' : 'offline',
      mcUuid: user.mc_verified_at ? user.mc_uuid : undefined,
    };
    accounts.forEach(account => { account.active = false; });
    const index = accounts.findIndex(account => account.id === newAccount.id);
    if (index >= 0) accounts[index] = newAccount; else accounts.push(newAccount);
    await saveAccounts(accounts);
    const resolved = newAccount.mcType === 'microsoft' ? await refreshCommunityProfile(data.token) : null;
    const result = resolved || newAccount;
    if (data.minecraft_link_grant) linkGrants.set(result.id, data.minecraft_link_grant);
    return result;
}

export async function refreshCommunityProfile(token: string): Promise<Account | null> {
  try {
    const profRes = await fetch(COMMUNITY_ORIGIN + '/api/public/community/me', { headers: { 'X-Community-Token': token } });
    if (!profRes.ok) return null;
    const profData = (await profRes.json()) as { user?: any };
    const user = profData?.user;
    if (!user) return null;

    const accounts = await getAccounts();
    // Check if there is an associated Microsoft account
    const msIdx = accounts.findIndex(a => a.type === 'microsoft' && user.mc_verified_at && user.mc_uuid
      && a.uuid.replace(/-/g, '').toLowerCase() === user.mc_uuid.replace(/-/g, '').toLowerCase());
    if (msIdx !== -1 && user.mc_type === 'microsoft') {
      const transferSelection = accounts.some(a => a.active && a.type === 'offline'
        && (a.id === `comm_${user.id}` || a.twitchLogin === user.twitch_login));
      if (transferSelection) accounts.forEach(a => { a.active = a.id === accounts[msIdx].id; });
      accounts[msIdx].mcType = 'microsoft';
      accounts[msIdx].mcUuid = user.mc_uuid;
      accounts[msIdx].whitelistStatus = user.whitelist_status;
      accounts[msIdx].twitchLogin = user.twitch_login;
      accounts[msIdx].twitchAvatar = user.twitch_avatar;
      accounts[msIdx].communityToken = token;
      if (user.mc_nickname) accounts[msIdx].username = user.mc_nickname;
      const cleaned = accounts.filter(a => a.id === accounts[msIdx].id || !(a.type === 'offline' && (a.id === `comm_${user.id}` || a.twitchLogin === user.twitch_login)));
      await saveAccounts(cleaned);
      return accounts[msIdx];
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
      accounts[idx].mcType = user.mc_type;
      accounts[idx].mcUuid = user.mc_uuid;
      await saveAccounts(accounts);
      return accounts[idx];
    }
  } catch (err) {
    console.warn('Failed to refresh community profile:', err);
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
    community = await loginCommunity(true);
    const grant = linkGrants.get(community.id);
    linkGrants.delete(community.id);
    if (!grant) throw new Error('Сервер ещё не поддерживает привязку из лаунчера.');
    const post = async (action: string, body: object) => {
      let response: Response;
      try {
        response = await fetch(COMMUNITY_ORIGIN + '/api/public/community/launcher/minecraft/' + action, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60000),
          headers: { 'Content-Type': 'application/json', 'X-Community-Token': community!.communityToken! },
          body: JSON.stringify(body),
        });
      } catch { throw new Error('Сервис привязки недоступен. Обновите профиль перед повторной попыткой.'); }
      const data = await response.json() as any;
      if (!response.ok) throw new Error(data.error || 'Не удалось привязать Minecraft Java.');
      return data;
    };
    const preview = await post('preview', { code: grant, minecraft_access_token: microsoft.accessToken });
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
    const accounts = await getAccounts();
    const index = accounts.findIndex(a => a.id === microsoft.id && a.type === 'microsoft');
    if (index < 0) throw new Error('Привязка завершена. Войдите через Microsoft заново.');
    // Transfer twitch login, avatar, and whitelist status to the Microsoft account
    accounts[index].twitchLogin = community.twitchLogin;
    accounts[index].twitchAvatar = community.twitchAvatar;
    accounts[index].whitelistStatus = freshCommunity?.whitelistStatus || community.whitelistStatus;
    accounts[index].communityToken = community.communityToken;
    accounts[index].username = candidate.name;
    accounts[index].active = true;

    // Remove redundant/duplicate offline community account now that official license is linked
    const remaining = accounts.filter(a => a.id === accounts[index].id || (a.id !== community?.id && a.uuid !== candidate.uuid));
    remaining.forEach(a => { if (a.id !== accounts[index].id) a.active = false; });
    await saveAccounts(remaining);
    return accounts[index];
  } finally {
    if (community) linkGrants.delete(community.id);
    linkingMinecraft = false;
  }
}

export async function removeAccount(id: string): Promise<void> {
  const accounts = await getAccounts();
  const filtered = accounts.filter((a) => a.id !== id);
  if (filtered.length > 0 && !filtered.some((a) => a.active)) {
    filtered[0].active = true;
  }
  await saveAccounts(filtered);
}

export async function setActiveAccount(id: string): Promise<void> {
  const accounts = await getAccounts();
  accounts.forEach((a) => {
    a.active = a.id === id;
  });
  await saveAccounts(accounts);
}
