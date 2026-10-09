import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { normalizeGameDirectory } from './minecraft/game-directory';
import type { Settings, LauncherConfig } from '../src/types';

let settingsWrites: Promise<void> = Promise.resolve();

export async function getSettings(): Promise<Settings> {
  await settingsWrites;
  const userDataPath = app.getPath('userData');
  const settingsFile = path.join(userDataPath, 'settings.json');
  const appData = app.getPath('appData');

  const DEFAULT_SETTINGS: Settings = {
    ramMin: 2048,
    ramMax: 4096,
    javaPath: '',
    gameDirectory: path.join(appData, '.sefi-launcher'),
    windowWidth: 854,
    windowHeight: 480,
    closeOnLaunch: false,
    fullscreen: false,
  };

  try {
    const data = await fs.readFile(settingsFile, 'utf-8');
    const settings = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    return { ...settings, gameDirectory: normalizeGameDirectory(settings.gameDirectory) };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  if (!settings || typeof settings.fullscreen !== 'boolean' || typeof settings.closeOnLaunch !== 'boolean') {
    throw new Error('Некорректные настройки экрана и запуска.');
  }
  const serialized = JSON.stringify({ ...settings, gameDirectory: normalizeGameDirectory(settings.gameDirectory) }, null, 2);
  const task = settingsWrites.then(async () => {
    const userDataPath = app.getPath('userData');
    await fs.mkdir(userDataPath, { recursive: true });
    const settingsFile = path.join(userDataPath, 'settings.json');
    const temp = settingsFile + '.' + randomUUID() + '.tmp';
    try { await fs.writeFile(temp, serialized, { flag: 'wx' }); await fs.rename(temp, settingsFile); }
    finally { await fs.unlink(temp).catch(() => {}); }
  });
  settingsWrites = task.catch(() => {});
  await task;
}

export async function getLauncherConfig(): Promise<LauncherConfig> {
  const [res, siteName] = await Promise.all([
    fetch('https://mc.sotocoming.ru/api/launcher/config', { signal: AbortSignal.timeout(15000) }),
    fetch('https://mc.sotocoming.ru/api/public/sites', { signal: AbortSignal.timeout(5000), redirect: 'error' })
      .then(async response => {
        if (!response.ok) return null;
        const data = await response.json() as { values?: { mc?: { title?: unknown } } };
        const title = data.values?.mc?.title;
        return typeof title === 'string' && title.trim() ? title.trim().slice(0, 160) : null;
      }).catch(() => null),
  ]);
  if (!res.ok) throw new Error(`Failed to fetch launcher config: ${res.statusText}`);
  const config = await res.json() as LauncherConfig;
  return { ...config, server: { ...config.server, name: siteName || config.server?.name || 'Sweet Home' } };
}
