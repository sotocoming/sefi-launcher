import {net, nativeImage} from 'electron';
import {getAccounts} from './accounts';
import type {OfficialSkin} from '../../src/types';

const cache = new Map<string, {expires: number; value: OfficialSkin | null}>();
const pending = new Map<string, Promise<OfficialSkin | null>>();
async function bytes(url: string, max: number): Promise<Buffer> {
  const response = await net.fetch(url, {redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(10000)});
  if (response.status === 204 || response.status === 404) return Buffer.alloc(0);
  if (!response.ok || !response.body) throw new Error('Официальный сервис скинов временно недоступен. Попробуйте ещё раз.');
  const reader = response.body.getReader();
  let length = 0; const parts: Buffer[] = [];
  try {
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      length += value.length;
      if (length > max) throw new Error('Сервис Minecraft вернул слишком большой ответ.');
      parts.push(Buffer.from(value));
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(parts);
}
function textureUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Некорректная текстура Minecraft.');
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== 'textures.minecraft.net'
    || url.username || url.password || url.port || url.search || url.hash || !/^\/texture\/[a-f0-9]{32,64}$/.test(url.pathname)) {
    throw new Error('Некорректный адрес текстуры Minecraft.');
  }
  url.protocol = 'https:'; return url.href;
}
async function png(value: unknown): Promise<string> {
  const raw = await bytes(textureUrl(value), 128 * 1024);
  if (raw.length < 33 || !raw.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('Не удалось загрузить текстуру скина.');
  const width = raw.readUInt32BE(16), height = raw.readUInt32BE(20);
  if (![64,128].includes(width) || ![32,64,128].includes(height) || nativeImage.createFromBuffer(raw).isEmpty()) throw new Error('Некорректный размер скина Minecraft.');
  return raw.toString('base64');
}
async function load(uuid: string): Promise<OfficialSkin | null> {
  const raw = await bytes('https://sessionserver.mojang.com/session/minecraft/profile/' + uuid, 64 * 1024);
  if (!raw.length) return null;
  const profile = JSON.parse(raw.toString('utf8'));
  if (profile.id?.replace(/-/g, '').toLowerCase() !== uuid) throw new Error('Сервис Minecraft вернул другой профиль.');
  const property = profile.properties?.find((p: any) => p.name === 'textures');
  if (!property) return null;
  if (typeof property.value !== 'string' || property.value.length > 48000) throw new Error('Некорректные данные скина Minecraft.');
  const data = JSON.parse(Buffer.from(property.value, 'base64').toString('utf8'));
  if (!data.textures?.SKIN) return null;
  const skin = data.textures.SKIN;
  const result: OfficialSkin = {png: await png(skin.url), model: skin.metadata?.model === 'slim' ? 'slim' : 'classic'};
  if (data.textures.CAPE?.url) result.cape = await png(data.textures.CAPE.url).catch(() => undefined);
  return result;
}
export async function getOfficialSkin(id: string, refresh = false): Promise<OfficialSkin | null> {
  if (typeof id !== 'string' || id.length > 128 || typeof refresh !== 'boolean') throw new Error('Выберите профиль Minecraft.');
  const account = (await getAccounts()).find(a => a.id === id);
  const uuid = (account?.type === 'microsoft' ? account.uuid : account?.mcVerifiedAt ? account.mcUuid : '')?.replace(/-/g, '').toLowerCase();
  if (!uuid || !/^[a-f0-9]{32}$/.test(uuid)) throw new Error('Подтвердите профиль Minecraft Java для просмотра официального скина.');
  const saved = cache.get(uuid); if (!refresh && saved && saved.expires > Date.now()) return saved.value;
  const inFlight = pending.get(uuid); if (inFlight) return inFlight;
  const job = load(uuid).then(value => { if (cache.size >= 32) cache.delete(cache.keys().next().value!); cache.set(uuid, {expires: Date.now() + 60000, value}); return value; })
    .catch(() => { throw new Error('Не удалось загрузить официальный скин. Проверьте подключение и попробуйте ещё раз.'); })
    .finally(() => pending.delete(uuid));
  pending.set(uuid, job); return job;
}
