import { browserAuthPage } from './browser-auth-page';
import { shell } from 'electron';
import { createServer } from 'http';
import { timingSafeEqual } from 'crypto';

let waiting = false;
let cancelWaiting: (()=>void) | undefined;
export function cancelCommunityBrowser(): void { cancelWaiting?.(); }
export async function communityBrowserCode(session: string, challenge: string, fresh: boolean): Promise<string> {
  if (waiting) throw new Error('Вход уже открыт в браузере. Завершите его или дождитесь окончания попытки.');
  waiting = true;
  let server: ReturnType<typeof createServer> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<string>((resolve, reject) => {
      let finished = false;
      const finish = (code?: string, error?: Error) => {
        if (finished) return;
        finished = true;
        if (timer) clearTimeout(timer);
        server?.close();
        if (code) resolve(code); else reject(error || new Error('Вход не завершён.'));
      };
      cancelWaiting = () => finish(undefined,new Error('Вход через браузер отменён.'));
      server = createServer((req, res) => {
        const port = (server!.address() as { port: number }).port;
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; frame-ancestors 'none'");
        const invalid = () => { res.writeHead(400, {'Content-Type':'text/html; charset=utf-8'}); res.end(browserAuthPage(true)); };
        if (req.method !== 'GET' || req.headers.host !== `127.0.0.1:${port}` || (req.url || '').length > 2048
            || (req.headers.origin && req.headers.origin !== 'https://mc.sotocoming.ru')) return invalid();
        let url: URL;
        try { url = new URL(req.url!, `http://127.0.0.1:${port}`); } catch { return invalid(); }
        const returnedSession = url.searchParams.get('session') || '';
        const code = url.searchParams.get('code') || '';
        if (url.pathname !== '/sefi/callback' || url.searchParams.getAll('session').length !== 1
            || url.searchParams.getAll('code').length !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(code)
            || Buffer.byteLength(returnedSession) !== Buffer.byteLength(session)
            || !timingSafeEqual(Buffer.from(returnedSession), Buffer.from(session))) return invalid();
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(browserAuthPage());
        finish(code);
      });
      server.requestTimeout = 5000;
      server.headersTimeout = 5000;
      server.setTimeout(5000);
      server.on('error', () => finish(undefined, new Error('Не удалось открыть локальный приёмник входа. Повторите попытку.')));
      timer = setTimeout(() => finish(undefined, new Error('Время входа через браузер истекло. Повторите вход.')), 5 * 60 * 1000);
      server.listen(0, '127.0.0.1', () => {
        const port = (server!.address() as { port: number }).port;
        const url = new URL('https://mc.sotocoming.ru/static/launcher-login.html');
        url.search = new URLSearchParams({ session, code_challenge: challenge, port: String(port), fresh: fresh ? '1' : '0' }).toString();
        void shell.openExternal(url.href).catch(() => finish(undefined, new Error('Не удалось открыть браузер. Проверьте браузер по умолчанию и повторите вход.')));
      });
    });
  } finally {
    if (timer) clearTimeout(timer);
    server?.close();
    server?.closeAllConnections();
    cancelWaiting = undefined;
    waiting = false;
  }
}
