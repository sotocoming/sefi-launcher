import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { atomicWrite } from './minecraft/atomic-files';

export async function getReleaseNotesVersion(): Promise<string> {
  try {
    const data = JSON.parse(await fs.readFile(path.join(app.getPath('userData'), 'release-notes.json'), 'utf8'));
    return typeof data.version === 'string' && /^\d+\.\d+\.\d+$/.test(data.version) ? data.version : '';
  } catch { return ''; }
}
export async function acknowledgeReleaseNotes(version: unknown): Promise<void> {
  if (version !== app.getVersion()) throw new Error('Некорректная версия лаунчера.');
  await atomicWrite(path.join(app.getPath('userData'), 'release-notes.json'), JSON.stringify({version}));
}
