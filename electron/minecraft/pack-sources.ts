import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import catalog from './modpack-catalog.json';
import modrinth from './modrinth-sources.json';
import { checkedZip, downloadArchive, fileSha256, safeFileName } from './modpack-download';

const MIRROR = 'https://mc.sotocoming.ru/api/public/community/download-mirror/';
type File = { url: string; sha256: string; size?: number };
export type ObtainedFile = { name: string; file: string; sha256: string; size: number };

export async function canonicalPack(gameDir: string, selected?: string): Promise<ObtainedFile | null> {
  const directory = path.join(gameDir, '.sefi-pack-cache');
  try { if ((await fs.lstat(directory)).isSymbolicLink()) throw new Error('Кеш сборки не может быть ссылкой.'); }
  catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  const target = path.join(directory, `${catalog.projectId}-${catalog.fileId}.zip`);
  const source = selected || target;
  try {
    const stat = await fs.lstat(source);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > 512 * 1024 * 1024) throw new Error('Неверный файл сборки.');
    if (await fileSha256(source) !== catalog.archive.sha256) throw new Error('Архив не соответствует Homestead 1.3.7 для этого сервера. Выберите официальный ZIP без изменений.');
    const zip = checkedZip(source);
    const manifest = JSON.parse(zip.readAsText('manifest.json'));
    if (manifest.minecraft?.version !== '1.20.1' || !manifest.minecraft?.modLoaders?.some((loader: any) => loader.id === 'fabric-0.18.4')
      || manifest.version !== '1.3.7') throw new Error('Версия Minecraft, Fabric или сборки не подходит серверу.');
    const expected = Object.keys(catalog.files).sort();
    const actual = manifest.files.map((file: any) => `${file.projectID}:${file.fileID}`).sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('Состав модов не соответствует серверу.');
    if (selected) {
      await fs.mkdir(directory, { recursive: true });
      const temp = path.join(directory, randomUUID() + '.part');
      try {
        await fs.copyFile(source, temp);
        if (await fileSha256(temp) !== catalog.archive.sha256) throw new Error('Архив изменился при копировании.');
        await fs.rename(temp, target);
      } finally { await fs.unlink(temp).catch(() => {}); }
    }
    return { file: target, name: 'Homestead-1.3.7.zip', sha256: catalog.archive.sha256, size: stat.size };
  } catch (error: any) {
    if (!selected && (error.code === 'ENOENT' || !['EACCES', 'EPERM'].includes(error.code))) return null;
    throw error;
  }
}

export async function communityDownloadToken(): Promise<string | undefined> {
  const { getAccounts } = await import('./accounts');
  const accounts = await getAccounts();
  return accounts.find(account => account.active && account.communityToken)?.communityToken;
}

export async function obtainFile(key: string, source: File, directory: string, extension: '.zip' | '.mod',
  token?: string, onProgress?: (downloaded: number, total: number) => void): Promise<ObtainedFile> {
  const name = safeFileName(decodeURIComponent(new URL(source.url).pathname.split('/').pop() || ''), extension);
  const candidates = [...((modrinth as Record<string, string[]>)[key] || []).map(url => ({ url, label: 'Modrinth' })),
    { url: source.url, label: 'CurseForge' },
    ...(token ? [{ url: MIRROR + source.sha256 + '/' + encodeURIComponent(name), label: 'SEFI' }] : [])];
  const failures: string[] = [];
  for (const candidate of candidates) {
    try {
      const downloaded = await downloadArchive(candidate.url, directory, extension, onProgress, source.sha256,
        candidate.label === 'SEFI' ? token : undefined);
      if (source.size && downloaded.size !== source.size) throw new Error('Размер файла не совпадает с каталогом.');
      if (downloaded.name !== name) {
        await fs.rename(downloaded.file, path.join(directory, name));
        downloaded.name = name; downloaded.file = path.join(directory, name);
      }
      return downloaded;
    } catch (error: any) {
      if (['ENOSPC', 'EACCES', 'EPERM'].includes(error.code)) throw error;
      failures.push(`${candidate.label}: ${error.message}`);
    }
  }
  throw new Error(`Не удалось загрузить ${name}. ${failures.join(' | ')}`);
}
