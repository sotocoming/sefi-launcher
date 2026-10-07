import bundledCatalog from './modpack-catalog.json';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type { ModpackStatus, DownloadProgress } from '../../src/types';
import { getLauncherConfig } from '../config';
import { app } from 'electron';
import { checkedZip, downloadArchive, fileSha256, safeFileName } from './modpack-download';

type ManagedFile = { directory?: 'mods' | 'resourcepacks' | 'shaderpacks'; name: string; sha256: string; size: number; projectId?: number; fileId?: number };
type InstallMeta = { schema: number; version: string; projectId: number; fileId: number; files: ManagedFile[]; archiveSha256: string };
const installations = new Map<string, Promise<void>>();

async function readMeta(gameDir: string): Promise<InstallMeta | null> {
  try { return JSON.parse(await fs.readFile(path.join(gameDir, 'modpack-meta.json'), 'utf-8')); } catch { return null; }
}
function validRecord(file: ManagedFile): boolean {
  try { return (!file.directory || file.directory === 'mods' || file.directory === 'resourcepacks' || file.directory === 'shaderpacks') && safeFileName(file.name, file.directory && file.directory !== 'mods' ? '.zip' : '.jar') === file.name && /^[0-9a-f]{64}$/.test(file.sha256) && Number.isSafeInteger(file.size) && file.size > 0; }
  catch { return false; }
}
async function matches(file: string, record: ManagedFile): Promise<boolean> {
  if (!validRecord(record)) return false;
  const pinned = (bundledCatalog.files as Record<string, { sha256?: string }>)[`${record.projectId}:${record.fileId}`];
  if (pinned?.sha256 && record.sha256 !== pinned.sha256) return false;
  try {
    const stat = await fs.lstat(file);
    return stat.isFile() && !stat.isSymbolicLink() && stat.size === record.size && await fileSha256(file) === record.sha256;
  } catch { return false; }
}
async function safeDestination(root: string, relative: string): Promise<string> {
  if (!relative || relative.includes('\\') || relative.startsWith('/') || relative.includes(':')
    || relative.split('/').some(part => part === '..' || part === '.' || !part)) throw new Error('Недопустимый путь установки.');
  let current = path.resolve(root);
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    try { if ((await fs.lstat(current)).isSymbolicLink()) throw new Error('Установка через символические ссылки запрещена.'); }
    catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  }
  return current;
}
async function atomicFile(source: string, destination: string): Promise<void> {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const temp = path.join(path.dirname(destination), `.sefi-${randomUUID()}.tmp`);
  try { await fs.copyFile(source, temp); await fs.rename(temp, destination); }
  finally { await fs.unlink(temp).catch(() => {}); }
}
async function atomicJson(destination: string, value: unknown): Promise<void> {
  const temp = destination + '.' + randomUUID() + '.tmp';
  try { await fs.writeFile(temp, JSON.stringify(value, null, 2), { flag: 'wx' }); await fs.rename(temp, destination); }
  finally { await fs.unlink(temp).catch(() => {}); }
}

export async function getModpackStatus(gameDir: string): Promise<ModpackStatus> {
  const config = await getLauncherConfig();
  const meta = await readMeta(gameDir);
  const incomplete = await fs.access(path.join(gameDir, 'modpack-installing.json')).then(() => true, () => false);
  let installed = !incomplete && meta?.schema === 2 && typeof meta.version === 'string'
    && meta.projectId === config.modpack.curseforgeProjectId && meta.fileId === config.modpack.curseforgeFileId
    && (!config.modpack.sha256 || meta.archiveSha256 === config.modpack.sha256.toLowerCase())
    && (meta.projectId !== bundledCatalog.projectId || meta.fileId !== bundledCatalog.fileId
      || meta.archiveSha256 === bundledCatalog.archive.sha256)
    && Array.isArray(meta.files) && meta.files.length > 0 && meta.files.every(validRecord);
  if (installed && meta) {
    for (const file of meta.files) {
      if (!await matches(path.join(gameDir, file.directory || 'mods', file.name), file)) { installed = false; break; }
    }
  }
  return { installed, currentVersion: typeof meta?.version === 'string' ? meta.version : null,
    latestVersion: config.modpack.version, updateAvailable: !installed || meta?.version !== config.modpack.version, modpack: config.modpack };
}

export function installModpack(gameDir: string, onProgress: (p: DownloadProgress) => void): Promise<void> {
  const key = path.resolve(gameDir);
  const existing = installations.get(key);
  if (existing) return existing;
  const task = performInstall(key, onProgress).finally(() => installations.delete(key));
  installations.set(key, task);
  return task;
}

async function performInstall(gameDir: string, onProgress: (p: DownloadProgress) => void): Promise<void> {
  const config = await getLauncherConfig();
  const { curseforgeProjectId: projectId, curseforgeFileId: fileId } = config.modpack;
  if (![projectId, fileId].every(id => Number.isSafeInteger(id) && id > 0)) throw new Error('Неверные идентификаторы сборки CurseForge.');
  await fs.mkdir(gameDir, { recursive: true });
  const stage = await fs.mkdtemp(path.join(gameDir, '.sefi-install-'));
  const previous = await readMeta(gameDir);
  const progress = (task: string, downloaded = 0, total = 0) => onProgress({ stage: 'modpack', task, downloaded, total, percentage: total ? downloaded / total * 100 : 0 });
  try {
    const catalog = bundledCatalog.projectId === projectId && bundledCatalog.fileId === fileId ? bundledCatalog : null;
    const catalogFiles = catalog?.files as Record<string, { url: string; sha256?: string }> | undefined;
    progress('Загрузка и проверка архива Homestead Cozy');
    const archive = await downloadArchive(catalog?.archive.url || `https://www.curseforge.com/api/v1/mods/${projectId}/files/${fileId}/download`, stage, '.zip',
      (done, total) => progress('Загрузка архива сборки', done, total), config.modpack.sha256 || catalog?.archive.sha256 || undefined);
    if (catalog && archive.sha256 !== catalog.archive.sha256) throw new Error('Сборка не совпадает с проверенным каталогом загрузок.');
    const zip = checkedZip(archive.file);
    const manifest = JSON.parse(zip.readAsText('manifest.json'));
    if (!manifest || !Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > 5000
      || manifest.minecraft?.version !== config.modpack.minecraft) throw new Error('Манифест сборки некорректен или версия Minecraft не совпадает.');
    const overrides = manifest.overrides || 'overrides';
    if (typeof overrides !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(overrides)) throw new Error('Недопустимый каталог overrides.');
    const extracted = path.join(stage, 'extracted');
    zip.extractAllTo(extracted, true);
    const stagedMods = path.join(stage, 'mods');
    await fs.mkdir(stagedMods);
    const records: ManagedFile[] = [];
    const names = new Set<string>();
    const ids = new Set<string>();
    for (const file of manifest.files) {
      if (![file.projectID, file.fileID].every(id => Number.isSafeInteger(id) && id > 0)) throw new Error('Недопустимый идентификатор мода в манифесте.');
      const id = `${file.projectID}:${file.fileID}`;
      if (ids.has(id)) throw new Error('Дублирующийся мод в манифесте.');
      ids.add(id);
    }
    const cacheDir = await safeDestination(gameDir, '.sefi-mod-cache');
    await fs.mkdir(cacheDir, { recursive: true });
    let nextIndex = 0;
    let completed = 0;
    let installFailed = false;
    async function installFile(file: any): Promise<void> {
      const id = `${file.projectID}:${file.fileID}`;
      const cached = previous?.schema === 2 && Array.isArray(previous.files)
        ? previous.files.find(record => record.projectId === file.projectID && record.fileId === file.fileID && validRecord(record)) : undefined;
      let record: ManagedFile;
      if (cached && await matches(path.join(gameDir, cached.directory || 'mods', cached.name), cached)) {
        await fs.copyFile(path.join(gameDir, cached.directory || 'mods', cached.name), path.join(stagedMods, cached.name));
        record = cached;
      } else {
        const entryDir = await safeDestination(gameDir, `.sefi-mod-cache/${file.projectID}-${file.fileID}`);
        await fs.mkdir(entryDir, { recursive: true });
        let saved: ManagedFile | null = null;
        try { saved = JSON.parse(await fs.readFile(path.join(entryDir, 'verified.json'), 'utf-8')); } catch {}
        if (saved && validRecord(saved) && saved.projectId === file.projectID && saved.fileId === file.fileID
          && await matches(path.join(entryDir, saved.name), saved)) {
          record = saved;
        } else {
          try {
            const source = catalogFiles?.[`${file.projectID}:${file.fileID}`];
            if (catalog && !source) throw new Error('Файл отсутствует в проверенном каталоге сборки.');
            const downloaded = await downloadArchive(source?.url || `https://www.curseforge.com/api/v1/mods/${file.projectID}/files/${file.fileID}/download`, entryDir, '.mod', undefined, source?.sha256);
            let directory: 'mods' | 'resourcepacks' | 'shaderpacks' = 'mods';
            if (downloaded.name.toLowerCase().endsWith('.zip')) {
              const content = checkedZip(downloaded.file);
              if (content.getEntry('pack.mcmeta')) directory = 'resourcepacks';
              else if (content.getEntries().some((entry: any) => entry.entryName.startsWith('shaders/'))) directory = 'shaderpacks';
              else throw new Error('Неизвестный тип ZIP в манифесте: это не ресурс-пак и не шейдеры.');
            }
            record = { directory, name: downloaded.name, sha256: downloaded.sha256, size: downloaded.size, projectId: file.projectID, fileId: file.fileID };
            await atomicJson(path.join(entryDir, 'verified.json'), record);
          } catch (error: any) { throw new Error(`Не удалось установить файл ${id}: ${error.message}. Сборка не завершена; повторите запуск.`); }
        }
        await fs.copyFile(path.join(entryDir, record.name), path.join(stagedMods, record.name));
      }
      if (names.has(record.name.toLowerCase())) throw new Error('Два файла используют одинаковое имя.');
      names.add(record.name.toLowerCase()); records.push(record);
      completed++;
      progress(`Проверка и установка файлов (${completed}/${manifest.files.length})`, completed, manifest.files.length);
    }
    const workers = Array.from({ length: Math.min(4, manifest.files.length) }, async () => {
      while (!installFailed && nextIndex < manifest.files.length) {
        const file = manifest.files[nextIndex++];
        try { await installFile(file); }
        catch (error) { installFailed = true; throw error; }
      }
    });
    const results = await Promise.allSettled(workers);
    const failed = results.find(result => result.status === 'rejected') as PromiseRejectedResult | undefined;
    if (failed) throw failed.reason;
    const overrideFiles: { relative: string; source: string }[] = [];
    const prefix = overrides + '/';
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory || !entry.entryName.startsWith(prefix)) continue;
      const relative = entry.entryName.slice(prefix.length);
      if (!relative) continue;
      if (relative.startsWith('mods/')) {
        const name = safeFileName(relative.slice(5));
        if (names.has(name.toLowerCase())) throw new Error('Мод из overrides дублирует мод манифеста.');
        const source = path.join(extracted, overrides, relative);
        checkedZip(source);
        await fs.copyFile(source, path.join(stagedMods, name));
        records.push({ name, sha256: await fileSha256(source), size: (await fs.stat(source)).size });
        names.add(name.toLowerCase());
      } else overrideFiles.push({ relative, source: path.join(extracted, overrides, relative) });
    }
    await ensureSefiAuthMod(stage);
    const authName = 'sefi-auth-2.0.0.jar';
    const auth = path.join(stagedMods, authName);
    checkedZip(auth);
    if (names.has(authName.toLowerCase())) throw new Error('Сборка содержит собственную копию SEFI Auth.');
    records.push({ name: authName, sha256: await fileSha256(auth), size: (await fs.stat(auth)).size });
    names.add(authName.toLowerCase());
    // All network and archive checks finish before changing the live game directory.
    progress('Применение проверенной сборки');
    const marker = path.join(gameDir, 'modpack-installing.json');
    await atomicJson(marker, { projectId, fileId, startedAt: new Date().toISOString() });
    const backup = await safeDestination(gameDir, 'sefi-backups/mods-' + Date.now() + '-' + randomUUID());
    async function backupFile(relative: string, move: boolean): Promise<void> {
      const file = await safeDestination(gameDir, relative);
      try { if (!(await fs.lstat(file)).isFile()) return; }
      catch (error: any) { if (error.code === 'ENOENT') return; throw error; }
      const saved = path.join(backup, relative);
      await fs.mkdir(path.dirname(saved), { recursive: true });
      if (move) await fs.rename(file, saved); else await fs.copyFile(file, saved);
    }
    for (const file of overrideFiles) {
      const dest = await safeDestination(gameDir, file.relative);
      if (['options.txt','optionsof.txt','servers.dat','servers.dat_old'].includes(file.relative)
        && await fs.access(dest).then(() => true, () => false)) continue;
      await backupFile(file.relative, false);
      await atomicFile(file.source, dest);
    }
    await fs.mkdir(await safeDestination(gameDir, 'mods'), { recursive: true });
    const oldNames = new Map<string, string>();
    if (Array.isArray(previous?.files)) for (const file of previous.files) if (validRecord(file)) oldNames.set(file.name, file.directory || 'mods');
    for (const entry of await fs.readdir(path.join(gameDir, 'mods'), { withFileTypes: true })) {
      if (entry.isFile() && (/^mod-\d+-\d+\.jar$/.test(entry.name) || /^sefi-auth-[0-9][A-Za-z0-9.+_-]*\.jar$/.test(entry.name))) oldNames.set(entry.name, 'mods');
    }
    for (const [name, directory] of oldNames) if (!names.has(name.toLowerCase())) await backupFile(directory + '/' + name, true);
    for (const file of records) {
      const dest = await safeDestination(gameDir, (file.directory || 'mods') + '/' + file.name);
      if (await matches(dest, file)) continue;
      await backupFile((file.directory || 'mods') + '/' + file.name, false);
      await atomicFile(path.join(stagedMods, file.name), dest);
      if (!await matches(dest, file)) throw new Error('Проверка установленного файла не пройдена: ' + file.name);
    }
    const meta: InstallMeta = { schema: 2, version: config.modpack.version, projectId, fileId, files: records, archiveSha256: archive.sha256 };
    await atomicJson(path.join(gameDir, 'modpack-meta.json'), meta);
    await fs.unlink(marker);
    progress('Сборка установлена и проверена', records.length, records.length);
  } finally {
    const resolved = path.resolve(stage);
    if (path.dirname(resolved) === path.resolve(gameDir) && path.basename(resolved).startsWith('.sefi-install-')) {
      await fs.rm(resolved, { recursive: true, force: true });
    }
  }
}

export async function ensureSefiAuthMod(gameDir: string): Promise<void> {
  const modsDir = await safeDestination(gameDir, 'mods');
  await fs.mkdir(modsDir, { recursive: true });
  const name = 'sefi-auth-2.0.0.jar';
  const sources = [path.join(process.resourcesPath || '', 'resources', 'mods', name), path.join(app.getAppPath(), 'resources', 'mods', name)];
  let source: string | undefined;
  for (const candidate of sources) if (await fs.access(candidate).then(() => true, () => false)) { source = candidate; break; }
  if (!source) throw new Error('В установке лаунчера отсутствует SEFI Auth. Переустановите обновлённый лаунчер.');
  await atomicFile(source, await safeDestination(gameDir, 'mods/' + name));
  for (const entry of await fs.readdir(modsDir, { withFileTypes: true })) {
    if (entry.isFile() && /^sefi-auth-[0-9][A-Za-z0-9.+_-]*\.jar$/.test(entry.name) && entry.name !== name) {
      const backup = await safeDestination(gameDir, 'sefi-backups/auth-' + randomUUID());
      await fs.mkdir(backup, { recursive: true });
      await fs.rename(path.join(modsDir, entry.name), path.join(backup, entry.name));
    }
  }
}
