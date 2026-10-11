import { net } from 'electron';
import { setTimeout as delay } from 'timers/promises';

export class MicrosoftSessionError extends Error {
  constructor(message: string, public kind: 'network' | 'auth' | 'service' | 'rate-limit' = 'service', public status?: number) { super(message); }
}

const NETWORK_CODES = /\b(?:ERR_[A-Z_]+|EAI_AGAIN|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|CERT_HAS_EXPIRED|UNABLE_TO_VERIFY_LEAF_SIGNATURE)\b/;
export function microsoftFailure(error: any, stage: string): MicrosoftSessionError {
  const code = String(error?.cause?.code || error?.code || error?.message || '').match(NETWORK_CODES)?.[0];
  const network = code || error?.type === 'system' || error?.name === 'TimeoutError' || error?.name === 'AbortError';
  // Never log provider bodies, URLs containing credentials, or arbitrary exception text.
  console.warn('[Microsoft auth]', stage, network ? code || 'NETWORK_TIMEOUT' : 'FAILED');
  return new MicrosoftSessionError(network
    ? `Не удалось соединиться с Microsoft / Minecraft Services (${stage}${code ? ': ' + code : ''}). Проверьте сеть, VPN или прокси и повторите вход. Это не означает отсутствие Minecraft Java.`
    : `Не удалось завершить вход Microsoft (${stage}). Повторите вход.`, network ? 'network' : 'service');
}

async function request(stage: string, url: string, options: RequestInit): Promise<any> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      const signal = options.signal ? AbortSignal.any([options.signal,AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000);
      response = await net.fetch(url,{...options,redirect:'error',signal});
    } catch(error) {
      if (options.signal?.aborted || attempt === 1) throw microsoftFailure(error,stage);
      await delay(400); continue;
    }
    if (!response.ok) {
      const status=response.status;
      if ((status>=500 || status===429) && attempt===0) { await response.body?.cancel(); await delay(700); continue; }
      if (stage==='Microsoft refresh' && [400,401,403].includes(status)) {
        let data: any; try { data=await response.json(); } catch { /* no provider body is logged */ }
        if (['invalid_grant','interaction_required','login_required','consent_required'].includes(data?.error) || status===401)
          throw new MicrosoftSessionError('Microsoft отозвал или завершил сессию. Войдите в этот аккаунт Microsoft заново.','auth',status);
      }
      await response.body?.cancel().catch(() => {});
      if (status===429) throw new MicrosoftSessionError('Microsoft ограничил частоту запросов. Подождите несколько минут и повторите запуск.','rate-limit',status);
      if (status>=500) throw new MicrosoftSessionError('Microsoft / Minecraft Services временно недоступен. Аккаунт сохранён; повторите запуск позже.','service',status);
      if (stage==='Minecraft profile' && status===404) throw new MicrosoftSessionError('Профиль Minecraft Java не найден. Проверьте покупку игры и создание Java-профиля на minecraft.net.','auth',status);
      if ([401,403].includes(status)) throw new MicrosoftSessionError('Сервис отклонил игровую сессию ('+stage+'). Повторите вход Microsoft.','auth',status);
      throw new MicrosoftSessionError('Сервис входа отклонил запрос ('+stage+', HTTP '+status+').','service',status);
    }
    try { return await response.json(); }
    catch { throw new MicrosoftSessionError('Сервис входа вернул некорректный ответ ('+stage+'). Повторите запуск.'); }
  }
  throw new MicrosoftSessionError('Сервис входа недоступен. Повторите запуск.','network');
}

export function tokenExpiry(token: string): number | undefined {
  try {
    const exp=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8')).exp;
    return Number.isFinite(exp) && exp>0 ? exp*1000 : undefined;
  } catch { return undefined; }
}

export async function minecraftSession(xbox: { xblToken?: { Token?: string } }, signal?: AbortSignal): Promise<{ accessToken: string; expiresAt: number; profile: { id: string; name: string } }> {
  const xboxToken = xbox?.xblToken?.Token;
  if (!xboxToken) throw new MicrosoftSessionError('Microsoft не вернул сессию Xbox. Повторите вход.');
  const jsonHeaders = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const xsts = await request('Xbox XSTS', 'https://xsts.auth.xboxlive.com/xsts/authorize', {
    method: 'POST', signal, headers: jsonHeaders, body: JSON.stringify({
      Properties: { SandboxId: 'RETAIL', UserTokens: [xboxToken] },
      RelyingParty: 'rp://api.minecraftservices.com/', TokenType: 'JWT',
    }),
  });
  const uhs = xsts?.DisplayClaims?.xui?.[0]?.uhs;
  if (typeof uhs !== 'string' || typeof xsts.Token !== 'string' || xsts.XErr) throw new MicrosoftSessionError('Xbox не подтвердил аккаунт. Проверьте профиль Xbox и семейные ограничения.');
  const session = await request('Minecraft login', 'https://api.minecraftservices.com/authentication/login_with_xbox', {
    method: 'POST', signal, headers: jsonHeaders, body: JSON.stringify({ identityToken: `XBL3.0 x=${uhs};${xsts.Token}` }),
  });
  const receivedAt=Date.now();
  if (typeof session.access_token !== 'string' || !session.access_token) throw new MicrosoftSessionError('Minecraft Services не вернул игровой токен. Повторите вход.');
  const profile = await request('Minecraft profile', 'https://api.minecraftservices.com/minecraft/profile', {
    signal, headers: { Accept: 'application/json', Authorization: `Bearer ${session.access_token}` },
  });
  if (!/^[a-f0-9]{32}$/i.test(profile?.id || '') || !/^[a-zA-Z0-9_]{3,16}$/.test(profile?.name || '')) throw new MicrosoftSessionError('Minecraft Services не вернул корректный профиль Java. Проверьте профиль на minecraft.net.');
  const ttl=Number(session.expires_in);
  const expiresAt=Number.isFinite(ttl) && ttl>0 && ttl<=7*86400 ? receivedAt+ttl*1000 : tokenExpiry(session.access_token);
  if (!expiresAt) throw new MicrosoftSessionError('Minecraft Services не сообщил срок игровой сессии. Повторите вход.');
  return { accessToken: session.access_token, expiresAt, profile: { id: profile.id, name: profile.name } };
}

async function xboxSession(msAccessToken: string, signal: AbortSignal): Promise<{xblToken:{Token:string}}> {
  const token=await request('Xbox login','https://user.auth.xboxlive.com/user/authenticate',{
    method:'POST', signal, headers:{'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({Properties:{AuthMethod:'RPS',SiteName:'user.auth.xboxlive.com',RpsTicket:'d='+msAccessToken},RelyingParty:'http://auth.xboxlive.com',TokenType:'JWT'})
  });
  if (typeof token?.Token!=='string' || !token.Token) throw new MicrosoftSessionError('Microsoft не вернул сессию Xbox. Повторите вход.');
  return {xblToken:token};
}
export async function microsoftCodeSession(code: string, oauth: {client_id:string;redirect:string}) {
  const signal=AbortSignal.timeout(90000);
  const ms=await request('Microsoft login','https://login.live.com/oauth20_token.srf',{
    method:'POST',signal,headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({client_id:oauth.client_id,redirect_uri:oauth.redirect,code,grant_type:'authorization_code'}).toString()
  });
  if (typeof ms?.access_token!=='string' || typeof ms?.refresh_token!=='string' || !ms.refresh_token) throw new MicrosoftSessionError('Microsoft не вернул ключ продления. Повторите вход.');
  return {...await minecraftSession(await xboxSession(ms.access_token,signal),signal),refreshToken:ms.refresh_token};
}
export async function renewMicrosoftSession(refreshToken: string, clientId: string, saveRefresh: (token:string)=>Promise<void>) {
  const signal=AbortSignal.timeout(90000);
  const ms=await request('Microsoft refresh','https://login.live.com/oauth20_token.srf',{
    method:'POST',signal,headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({client_id:clientId,refresh_token:refreshToken,grant_type:'refresh_token'}).toString()
  });
  if (typeof ms?.access_token!=='string' || !ms.access_token) throw new MicrosoftSessionError('Microsoft не вернул обновлённый токен. Повторите запуск.');
  // Persist the rotated key before Xbox/MC calls, even if those services fail afterward.
  const next=typeof ms.refresh_token==='string' && ms.refresh_token ? ms.refresh_token : refreshToken;
  await saveRefresh(next);
  return {...await minecraftSession(await xboxSession(ms.access_token,signal),signal),refreshToken:next};
}
export async function validateMinecraftToken(accessToken: string): Promise<{id:string;name:string}> {
  const profile=await request('Minecraft profile','https://api.minecraftservices.com/minecraft/profile',{
    headers:{Accept:'application/json',Authorization:'Bearer '+accessToken}
  });
  if (!/^[a-f0-9]{32}$/i.test(profile?.id||'') || !/^[a-zA-Z0-9_]{3,16}$/.test(profile?.name||'')) throw new MicrosoftSessionError('Minecraft Services не подтвердил профиль. Повторите вход.','auth');
  return profile;
}
