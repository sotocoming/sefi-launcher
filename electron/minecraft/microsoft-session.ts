import { net } from 'electron';

export class MicrosoftSessionError extends Error {}

const NETWORK_CODES = /\b(?:ERR_[A-Z_]+|EAI_AGAIN|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|CERT_HAS_EXPIRED|UNABLE_TO_VERIFY_LEAF_SIGNATURE)\b/;
export function microsoftFailure(error: any, stage: string): MicrosoftSessionError {
  const code = String(error?.cause?.code || error?.code || error?.message || '').match(NETWORK_CODES)?.[0];
  const network = code || error?.type === 'system' || error?.name === 'TimeoutError' || error?.name === 'AbortError';
  // Never log provider bodies, URLs containing credentials, or arbitrary exception text.
  console.warn('[Microsoft auth]', stage, network ? code || 'NETWORK_TIMEOUT' : 'FAILED');
  return new MicrosoftSessionError(network
    ? `Не удалось соединиться с Microsoft / Minecraft Services (${stage}${code ? ': ' + code : ''}). Проверьте сеть, VPN или прокси и повторите вход. Это не означает отсутствие Minecraft Java.`
    : `Не удалось завершить вход Microsoft (${stage}). Повторите вход.`);
}

async function request(stage: string, url: string, options: RequestInit): Promise<any> {
  let response: Response | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // Chromium networking honours system proxy settings, unlike msmc's node-fetch.
      response = await net.fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(20000) });
      break;
    } catch (error) {
      if (attempt === 1) throw microsoftFailure(error, stage);
    }
  }
  if (!response) throw new MicrosoftSessionError('Сервис входа недоступен. Повторите вход.');
  if (!response.ok) {
    const status = response.status;
    await response.body?.cancel();
    if (status === 429) throw new MicrosoftSessionError('Microsoft / Minecraft Services ограничил частоту запросов. Подождите несколько минут и повторите вход.');
    if (stage === 'Minecraft profile' && status === 404) throw new MicrosoftSessionError('Профиль Minecraft Java не найден. Проверьте покупку игры и создание Java-профиля на minecraft.net. Для стандартного входа используйте SEFI Community.');
    if (stage === 'Minecraft login' && status === 403) throw new MicrosoftSessionError('Minecraft Services отклонил вход приложения (HTTP 403). Это не означает отсутствие Minecraft Java.');
    throw new MicrosoftSessionError(`Сервис входа отклонил запрос (${stage}, HTTP ${status}). Повторите вход Microsoft; если ошибка сохраняется, проверьте аккаунт Xbox.`);
  }
  try { return await response.json(); }
  catch { throw new MicrosoftSessionError(`Сервис входа вернул некорректный ответ (${stage}). Повторите вход.`); }
}

export async function minecraftSession(xbox: { xblToken?: { Token?: string } }): Promise<{ accessToken: string; profile: { id: string; name: string } }> {
  const xboxToken = xbox?.xblToken?.Token;
  if (!xboxToken) throw new MicrosoftSessionError('Microsoft не вернул сессию Xbox. Повторите вход.');
  const jsonHeaders = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const xsts = await request('Xbox XSTS', 'https://xsts.auth.xboxlive.com/xsts/authorize', {
    method: 'POST', headers: jsonHeaders, body: JSON.stringify({
      Properties: { SandboxId: 'RETAIL', UserTokens: [xboxToken] },
      RelyingParty: 'rp://api.minecraftservices.com/', TokenType: 'JWT',
    }),
  });
  const uhs = xsts?.DisplayClaims?.xui?.[0]?.uhs;
  if (typeof uhs !== 'string' || typeof xsts.Token !== 'string' || xsts.XErr) throw new MicrosoftSessionError('Xbox не подтвердил аккаунт. Проверьте профиль Xbox и семейные ограничения.');
  const session = await request('Minecraft login', 'https://api.minecraftservices.com/authentication/login_with_xbox', {
    method: 'POST', headers: jsonHeaders, body: JSON.stringify({ identityToken: `XBL3.0 x=${uhs};${xsts.Token}` }),
  });
  if (typeof session.access_token !== 'string' || !session.access_token) throw new MicrosoftSessionError('Minecraft Services не вернул игровой токен. Повторите вход.');
  const profile = await request('Minecraft profile', 'https://api.minecraftservices.com/minecraft/profile', {
    headers: { Accept: 'application/json', Authorization: `Bearer ${session.access_token}` },
  });
  if (!/^[a-f0-9]{32}$/i.test(profile?.id || '') || !/^[a-zA-Z0-9_]{3,16}$/.test(profile?.name || '')) throw new MicrosoftSessionError('Minecraft Services не вернул корректный профиль Java. Проверьте профиль на minecraft.net.');
  return { accessToken: session.access_token, profile: { id: profile.id, name: profile.name } };
}
