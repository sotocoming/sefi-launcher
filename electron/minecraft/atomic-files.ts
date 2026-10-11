import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import { createHash, randomUUID } from 'crypto';
import { setTimeout as delay } from 'timers/promises';

export async function renameFile(source: string, destination: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try { await fs.rename(source, destination); return; }
    catch (error: any) {
      if (!['EPERM','EACCES','EBUSY'].includes(error.code) || attempt >= 5) throw error;
      await delay(150 * (attempt + 1));
    }
  }
}
async function digest(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
export async function atomicWrite(file: string, content: string | Uint8Array): Promise<void> {
  await fs.mkdir(path.dirname(file), {recursive:true});
  const temp = file + '.' + randomUUID() + '.tmp';
  try {
    const handle = await fs.open(temp, 'wx', 0o600);
    try { await handle.writeFile(content, 'utf8'); await handle.sync(); }
    finally { await handle.close(); }
    await renameFile(temp, file);
  } finally { await fs.unlink(temp).catch(() => {}); }
}
export async function installFile(source: string, destination: string): Promise<boolean> {
  try {
    const [a,b] = await Promise.all([fs.stat(source),fs.lstat(destination)]);
    if (b.isSymbolicLink()) throw new Error('Установка через символические ссылки запрещена.');
    if (b.isFile() && a.size === b.size && await digest(source) === await digest(destination)) return false;
  } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  await fs.mkdir(path.dirname(destination), {recursive:true});
  const temp = destination + '.' + randomUUID() + '.tmp';
  try { await fs.copyFile(source,temp,fs.constants.COPYFILE_EXCL); await renameFile(temp,destination); return true; }
  catch(error: any) {
    if (['EPERM','EACCES','EBUSY'].includes(error.code)) throw new Error('Файл игры занят или недоступен: ' + path.basename(destination) + '. Закройте все окна Minecraft и повторите запуск. Если ошибка остаётся, проверьте доступ к папке игры и журнал блокировок антивируса.');
    throw error;
  } finally { await fs.unlink(temp).catch(() => {}); }
}
