import type { BrowserWindow } from 'electron';

/** Closing a window aborts its pending navigation; that is not a broken install. */
export async function loadWindowInterface(window: BrowserWindow, file: string, onFailure: (error: unknown) => void): Promise<void> {
  let closing = false;
  const onClose = () => { closing = true; };
  window.once('close', onClose);
  try { await window.loadFile(file); }
  catch (error) {
    if (!closing && !window.isDestroyed() && !window.webContents.isDestroyed()) onFailure(error);
  } finally { if (!window.isDestroyed()) window.removeListener('close', onClose); }
}
