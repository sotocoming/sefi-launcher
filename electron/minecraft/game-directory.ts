import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export function normalizeGameDirectory(directory: string): string {
  if (typeof directory !== 'string' || !directory.trim() || !path.isAbsolute(directory.trim())) {
    throw new Error('Выберите полный путь к папке игры в настройках.');
  }
  const resolved = path.resolve(directory.trim());
  const root = path.parse(resolved).root;
  // Never use a drive/share root as the game directory, including legacy settings.
  return resolved.toLowerCase() === root.toLowerCase() ? path.join(root, 'SEFI Minecraft') : resolved;
}

export async function prepareGameDirectory(directory: string): Promise<string> {
  const resolved = normalizeGameDirectory(directory);
  const root = path.parse(resolved).root;
  const probe = path.join(resolved, '.sefi-write-test-' + randomUUID());
  try {
    // mkdir(D:\, {recursive:true}) fails on Windows even for an existing drive.
    if (!(await fs.stat(root)).isDirectory()) throw new Error('Диск недоступен.');
    try {
      if (!(await fs.stat(resolved)).isDirectory()) throw Object.assign(new Error('Это файл, а не папка.'), {code:'ENOTDIR'});
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
      await fs.mkdir(resolved, { recursive: true });
    }
    await fs.writeFile(probe, 'SEFI', { flag: 'wx' });
    await fs.unlink(probe);
    return resolved;
  } catch (error: any) {
    const explanation = ['EPERM','EACCES'].includes(error.code) ? 'Нет доступа для записи.'
      : error.code === 'ENOENT' ? 'Диск или папка недоступны.'
      : error.code === 'ENOSPC' ? 'На диске закончилось место.'
      : error.code === 'ENOTDIR' ? 'Указанный путь является файлом.' : 'Не удалось подготовить папку игры.';
    throw new Error(explanation + '\nПапка: ' + resolved + '\nОткройте «Настройки → Java и пути → Папка установки клиента» и выберите другую доступную папку.\nПодробности: ' + (error.code || error.message));
  } finally { await fs.unlink(probe).catch(() => {}); }
}
