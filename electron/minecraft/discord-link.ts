import {BrowserWindow, session} from 'electron';
import {randomUUID} from 'crypto';
import {getAccounts, refreshCommunityProfile} from './accounts';
import type {Account} from '../../src/types';

const ORIGIN = 'https://mc.sotocoming.ru';
const CALLBACK = ORIGIN + '/api/public/community/auth/discord/callback';
let pending = false;
let cancel: (() => void) | undefined;
export function cancelDiscordLink(): void { cancel?.(); }

/** The SEFI token stays native; only the provider's one-time OAuth state reaches the window. */
export async function linkDiscordAccount(accountId: unknown, parent?: BrowserWindow | null): Promise<Account> {
  if (pending) throw new Error('Привязка Discord уже открыта. Завершите её или закройте окно.');
  if (typeof accountId !== 'string') throw new Error('Выберите профиль SEFI.');
  const isolated = session.fromPartition('sefi-discord-' + randomUUID());
  pending = true;
  let window: BrowserWindow | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const abort = new AbortController();
  const cancelled = () => new Error('Привязка Discord отменена. Можно повторить её позже.');
  cancel = () => abort.abort();
  try {
    const account = (await getAccounts()).find(a => a.id === accountId);
    if (!account?.communityToken) throw new Error('Сначала войдите в SEFI Community.');
    if(abort.signal.aborted)throw cancelled();
    const response = await isolated.fetch(ORIGIN + '/api/public/community/auth/discord/url', {
      headers: {Accept:'application/json', 'X-Community-Token':account.communityToken},
      credentials:'include', redirect:'error', signal:AbortSignal.any([abort.signal,AbortSignal.timeout(20000)]),
    }).catch(() => { throw abort.signal.aborted ? cancelled() : new Error('Не удалось соединиться с SEFI. Проверьте сеть и повторите привязку.'); });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(response.status === 401 ? 'Сессия SEFI истекла. Войдите через сайт заново.'
        : response.status === 429 ? 'Слишком много попыток. Подождите немного и повторите привязку.'
        : 'Привязка Discord сейчас недоступна. Повторите позже.');
    }
    const data = await response.json().catch(() => { throw abort.signal.aborted ? cancelled() : new Error('SEFI вернул некорректный ответ. Повторите привязку.'); }) as {url?:unknown};
    let target: URL;
    try {
      if(typeof data?.url !== 'string')throw new Error();
      target = new URL(data.url);
      if (target.origin !== 'https://discord.com' || target.pathname !== '/api/oauth2/authorize'
        || target.username || target.password || target.searchParams.get('redirect_uri') !== CALLBACK
        || target.searchParams.get('scope') !== 'identify' || target.searchParams.get('response_type') !== 'code'
        || !/^[0-9]{17,20}$/.test(target.searchParams.get('client_id') || '')
        || !/^[A-Za-z0-9_-]{43}$/.test(target.searchParams.get('state') || '')) throw new Error();
    } catch { throw new Error('SEFI вернул некорректную ссылку Discord. Повторите позже.'); }
    const cookies = await isolated.cookies.get({url:CALLBACK, name:'sefi_oauth'});
    if(abort.signal.aborted)throw cancelled();
    if (!cookies.some(c => c.httpOnly && c.secure && /^[A-Za-z0-9_-]{43}$/.test(c.value))) {
      throw new Error('Не удалось подготовить защищённую привязку. Повторите попытку.');
    }
    isolated.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    isolated.setPermissionCheckHandler(() => false);
    await new Promise<void>((resolve, reject) => {
      let finished = false;
      const finish = (error?: Error) => {
        if (finished) return;
        finished = true;
        if (timer) clearTimeout(timer);
        if (window && !window.isDestroyed()) window.destroy();
        if (error) reject(error); else resolve();
      };
      cancel = () => finish(cancelled());
      window = new BrowserWindow({width:520, height:760, minWidth:440, minHeight:600,
        parent:parent || undefined, modal:!!parent, title:'Discord — привязка к SEFI',
        autoHideMenuBar:true, backgroundColor:'#191121',
        webPreferences:{session:isolated, nodeIntegration:false, contextIsolation:true, sandbox:true, webSecurity:true}});
      window.on('page-title-updated', event => event.preventDefault());
      window.on('closed', () => cancel?.());
      window.webContents.setWindowOpenHandler(() => ({action:'deny'}));
      const navigate = (event: {preventDefault():void}, value: string) => {
        let url: URL;
        try { url = new URL(value); } catch { event.preventDefault(); return; }
        if(url.username || url.password){event.preventDefault();return;}
        if (url.origin === ORIGIN && url.pathname === '/profile' && url.searchParams.get('discord_linked') === '1') {
          event.preventDefault(); finish(); return;
        }
        if (url.origin === ORIGIN && url.pathname === '/api/public/community/auth/discord/callback') {
          if (url.searchParams.has('error')) { event.preventDefault(); cancel?.(); }
          return;
        }
        if (url.origin !== 'https://discord.com') event.preventDefault();
      };
      window.webContents.on('will-navigate', navigate);
      window.webContents.on('will-redirect', (event, url, _inPlace, mainFrame) => {if(mainFrame)navigate(event,url);});
      isolated.webRequest.onCompleted({urls:[CALLBACK + '*']}, details => {
        if (details.resourceType === 'mainFrame' && details.statusCode >= 400) {
          finish(new Error(details.statusCode === 409 ? 'Этот Discord уже привязан к другому профилю или недоступен для привязки.'
            : 'SEFI не смог завершить привязку Discord. Закройте окно и повторите попытку.'));
        }
      });
      window.webContents.on('did-fail-load', (_event, code, _description, _url, mainFrame) => {
        if (mainFrame && code !== -3) finish(new Error('Не удалось загрузить Discord. Проверьте сеть и повторите привязку.'));
      });
      timer = setTimeout(() => finish(new Error('Время привязки Discord истекло. Повторите попытку.')),5 * 60 * 1000);
      void window.loadURL(target.href).catch(() => finish(new Error('Не удалось открыть Discord. Повторите привязку.')));
    });
    const updated = await refreshCommunityProfile(account.communityToken);
    if (!updated?.discordId) throw new Error('Подтверждение получено, но профиль не обновился. Обновите его или проверьте привязку в личном кабинете.');
    return updated;
  } finally {
    if (timer) clearTimeout(timer);
    cancel = undefined;
    if (window && !window.isDestroyed()) window.destroy();
    isolated.webRequest.onCompleted(null);
    await isolated.clearStorageData().catch(() => {});
    pending = false;
  }
}
