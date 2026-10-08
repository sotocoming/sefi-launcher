import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export async function ensureSefiSkinMod(gameDir: string): Promise<void> {
  const name = 'sefi-skins-1.0.0.jar';
  const sources = [path.join(process.resourcesPath || '', 'resources', 'mods', name), path.join(app.getAppPath(), 'resources', 'mods', name)];
  const mods = path.join(gameDir, 'mods');
  await fs.mkdir(mods, { recursive: true });
  if ((await fs.lstat(mods)).isSymbolicLink()) throw new Error('Папка mods не должна быть ссылкой.');
  const source = await (async () => { for (const file of sources) if (await fs.access(file).then(() => true, () => false)) return file; })();
  if (!source) throw new Error('В установке лаунчера отсутствует мод SEFI Skins.');
  const dest = path.join(mods, name), temp = dest + '.' + randomUUID() + '.tmp';
  try { await fs.copyFile(source, temp, fs.constants.COPYFILE_EXCL); await fs.rename(temp, dest); }
  finally { await fs.unlink(temp).catch(() => {}); }
  for (const entry of await fs.readdir(mods, { withFileTypes: true })) {
    if (entry.isFile() && /^sefi-skins-[0-9][A-Za-z0-9.+_-]*\.jar$/.test(entry.name) && entry.name !== name) {
      const backup = path.join(gameDir, 'sefi-backups', 'skins-' + randomUUID());
      await fs.mkdir(backup, { recursive: true }); await fs.rename(path.join(mods, entry.name), path.join(backup, entry.name));
    }
  }
}
