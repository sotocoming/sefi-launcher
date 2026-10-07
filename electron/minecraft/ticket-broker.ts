import { app, net } from 'electron';
import { createServer } from 'http';
import { createPublicKey, verify, createHash } from 'crypto';
import type { Account } from '../../src/types';

const ORIGIN = 'https://mc.sotocoming.ru';
const liveBrokers = new Set<() => void>();
app.on('before-quit', () => { for (const close of liveBrokers) close(); });

async function api(path: string, token?: string, body?: object): Promise<any> {
  let response: Response;
  try {
    response = await net.fetch(ORIGIN + '/api/public/community/launcher/ticket' + path, {
      method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { 'X-Community-Token': token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch { throw new Error('Сервис автовхода недоступен. Повторите запуск или используйте игровой пароль.'); }
  const data = await response.json() as any;
  if (!response.ok) throw new Error(data.error || 'Не удалось подтвердить автовход.');
  return data;
}

export function redactLaunchLog(message: string): string {
  if (message.includes('Launching with arguments')) return '[MCLC]: Запуск Minecraft (аргументы скрыты)';
  return message.replace(/(-Dsefi\.ticket=|--accessToken[=\s]+|--clientToken[=\s]+)\S+/gi, '$1[hidden]');
}

export async function startTicketBroker(account: Account): Promise<{ port: number; close: () => void }> {
  if (!account.communityToken || account.type !== 'offline') throw new Error('Выберите профиль SEFI Community.');
  const cfg = await api('/config');
  const key = createPublicKey({ key: Buffer.from(cfg.public_key, 'base64'), format: 'der', type: 'spki' });
  if (cfg.version !== 2 || cfg.server !== 'sefi-homestead' || key.asymmetricKeyType !== 'ed25519') throw new Error('Обновите лаунчер: версия автовхода не поддерживается.');
  const prepared = await api('/prepare', account.communityToken, {});
  if (!prepared.user || prepared.user.mc_nickname !== account.username || prepared.user.mc_verified_at) throw new Error('Игровой профиль изменился. Обновите SEFI Community перед запуском.');
  let busy = 0;
  const seen = new Map<string, number>();
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    const reply = (status: number, body: object) => { if (!res.destroyed) { res.writeHead(status); res.end(JSON.stringify(body)); } };
    const port = (server.address() as { port: number }).port;
    if (req.method !== 'POST' || req.url !== '/sefi/game-ticket' || req.headers.host !== `127.0.0.1:${port}`
        || req.socket.remoteAddress !== '127.0.0.1' || req.headers.origin !== undefined
        || req.headers['content-type']?.split(';')[0].trim() !== 'application/json') return reply(403, { error: 'Forbidden' });
    if (busy >= 2) return reply(429, { error: 'Busy' });
    busy++;
    try {
      let length = 0; const chunks: Buffer[] = [];
      for await (const chunk of req) {
        length += chunk.length; if (length > 4096) { reply(413, { error: 'Too large' }); req.destroy(); return; }
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (typeof body.challenge !== 'string' || !/^[A-Za-z0-9_-]{64,1800}$/.test(body.challenge)
          || typeof body.signature !== 'string' || !/^[A-Za-z0-9_-]{86}$/.test(body.signature)) throw new Error();
      const raw = Buffer.from(body.challenge, 'base64url');
      if (!verify(null, raw, key, Buffer.from(body.signature, 'base64url'))) throw new Error();
      const challenge = JSON.parse(raw.toString('utf8'));
      const now = Math.floor(Date.now() / 1000);
      if (challenge.v !== 2 || challenge.server !== cfg.server || challenge.name !== account.username
          || challenge.uuid.replace(/-/g, '').toLowerCase() !== account.uuid.replace(/-/g, '').toLowerCase()
          || !/^[A-Za-z0-9_-]{43}$/.test(challenge.nonce) || !Number.isInteger(challenge.expires)
          || challenge.expires <= now || challenge.expires > now + 60) throw new Error();
      const clientKey = createPublicKey({ key: Buffer.from(challenge.client_key, 'base64'), format: 'der', type: 'spki' });
      if (clientKey.asymmetricKeyType !== 'ed25519') throw new Error();
      for (const [id, expiry] of seen) if (expiry <= now) seen.delete(id);
      const id = createHash('sha256').update(raw).digest('hex');
      if (seen.has(id) || seen.size >= 32) throw new Error();
      seen.set(id, challenge.expires);
      const result = await api('', account.communityToken, { challenge: body.challenge, signature: body.signature });
      if (typeof result.ticket !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(result.ticket)) throw new Error();
      reply(200, { ticket: result.ticket });
    } catch { reply(403, { error: 'Не удалось подтвердить подключение. Переподключитесь или используйте игровой пароль.' }); }
    finally { busy--; }
  });
  server.requestTimeout = 5000; server.headersTimeout = 5000; server.setTimeout(5000);
  await new Promise<void>((resolve, reject) => {
    server.once('error', () => reject(new Error('Не удалось открыть локальный сервис автовхода.')));
    server.listen(0, '127.0.0.1', resolve);
  });
  const close = () => { server.close(); server.closeAllConnections(); seen.clear(); liveBrokers.delete(close); };
  liveBrokers.add(close);
  return { port: (server.address() as { port: number }).port, close };
}
