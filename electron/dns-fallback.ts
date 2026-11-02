import { app, net } from 'electron';
import fs from 'fs';
import path from 'path';
import bundledEndpoints from '../fallback-endpoints.json';

const GITHUB_RAW_FALLBACK_URL =
  'https://raw.githubusercontent.com/sotocoming/sefi-launcher/master/fallback-endpoints.json';
// The published registry is also the bundled seed: changing addresses has one source.
const DEFAULT_FALLBACK: Record<string, string> = bundledEndpoints;
const IPV4_REGEX = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const MAX_ENDPOINT_BYTES = 16384;
let activeMapping: Record<string, string> = { ...DEFAULT_FALLBACK };
let fallbackActive = false;
let cacheFile = '';
let refresh: Promise<boolean> | undefined;

export function isDnsFallbackActive(): boolean { return fallbackActive; }

export function resolveGameHost(hostname: string): string {
  if (!fallbackActive) return hostname;
  const host = hostname.toLowerCase().trim();
  return Object.hasOwn(activeMapping, host) ? activeMapping[host] : hostname;
}

export function resolveGameAddress(address: string): string {
  if (!fallbackActive) return address;
  const trimmed = address.trim();
  const colon = trimmed.lastIndexOf(':');
  const host = colon > 0 ? trimmed.slice(0, colon) : trimmed;
  const suffix = colon > 0 ? trimmed.slice(colon) : '';
  const key = host.toLowerCase();
  const mapped = Object.hasOwn(activeMapping, key) ? activeMapping[key] : undefined;
  return mapped ? mapped + suffix : address;
}

function validateEndpoints(data: unknown): Record<string, string> | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const validated: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    const host = key.toLowerCase().trim();
    // Neither downloaded data nor the cache may inject resolver rules for other hosts.
    if (Object.prototype.hasOwnProperty.call(DEFAULT_FALLBACK, host)
      && typeof value === 'string' && IPV4_REGEX.test(value.trim())) {
      validated[host] = value.trim();
    }
  }
  return Object.keys(validated).length ? validated : null;
}

/** Call synchronously after choosing userData, before yielding to Electron's ready event. */
export function initializeDnsFallback(): void {
  if (fallbackActive) return;
  if (app.isReady()) throw new Error('DNS fallback must be initialized before Electron is ready.');
  cacheFile = path.join(app.getPath('userData'), 'fallback-endpoints-cache.json');
  try {
    if (fs.statSync(cacheFile).size <= MAX_ENDPOINT_BYTES) {
      const cached = validateEndpoints(JSON.parse(fs.readFileSync(cacheFile, 'utf8')));
      if (cached) activeMapping = { ...activeMapping, ...cached };
    }
  } catch {
    // Missing, corrupt or unreadable cache: use the bundled endpoints.
  }
  const rules = Object.entries(activeMapping).map(([host, ip]) => 'MAP ' + host + ' ' + ip).join(', ');
  app.commandLine.appendSwitch('host-resolver-rules', rules);
  // Cover DNS failures after startup too. URLs, Host and TLS SNI retain the original hostname.
  fallbackActive = true;
}

async function refreshEndpoints(): Promise<boolean> {
  await app.whenReady();
  if (!fallbackActive) throw new Error('DNS fallback was not initialized.');
  try {
    const response = await net.fetch(GITHUB_RAW_FALLBACK_URL, {
      redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) { await response.body?.cancel(); return false; }
    if (!response.body) return false;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_ENDPOINT_BYTES) { await reader.cancel(); return false; }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const remote = validateEndpoints(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    if (!remote) return false;
    const next = { ...activeMapping, ...remote };
    if (Object.keys(next).every(host => next[host] === activeMapping[host])) return false;
    // New command-line rules require a new network context. Persist first, then
    // relaunch before creating windows or issuing authenticated requests.
    const temporary = cacheFile + '.tmp';
    try {
      await fs.promises.writeFile(temporary, JSON.stringify(next, null, 2), { mode: 0o600 });
      await fs.promises.rename(temporary, cacheFile);
    } catch (error) {
      await fs.promises.unlink(temporary).catch(() => {});
      throw error;
    }
    app.relaunch();
    app.exit(0);
    return true;
  } catch (error) {
    console.warn('[DNS Fallback] Endpoint refresh unavailable; keeping startup routes:', (error as Error).message);
    return false;
  }
}

/** True when a restart was scheduled to apply newly published endpoints. */
export function refreshDnsFallback(): Promise<boolean> {
  return refresh ??= refreshEndpoints();
}
