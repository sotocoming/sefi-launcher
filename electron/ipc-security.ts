import type { BrowserWindow, IpcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

export function trustedDocument(url: string, indexFile: string, development: boolean): boolean {
  try {
    const parsed = new URL(url);
    if (development) return parsed.origin === 'http://localhost:5173' && ['/', '/index.html'].includes(parsed.pathname);
    if (parsed.protocol !== 'file:' || parsed.host) return false;
    const canonical = (value: string) => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
    return canonical(fileURLToPath(parsed)) === canonical(indexFile);
  } catch { return false; }
}

export function trustedIpc(ipc: IpcMain, window: () => BrowserWindow | null, indexFile: string, development: boolean) {
  const allowed = (event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) => {
    const main = window();
    return !!main && !main.isDestroyed() && !main.webContents.isDestroyed()
      && event.sender === main.webContents && event.senderFrame === main.webContents.mainFrame
      && !!event.senderFrame && trustedDocument(event.senderFrame.url, indexFile, development);
  };
  return {
    handle(channel: string, listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any) {
      ipc.handle(channel, (event, ...args) => {
        if (!allowed(event)) throw new Error('Эта функция доступна только из интерфейса SEFI Launcher.');
        return listener(event, ...args);
      });
    },
    on(channel: string, listener: (event: Electron.IpcMainEvent, ...args: any[]) => void) {
      ipc.on(channel, (event, ...args) => { if (allowed(event)) listener(event, ...args); });
    },
  };
}

export function embeddingHeaders(url: string, resourceType: string, headers: Record<string, string[]>): Record<string, string[]> {
  try {
    if (resourceType !== 'subFrame' || new URL(url).origin !== 'https://mc.sotocoming.ru') return headers;
    return Object.fromEntries(Object.entries(headers).filter(([key]) => key.toLowerCase() !== 'x-frame-options')
      .map(([key, value]) => [key, key.toLowerCase() === 'content-security-policy'
        ? value.map(csp => csp.replace(/(?:^|;)\s*frame-ancestors\s+[^;]*(;|$)/gi, '$1')) : value]));
  } catch { return headers; }
}
