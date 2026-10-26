import fs from 'fs/promises';
import path from 'path';
import {createHash, randomUUID} from 'crypto';
import {app} from 'electron';
import {atomicWrite} from './atomic-files';
import {checkedZip, fileSha256} from './modpack-download';
import manifest from '../../resources/localization/manifest.json';
import type {LauncherConfig} from '../../src/types';

const pending = new Map<string, Promise<void>>();
const digest = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const pack = 'file/SEFI-Russian-1.0.0.zip';

async function destination(root: string, relative: string): Promise<string> {
  if (!relative || relative.includes('\\') || relative.includes(':') || relative.startsWith('/')
    || relative.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Небезопасный путь перевода.');
  let current = path.resolve(root);
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    try { if ((await fs.lstat(current)).isSymbolicLink()) throw new Error('Установка перевода через ссылки запрещена.'); }
    catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  }
  return current;
}

export function ensureRussianLocalization(gameDir: string, config: LauncherConfig): Promise<void> {
  const root = path.resolve(gameDir);
  const existing = pending.get(root);
  if (existing) return existing;
  const job = install(root, config).finally(() => pending.delete(root));
  pending.set(root, job);
  return job;
}

async function install(root: string, config: LauncherConfig): Promise<void> {
  if (config.modpack.curseforgeProjectId !== manifest.projectId || config.modpack.curseforgeFileId !== manifest.fileId
    || (config.modpack.sha256 && config.modpack.sha256.toLowerCase() !== manifest.modpackSha256)) {
    throw new Error('Русский перевод не проверен для этой версии сборки. Обновите лаунчер перед запуском.');
  }
  const candidates = [...(process.resourcesPath ? [path.join(process.resourcesPath, 'resources/localization', manifest.archive)] : []),
    path.join(app.getAppPath(), 'resources/localization', manifest.archive)];
  let source: string | undefined;
  for (const candidate of candidates) if (await fs.access(candidate).then(() => true, () => false)) { source = candidate; break; }
  if (!source || await fileSha256(source) !== manifest.archiveSha256) throw new Error('Пакет русского перевода отсутствует или повреждён. Переустановите лаунчер.');
  const zip = checkedZip(source);
  const changes: {relative: string; target: string; data: Buffer; old: Buffer | null}[] = [];
  // Read and verify the entire payload before touching the game directory.
  for (const file of manifest.files) {
    const data = zip.readFile(file.path);
    if (!data || data.length !== file.size || digest(data) !== file.sha256) throw new Error('Повреждён файл перевода: ' + file.path);
    const target = await destination(root, file.path);
    let old: Buffer | null = null;
    try { old = await fs.readFile(target); } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
    if (old && digest(old) === file.sha256) continue;
    if (old && !file.previous.includes(digest(old))) {
      throw new Error('Файл отличается от проверенной сборки: ' + file.path + '. Сохраните свои изменения и восстановите этот файл перед установкой перевода.');
    }
    changes.push({relative: file.path, target, data, old});
  }
  const receipt = await destination(root, 'sefi-localization.json');
  const firstInstall = !await fs.access(receipt).then(() => true, () => false);
  if (firstInstall) {
    const target = await destination(root, 'options.txt');
    let old: Buffer | null = null;
    try { old = await fs.readFile(target); } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
    const lines = old?.toString('utf8').split(/\r?\n/).filter(Boolean) || [];
    const values = new Map(lines.map(line => { const at = line.indexOf(':'); return [line.slice(0, at), line.slice(at + 1)]; }));
    let active: unknown;
    try { active = JSON.parse(values.get('resourcePacks') || '[]'); } catch { throw new Error('Не удалось прочитать список ресурс-паков в options.txt. Исправьте его перед установкой перевода.'); }
    if (!Array.isArray(active) || !active.every(x => typeof x === 'string')) throw new Error('Некорректный список ресурс-паков в options.txt.');
    values.set('resourcePacks', JSON.stringify([...active.filter(x => !x.startsWith('file/SEFI-Russian-')), pack]));
    // Enable once; subsequent launches preserve language and resource-pack choices.
    values.set('lang', 'ru_ru');
    const data = Buffer.from([...values].map(([key, value]) => key + ':' + value).join('\n') + '\n');
    if (!old || !old.equals(data)) changes.push({relative: 'options.txt', target, data, old});
  }
  if (!changes.length && !firstInstall) return;
  const backup = 'sefi-backups/localization/launcher-' + Date.now() + '-' + randomUUID();
  const journal = await destination(root, backup + '/manifest.json');
  const record = {version: manifest.version, archiveSha256: manifest.archiveSha256, state: 'prepared',
    files: changes.map(c => ({path: c.relative, existed: !!c.old, originalSha256: c.old ? digest(c.old) : null, installedSha256: digest(c.data)}))};
  for (const change of changes) if (change.old) await atomicWrite(await destination(root, backup + '/originals/' + change.relative), change.old);
  await atomicWrite(journal, JSON.stringify(record, null, 2));
  const written: typeof changes = [];
  try {
    for (const change of changes) { await atomicWrite(change.target, change.data); written.push(change); }
    record.state = 'installed';
    await atomicWrite(journal, JSON.stringify(record, null, 2));
    await atomicWrite(receipt, JSON.stringify({version: manifest.version, archiveSha256: manifest.archiveSha256, backup}, null, 2));
  } catch (error) {
    for (const change of written.reverse()) {
      if (change.old) await atomicWrite(change.target, change.old); else await fs.unlink(change.target);
    }
    record.state = 'rolled_back';
    await atomicWrite(journal, JSON.stringify(record, null, 2));
    throw error;
  }
}
