import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { randomUUID } from 'crypto';
import { installFile, renameFile } from './atomic-files';

export async function ensureClaimsColorFix(gameDir: string): Promise<void> {
  const name = 'sefi-claims-color-fix-1.0.0.jar';
  const candidates = [path.join(process.resourcesPath || '', 'resources/mods', name), path.join(app.getAppPath(), 'resources/mods', name)];
  let source: string | undefined;
  for (const candidate of candidates) if (await fs.access(candidate).then(() => true, () => false)) { source = candidate; break; }
  if (!source) throw new Error('В установке лаунчера отсутствует исправление карты SEFI. Переустановите лаунчер.');
  const mods = path.join(gameDir, 'mods');
  await fs.mkdir(mods, { recursive: true });
  if ((await fs.lstat(mods)).isSymbolicLink()) throw new Error('Папка mods не должна быть ссылкой.');
  await installFile(source, path.join(mods, name));
  for (const item of await fs.readdir(mods, { withFileTypes: true })) {
    if (item.isFile() && item.name !== name && /^sefi-claims-color-fix-\d[\w.+-]*\.jar$/.test(item.name)) {
      const backup = path.join(gameDir, 'sefi-backups', 'claims-fix-' + randomUUID());
      await fs.mkdir(backup, { recursive: true });
      await renameFile(path.join(mods, item.name), path.join(backup, item.name));
    }
  }
}
