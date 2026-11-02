import { app, net } from 'electron';
import dns from 'dns/promises';
import fs from 'fs/promises';
import path from 'path';

const GITHUB_RAW_FALLBACK_URL =
  'https://raw.githubusercontent.com/sotocoming/sefi-launcher/master/fallback-endpoints.json';

const DEFAULT_FALLBACK: Record<string, string> = {
  'mc.sotocoming.ru': '77.90.13.212',
  'sotocoming.ru': '77.90.13.212',
  'minecraft.sotocoming.ru': '193.124.66.117',
};

const IPV4_REGEX = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

let activeMapping: Record<string, string> = { ...DEFAULT_FALLBACK };
let fallbackActive = false;

export function isDnsFallbackActive(): boolean {
  return fallbackActive;
}

export function resolveGameHost(hostname: string): string {
  if (!fallbackActive) return hostname;
  const key = hostname.toLowerCase().trim();
  return activeMapping[key] || hostname;
}

export function resolveGameAddress(address: string): string {
  if (!fallbackActive) return address;
  const trimmed = address.trim();
  const colon = trimmed.lastIndexOf(':');
  const host = colon > 0 ? trimmed.slice(0, colon) : trimmed;
  const suffix = colon > 0 ? trimmed.slice(colon) : '';
  const mapped = activeMapping[host.toLowerCase()];
  return mapped ? mapped + suffix : address;
}

function validateEndpoints(data: unknown): Record<string, string> | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const validated: Record<string, string> = {};
  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    if (typeof key === 'string' && typeof val === 'string' && IPV4_REGEX.test(val.trim())) {
      validated[key.toLowerCase().trim()] = val.trim();
    }
  }
  return Object.keys(validated).length > 0 ? validated : null;
}

async function fetchRemoteFallback(): Promise<Record<string, string> | null> {
  try {
    const res = await net.fetch(GITHUB_RAW_FALLBACK_URL, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return validateEndpoints(json);
  } catch {
    return null;
  }
}

export async function applyDnsFallbackIfNeeded(): Promise<void> {
  try {
    // Fast probe: check if system DNS can resolve the primary host within 2 seconds
    await Promise.race([
      dns.resolve4('mc.sotocoming.ru'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DNS probe timeout')), 2000)),
    ]);
    return;
  } catch (probeError) {
    console.warn('[DNS Fallback] Primary DNS probe failed or timed out:', (probeError as Error)?.message || probeError);
  }

  fallbackActive = true;
  let cacheFile = '';
  try {
    const userData = app.getPath('userData');
    cacheFile = path.join(userData, 'fallback-endpoints-cache.json');
    const cachedRaw = await fs.readFile(cacheFile, 'utf8').catch(() => null);
    if (cachedRaw) {
      const parsed = validateEndpoints(JSON.parse(cachedRaw));
      if (parsed) activeMapping = { ...activeMapping, ...parsed };
    }
  } catch {
    // Ignore cache read failures; fall back to defaults
  }

  // Attempt to fetch fresh endpoints from GitHub
  const remote = await fetchRemoteFallback();
  if (remote) {
    activeMapping = { ...activeMapping, ...remote };
    if (cacheFile) {
      fs.writeFile(cacheFile, JSON.stringify(activeMapping, null, 2), 'utf8').catch(() => {});
    }
  }

  // Apply Chromium host resolver rules so all net.fetch, iframes and images route directly to fallback IPs
  const rules = Object.entries(activeMapping)
    .map(([host, ip]) => `MAP ${host} ${ip}`)
    .join(', ');

  console.info('[DNS Fallback] Active. Applying Chromium host-resolver-rules:', rules);
  app.commandLine.appendSwitch('host-resolver-rules', rules);
}
