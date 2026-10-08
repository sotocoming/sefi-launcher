import { app, BrowserWindow, dialog, nativeImage } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { getAccounts } from './accounts';
import type { CommunitySkin, SkinDraft } from '../../src/types';

const production = 'https://mc.sotocoming.ru';
export function skinApiOrigin(): string {
  const local = process.env.SEFI_SKINS_API;
  if (!app.isPackaged && local) {
    const url = new URL(local);
    if (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && url.origin === local) return local;
    throw new Error('Тестовый сервис скинов должен работать на localhost.');
  }
  return production;
}
async function request(accountId: string, body?: object): Promise<CommunitySkin | null> {
  const account = (await getAccounts()).find(a => a.id === accountId);
  if (!account || account.type === 'microsoft' || account.mcType === 'microsoft' || account.mcVerifiedAt) {
    throw new Error('Скин лицензии меняется на Minecraft.net.');
  }
  if (!account.communityToken) throw new Error('Войдите в SEFI Community для синхронизации скина.');
  const response = await fetch(skinApiOrigin() + '/api/public/community/skin', {
    method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', 'X-Community-Token': account.communityToken },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (response.status === 404) throw new Error('Сервис скинов недоступен. Попробуйте ещё раз позже.');
  const raw = await response.text();
  if (raw.length > 100000) throw new Error('Некорректный ответ сервиса скинов.');
  const data = JSON.parse(raw) as {skin?: CommunitySkin | null; error?: string};
  if (!response.ok) throw new Error(data.error || 'Не удалось сохранить скин.');
  if (data.skin && (!/^[A-Za-z0-9+/=]+$/.test(data.skin.png) || data.skin.png.length > 88000
      || !['classic', 'slim'].includes(data.skin.model) || !/^[a-f0-9]{64}$/.test(data.skin.sha256))) {
    throw new Error('Некорректный скин в ответе сервера.');
  }
  return data.skin || null;
}
export const getCommunitySkin = (id: string) => request(id);
export const saveCommunitySkin = (id: string, png: string, model: 'classic' | 'slim') => {
  if (typeof png !== 'string' || png.length > 88000 || !['classic', 'slim'].includes(model)) throw new Error('Некорректный скин.');
  return request(id, { png, model });
};
export const resetCommunitySkin = (id: string) => request(id, { reset: true });
export async function chooseSkin(window: BrowserWindow): Promise<SkinDraft | null> {
  const choice = await dialog.showOpenDialog(window, { title: 'Выберите скин Minecraft', properties: ['openFile'],
    filters: [{ name: 'Скин Minecraft PNG 64 × 64', extensions: ['png'] }] });
  if (choice.canceled || !choice.filePaths[0]) return null;
  const file = choice.filePaths[0];
  if ((await fs.stat(file)).size > 65536) throw new Error('Выберите PNG не больше 64 КБ.');
  const raw = await fs.readFile(file);
  if (!raw.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('Нужен файл PNG.');
  // Check dimensions before decoding arbitrary user files.
  if (raw.length < 33 || raw.readUInt32BE(16) !== 64 || raw.readUInt32BE(20) !== 64) throw new Error('Нужен скин PNG 64 × 64.');
  const image = nativeImage.createFromBuffer(raw);
  if (image.isEmpty() || image.getSize().width !== 64 || image.getSize().height !== 64) throw new Error('Не удалось открыть PNG.');
  const png = image.toPNG();
  if (png.length > 65536) throw new Error('PNG слишком большой.');
  return { png: png.toString('base64'), filename: path.basename(file) };
}
