import { net } from 'electron';
import { Readable } from 'stream';

// Chromium uses the system proxy settings; Node fetch does not.
// Return redirects to the caller so it can validate every destination.
export function requestDownload(url: string, signal: AbortSignal, headers?: Record<string, string>): Promise<Response> {
  return new Promise((resolve, reject) => {
    const request = net.request({ url, method: 'GET', redirect: 'manual', credentials: 'omit', useSessionCookies: false });
    let settled = false;
    let responseBody: Readable | undefined;
    const cleanup = () => signal.removeEventListener('abort', abort);
    const abort = () => {
      responseBody?.destroy(signal.reason || new Error('Загрузка отменена.'));
      request.abort();
      if (!settled) { settled = true; cleanup(); reject(signal.reason || new Error('Загрузка отменена.')); }
    };
    request.setHeader('User-Agent', 'SEFI-Launcher/1.0');
    for (const [name, value] of Object.entries(headers || {})) request.setHeader(name, value);
    request.on('redirect', (status, _method, location) => {
      if (settled) return;
      settled = true; cleanup();
      resolve(new Response(null, { status, headers: { location } }));
      request.abort();
    });
    request.on('error', error => {
      cleanup();
      Object.assign(error, { downloadTransient: true });
      responseBody?.destroy(error);
      if (!settled) { settled = true; reject(error); }
    });
    request.on('response', response => {
      if (settled) { request.abort(); return; }
      const headers = new Headers();
      for (const [name, value] of Object.entries(response.headers)) {
        if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      }
      const body = new Readable({
        read() {},
        destroy(error, callback) { cleanup(); request.abort(); callback(error); },
      });
      responseBody = body;
      response.on('data', (chunk: Buffer) => {
        if (body.destroyed) return;
        if (body.readableLength + chunk.length > 16 * 1024 * 1024) {
          body.destroy(new Error('Не удалось записать загрузку: диск не успевает принимать данные.'));
        } else body.push(chunk);
      });
      response.once('end', () => { cleanup(); body.push(null); });
      response.once('error', error => { cleanup(); body.destroy(Object.assign(error, { downloadTransient: true })); });
      response.once('aborted', () => body.destroy(Object.assign(new Error('Загрузка оборвалась.'), { downloadTransient: true })));
      settled = true;
      resolve(new Response(Readable.toWeb(body) as ReadableStream, { status: response.statusCode, headers }));
    });
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    else request.end();
  });
}
