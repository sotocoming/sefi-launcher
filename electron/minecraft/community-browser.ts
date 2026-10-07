import { shell } from 'electron';
import { createServer } from 'http';
import { timingSafeEqual } from 'crypto';

let waiting = false;
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
      server = createServer((req, res) => {
        const port = (server!.address() as { port: number }).port;
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'none'");
        const invalid = () => { res.writeHead(400); res.end('Invalid authorization callback'); };
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
        const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SEFI Launcher — Вход выполнен</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: radial-gradient(circle at 50% 20%, #1e1335 0%, #0a0711 100%);
      color: #f4efff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 24px;
    }
    .card {
      width: 100%;
      max-width: 440px;
      padding: 40px 32px;
      border: 1px solid rgba(172, 142, 208, 0.2);
      border-radius: 24px;
      background: rgba(27, 18, 43, 0.85);
      backdrop-filter: blur(16px);
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(187, 219, 128, 0.08);
      text-align: center;
    }
    .badge-icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 20px;
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(187, 219, 128, 0.2), rgba(16, 185, 129, 0.2));
      border: 1px solid rgba(187, 219, 128, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #bbdb80;
    }
    .badge-icon svg {
      width: 32px;
      height: 32px;
    }
    .brand {
      color: #ac8ed0;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      line-height: 1.3;
      margin-bottom: 12px;
      color: #ffffff;
    }
    p {
      color: #bdb1ce;
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .tip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #e5def0;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </div>
    <div class="brand">SEFI Launcher</div>
    <h1>Подтверждение получено</h1>
    <p>Авторизация успешно завершена. Теперь вы можете вернуться в приложение SEFI Launcher.</p>
    <div class="tip">
      <span>✨</span> Эту вкладку можно безопасно закрыть
    </div>
  </div>
</body>
</html>`;
        res.end(html);
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
    waiting = false;
  }
}
