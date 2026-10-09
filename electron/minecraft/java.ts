import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomUUID, createHash } from 'crypto';
import { createWriteStream } from 'fs';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { setTimeout as delay } from 'timers/promises';
import type { DownloadProgress, JavaStatus } from '../../src/types';
import { requestDownload } from './download-http';
import { checkedZip } from './modpack-download';

const execFileAsync = promisify(execFile);
// SEFI uses the latest stable patch in the Java 21 LTS line.
export const REQUIRED_JAVA = 21;
const MAX_ARCHIVE = 256 * 1024 * 1024;
let pending: Promise<string> | undefined;

function runtimeDirectory(): string {
  return path.join(app.getPath('userData'), 'runtimes', 'java-21-' + process.platform + '-' + process.arch);
}
function probeExecutable(executable: string): string {
  return process.platform === 'win32' && /javaw\.exe$/i.test(executable)
    ? path.join(path.dirname(executable), 'java.exe') : executable;
}
export async function inspectJava(executable: string, ramMax?: number): Promise<{ version: string; architecture: string }> {
  if (!path.isAbsolute(executable)) throw new Error('Выберите полный путь к исполняемому файлу Java.');
  try { await fs.access(executable); } catch { throw new Error('Файл Java не найден. Выберите «Java SEFI» в настройках.'); }
  const args = ['-XshowSettings:properties', '-version'];
  if (ramMax !== undefined) {
    if (!Number.isInteger(ramMax) || ramMax < 512 || ramMax > 32768) throw new Error('Некорректный объём памяти для Java.');
    args.unshift('-Xms32M', '-Xmx' + ramMax + 'M');
  }
  let output: string;
  try {
    const result = await execFileAsync(probeExecutable(executable), args, { timeout: 15000, windowsHide: true, maxBuffer: 128 * 1024 });
    output = result.stdout + result.stderr;
  } catch (error: any) {
    const detail = String(error?.stderr || error?.message || error).slice(0, 1500);
    throw new Error('Java не прошла пробный запуск. ' + detail + '\nВыберите «Java SEFI» в настройках или уменьшите выделенную память.');
  }
  const version = output.match(/(?:java|openjdk) version "([^"\s]+)"/)?.[1];
  const architecture = output.match(/os\.arch\s*=\s*(\S+)/)?.[1];
  const bits = output.match(/sun\.arch\.data\.model\s*=\s*(\d+)/)?.[1];
  if (!version || Number(version.split('.')[0]) !== REQUIRED_JAVA) throw new Error('Для этой сборки нужна Java 21. Выберите «Java SEFI» в настройках. Найдена: ' + (version || 'неизвестная версия') + '.');
  if (bits !== '64' || !architecture || !['amd64', 'x86_64', 'aarch64', 'arm64'].includes(architecture)) throw new Error('Для сборки нужна 64-битная Java 21. Выберите «Java SEFI» в настройках.');
  if (process.arch === 'x64' && !['amd64', 'x86_64'].includes(architecture)) throw new Error('Архитектура Java не подходит этому лаунчеру. Выберите «Java SEFI».');
  return { version, architecture };
}

async function installedJava(): Promise<string | null> {
  const directory = runtimeDirectory();
  try {
    const names = await fs.readdir(directory);
    for (const name of names) {
      const executable = path.join(directory, name, 'bin', 'java.exe');
      try { await inspectJava(executable); return executable; } catch { /* repair at next launch */ }
    }
  } catch { /* first install */ }
  return null;
}

export async function getJavaStatus(customPath = ''): Promise<JavaStatus> {
  if (customPath.trim()) {
    try { const info = await inspectJava(customPath.trim()); return { status: 'ready', source: 'custom', path: customPath.trim(), ...info }; }
    catch (error) { return { status: 'error', source: 'custom', message: error instanceof Error ? error.message : String(error) }; }
  }
  const executable = await installedJava();
  if (!executable) return { status: 'missing', source: 'managed', message: 'Java 21 скачается автоматически при запуске игры.' };
  try { const info = await inspectJava(executable); return { status: 'ready', source: 'managed', path: executable, ...info }; }
  catch (error) { return { status: 'error', source: 'managed', message: String(error) }; }
}

export function trustedJavaUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')
    || !(url.hostname === 'api.adoptium.net'
      || (url.hostname === 'github.com' && url.pathname.startsWith('/adoptium/temurin21-binaries/releases/download/'))
      || ['release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(url.hostname))) {
    throw new Error('Недопустимый источник Java.');
  }
  return url;
}
async function javaResponse(url: string, signal: AbortSignal): Promise<Response> {
  let current = trustedJavaUrl(url);
  for (let redirects = 0; redirects <= 5; redirects++) {
    const response = await requestDownload(current.href, signal);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location || redirects === 5) throw new Error('Некорректное перенаправление загрузки Java.');
      current = trustedJavaUrl(new URL(location, current).href);
      continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error('Источник Java ответил HTTP ' + response.status + '. Повторите запуск позже.'); }
    return response;
  }
  throw new Error('Не удалось загрузить Java.');
}

export function selectJavaPackage(assets: any, architecture: string): { link: string; checksum: string; size: number } {
  if (!Array.isArray(assets)) throw new Error('Источник вернул некорректный каталог Java.');
  const asset = assets.find(a => a?.binary?.os === 'windows' && a.binary.architecture === architecture
    && a.binary.jvm_impl === 'hotspot' && a.binary.image_type === 'jre' && a.version?.major === REQUIRED_JAVA);
  const pkg = asset?.binary?.package;
  if (!pkg || !/^[a-f0-9]{64}$/i.test(pkg.checksum) || !Number.isSafeInteger(pkg.size)
    || pkg.size < 1 || pkg.size > MAX_ARCHIVE || typeof pkg.link !== 'string' || !pkg.link.endsWith('.zip')) {
    throw new Error('Для этой системы не найден подходящий архив Java 21.');
  }
  trustedJavaUrl(pkg.link);
  return pkg;
}

async function renameRuntime(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try { await fs.rename(from, to); return; }
    catch (error: any) {
      // Windows antivirus/indexing can hold freshly extracted files briefly.
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code) || attempt >= 5) throw error;
      await delay(200 * (attempt + 1));
    }
  }
}

async function installJava(onProgress?: (p: DownloadProgress) => void): Promise<string> {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Автоустановка Java SEFI пока доступна для Windows x64. Выберите свою 64-битную Java 21 в настройках.');
  const directory = runtimeDirectory();
  const parent = path.dirname(directory);
  await fs.mkdir(parent, { recursive: true });
  const temp = await fs.mkdtemp(path.join(parent, '.java-install-'));
  const archive = path.join(temp, 'runtime.zip');
  const extracted = path.join(temp, 'extracted');
  const report = (task: string, downloaded = 0, total = 100) => onProgress?.({ stage: 'java', task, downloaded, total, percentage: total > 0 ? downloaded / total * 100 : 0 });
  const controller = new AbortController();
  let idle = setTimeout(() => controller.abort(new Error('Загрузка Java не ответила вовремя. Повторите запуск.')), 90000);
  const deadline = setTimeout(() => controller.abort(new Error('Загрузка Java заняла слишком много времени. Повторите запуск.')), 15 * 60 * 1000);
  const activity = () => { clearTimeout(idle); idle = setTimeout(() => controller.abort(new Error('Загрузка Java прервалась. Повторите запуск.')), 90000); };
  try {
    report('Подбор Java 21 для SEFI');
    const response = await javaResponse('https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&image_type=jre&os=windows&vendor=eclipse', controller.signal);
    const bytes: Uint8Array[] = []; let length = 0;
    if (!response.body) throw new Error('Источник вернул пустой каталог Java.');
    for await (const chunk of Readable.fromWeb(response.body as any)) {
      activity(); length += chunk.length;
      if (length > 2 * 1024 * 1024) throw new Error('Каталог Java превышает допустимый размер.');
      bytes.push(chunk);
    }
    const pkg = selectJavaPackage(JSON.parse(Buffer.concat(bytes).toString('utf8')), 'x64');
    report('Скачивание Java 21 для SEFI', 0, pkg.size);
    const binary = await javaResponse(pkg.link, controller.signal);
    if (!binary.body) throw new Error('Источник вернул пустой архив Java.');
    const hash = createHash('sha256'); let downloaded = 0;
    await pipeline(Readable.fromWeb(binary.body as any), new Transform({ transform(chunk, _encoding, callback) {
      activity(); downloaded += chunk.length;
      if (downloaded > pkg.size || downloaded > MAX_ARCHIVE) return callback(new Error('Недопустимый размер архива Java.'));
      hash.update(chunk); report('Скачивание Java 21 для SEFI', downloaded, pkg.size); callback(null, chunk);
    } }), createWriteStream(archive, { flags: 'wx' }), { signal: controller.signal });
    if (downloaded !== pkg.size || hash.digest('hex') !== pkg.checksum.toLowerCase()) throw new Error('Архив Java повреждён: проверка SHA256 не пройдена. Повторите запуск.');
    report('Распаковка и проверка Java 21');
    await fs.mkdir(extracted);
    const zip = checkedZip(archive);
    zip.extractAllTo(extracted, false);
    const names = await fs.readdir(extracted);
    if (names.length !== 1) throw new Error('Некорректная структура архива Java.');
    const executable = path.join(extracted, names[0], 'bin', 'java.exe');
    await inspectJava(executable);
    // Keep the previous installation until the replacement has passed its probe.
    const backup = directory + '.previous-' + randomUUID();
    let moved = false;
    try { await renameRuntime(directory, backup); moved = true; } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
    try { await renameRuntime(extracted, directory); }
    catch (error) { if (moved) await renameRuntime(backup, directory); throw error; }
    if (moved) await fs.rm(backup, { recursive: true, force: true }).catch(() => {});
    report('Java 21 готова к запуску', 100);
    return path.join(directory, names[0], 'bin', 'java.exe');
  } catch (error: any) {
    throw new Error('Не удалось подготовить Java SEFI. ' + (controller.signal.aborted ? controller.signal.reason?.message : error?.message || String(error)));
  } finally {
    clearTimeout(idle); clearTimeout(deadline);
    await fs.rm(temp, { recursive: true, force: true }).catch(() => {});
  }
}

export async function getJavaPath(onProgress?: (p: DownloadProgress) => void): Promise<string> {
  if (pending) return pending;
  pending = (async () => (await installedJava()) || await installJava(onProgress))();
  try { return await pending; } finally { pending = undefined; }
}

export async function resolveJava(customPath: string, ramMax: number, onProgress?: (p: DownloadProgress) => void): Promise<string> {
  const executable = customPath.trim() || await getJavaPath(onProgress);
  await inspectJava(executable, ramMax);
  return executable;
}
