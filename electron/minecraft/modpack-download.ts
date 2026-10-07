import { requestDownload } from './download-http';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import path from 'path';
import { createHash, randomUUID } from 'crypto';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { setTimeout as delay } from 'timers/promises';

const AdmZip = require('adm-zip');
const MAX_DOWNLOAD = 512 * 1024 * 1024;

export function safeFileName(name: string, extension = '.jar'): string {
  if (!name || name.length > 200 || /[<>:"/\\|?*\x00-\x1f\x7f]/.test(name)
    || /[. ]$/.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)
    || !(extension === '.mod' ? /\.(jar|zip)$/i.test(name) : name.toLowerCase().endsWith(extension))) throw new Error('Источник вернул недопустимое имя файла.');
  return name;
}

function trustedUrl(value: string): URL {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')
    || !(host === 'www.curseforge.com' || host === 'forgecdn.net' || host.endsWith('.forgecdn.net'))) {
    throw new Error('Загрузка разрешена только с CurseForge и его CDN по HTTPS.');
  }
  return url;
}

export async function fileSha256(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export function checkedZip(file: string): any {
  const zip = new AdmZip(file);
  const entries = zip.getEntries();
  if (!entries.length || entries.length > 100000) throw new Error('Недопустимый состав архива.');
  let expanded = 0;
  for (const entry of entries) {
    const name = entry.entryName;
    const mode = (entry.header.attr >>> 16) & 0o170000;
    if (typeof name !== 'string' || name.includes('\\') || name.startsWith('/') || name.includes(':')
      || name.split('/').some((part: string) => part === '..' || part === '.')
      || /[\x00-\x1f]/.test(name) || mode === 0o120000) throw new Error('Небезопасный путь внутри архива.');
    const size = entry.header.size;
    if (!Number.isSafeInteger(size) || size < 0 || size > MAX_DOWNLOAD) throw new Error('Недопустимый размер файла в архиве.');
    expanded += size;
    if (expanded > 2 * 1024 * 1024 * 1024) throw new Error('Архив превышает допустимый размер распаковки.');
  }
  if (!zip.test()) throw new Error('Архив повреждён: проверка содержимого/CRC не пройдена.');
  return zip;
}

export async function downloadArchive(url: string, directory: string, extension: '.jar' | '.zip' | '.mod',
  onProgress?: (downloaded: number, total: number) => void,
  expectedSha256?: string): Promise<{ name: string; file: string; sha256: string; size: number }> {
  const original = trustedUrl(url);
  const hosts = expectedSha256 && ['edge.forgecdn.net', 'mediafilez.forgecdn.net', 'media.forgecdn.net'].includes(original.hostname)
    ? [...new Set([original.hostname, 'mediafilez.forgecdn.net', 'media.forgecdn.net'])] : [original.hostname];
  for (let attempt = 0; ; attempt++) {
    const source = new URL(original.href);
    source.hostname = hosts[Math.min(attempt, hosts.length - 1)];
    try { return await downloadAttempt(source.href, directory, extension, onProgress, expectedSha256); }
    catch (error: any) {
      const transient = error?.message === 'fetch failed' || error?.name === 'TimeoutError' || error?.downloadTransient === true
        || /HTTP (429|5[0-9]{2})/.test(error?.message || '')
        || (error?.httpStatus === 403 && typeof error?.downloadHost === 'string'
          && (error.downloadHost === 'forgecdn.net' || error.downloadHost.endsWith('.forgecdn.net')));
      if (!transient || attempt >= 2) {
        if (error?.name === 'TimeoutError') throw new Error('Источник загрузки не ответил вовремя. Уже проверенные файлы сохранены; повторите запуск.');
        throw error;
      }
      await delay(300 * (2 ** attempt));
    }
  }
}

async function downloadAttempt(url: string, directory: string, extension: '.jar' | '.zip' | '.mod',
  onProgress?: (downloaded: number, total: number) => void,
  expectedSha256?: string): Promise<{ name: string; file: string; sha256: string; size: number }> {
  let current = trustedUrl(url);
  let response: Response | undefined;
  const controller = new AbortController();
  const signal = controller.signal;
  const timedOut = () => controller.abort(Object.assign(new Error('Источник загрузки не ответил вовремя.'), { name: 'TimeoutError' }));
  let idleTimer = setTimeout(timedOut, 90000);
  const totalTimer = setTimeout(timedOut, 15 * 60 * 1000);
  const activity = () => { clearTimeout(idleTimer); idleTimer = setTimeout(timedOut, 90000); };
  try {
    for (let redirects = 0; redirects <= 5; redirects++) {
      response = await requestDownload(current.href, signal);
      activity();
      if ([301,302,303,307,308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location || redirects === 5) throw new Error('Некорректное перенаправление загрузки.');
        current = trustedUrl(new URL(location, current).href);
        continue;
      }
      break;
    }
    if (!response?.ok || !response.body) {
      await response?.body?.cancel();
      const source = `${current.hostname}${current.pathname}`;
      throw Object.assign(new Error(`Источник загрузки отказал (HTTP ${response?.status}). Файл: ${source}.`
        + (response?.status === 403 ? ' Если файл скачивается в браузере, скопируйте эту ошибку и сообщите администратору.' : ' Повторите установку.')), { httpStatus: response?.status, downloadHost: current.hostname });
    }
    let name: string;
    try { name = safeFileName(decodeURIComponent(current.pathname.split('/').pop() || ''), extension); }
    catch (error) { await response.body.cancel(); throw error; }
    const length = response.headers.get('content-length');
    const expectedLength = length === null ? null : Number(length);
    if (expectedLength !== null && (!Number.isSafeInteger(expectedLength) || expectedLength < 1 || expectedLength > MAX_DOWNLOAD)) {
      await response.body.cancel(); throw new Error('Недопустимый размер загрузки.');
    }
    if (expectedSha256 && !/^[a-f0-9]{64}$/i.test(expectedSha256)) {
      await response.body.cancel(); throw new Error('Недопустимая контрольная сумма сборки.');
    }
    await fs.mkdir(directory, { recursive: true });
    const temp = path.join(directory, `.download-${randomUUID()}.part`);
    const dest = path.join(directory, name);
    let size = 0;
    const hash = createHash('sha256');
    const counter = new Transform({ transform(chunk, _encoding, callback) {
      activity();
      size += chunk.length;
      if (size > MAX_DOWNLOAD) return callback(new Error('Загрузка превышает допустимый размер.'));
      hash.update(chunk); onProgress?.(size, expectedLength || 0); callback(null, chunk);
    }});
    try {
      await pipeline(Readable.fromWeb(response.body as any), counter, createWriteStream(temp, { flags: 'wx' }));
      if (!size || (expectedLength !== null && !response.headers.get('content-encoding') && size !== expectedLength)) {
        throw new Error('Загрузка оборвалась: размер файла не совпадает.');
      }
      const sha256 = hash.digest('hex');
      if (expectedSha256 && sha256 !== expectedSha256.toLowerCase()) throw new Error('Контрольная сумма сборки не совпадает.');
      checkedZip(temp);
      await fs.rename(temp, dest);
      return { name, file: dest, sha256, size };
    } finally { await fs.unlink(temp).catch(() => {}); }
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    throw error;
  } finally { clearTimeout(idleTimer); clearTimeout(totalTimer); }
}

