import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import * as nbt from 'prismarine-nbt';

export interface ServerEntry { id?: string; name: string; ip: string; acceptTextures?: boolean; }
const canonical = (value: string) => value.trim().toLowerCase().replace(/:25565$/, '');

/** Update SEFI-managed entries together; retain all unrelated servers and NBT data. */
export async function ensureServersInServersDat(gameDirectory: string, entries: ServerEntry[]): Promise<void> {
  const file = path.join(gameDirectory, 'servers.dat');
  await fs.mkdir(gameDirectory, { recursive: true });
  let raw: Buffer | undefined;
  let root: any = { type: 'compound', name: '', value: {} };
  try { raw = await fs.readFile(file); }
  catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  if (raw) {
    try { root = (await nbt.parse(raw)).parsed; }
    catch { throw new Error('Не удалось прочитать список серверов Minecraft. Существующий файл сохранён.'); }
  }
  if (!root?.value || (root.value.servers && !Array.isArray(root.value.servers?.value?.value))) {
    throw new Error('Неизвестный формат списка серверов Minecraft. Существующий файл сохранён.');
  }
  let list: any[] = root.value.servers?.value?.value || [];
  const ids = new Set(entries.map(e => e.id || 'primary'));
  list = list.filter(item => !item.sefiEndpointId || ids.has(item.sefiEndpointId.value));
  const managed: any[] = [];
  for (const entry of entries) {
    const id = entry.id || 'primary';
    const index = list.findIndex(item => item.sefiEndpointId?.value === id || canonical(item.ip?.value || '') === canonical(entry.ip) || (!item.sefiEndpointId && (item.name?.value || '').toLowerCase() === entry.name.toLowerCase()));
    const item: any = index >= 0 ? list.splice(index, 1)[0] : {};
    item.name = { type: 'string', value: entry.name };
    item.ip = { type: 'string', value: entry.ip };
    item.sefiEndpointId = { type: 'string', value: id };
    if (!item.acceptTextures) item.acceptTextures = { type: 'byte', value: 1 };
    managed.push(item);
  }
  root.value.servers = { type: 'list', value: { type: 'compound', value: [...managed, ...list] } };
  const output = nbt.writeUncompressed(root);
  const temp = file + '.' + randomUUID() + '.tmp';
  try {
    await fs.writeFile(temp, output, { flag: 'wx' });
    if (raw) await fs.writeFile(file + '.sefi-backup', raw);
    await fs.rename(temp, file);
  } finally { await fs.unlink(temp).catch(() => {}); }
}

export async function ensureServerInServersDat(gameDirectory: string, serverName: string, serverAddress: string): Promise<void> {
  return ensureServersInServersDat(gameDirectory, [{ id: 'primary', name: serverName, ip: serverAddress }]);
}
