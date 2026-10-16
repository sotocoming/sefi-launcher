import fs from 'fs/promises';
import path from 'path';
import { net } from 'electron';
import { createHash } from 'crypto';
import { atomicWrite } from './atomic-files';
import { trustedGameUrl } from './game-integrity';
import { communityDownloadToken } from './pack-sources';
import profiles from './fabric-profiles.json';

export async function ensureFabricProfile(gameDir: string, mcVersion: string, fabricVersion: string): Promise<string> {
  const customId = `fabric-loader-${fabricVersion}-${mcVersion}`;
  const versionDir = path.join(gameDir, 'versions', customId);
  const jsonPath = path.join(versionDir, `${customId}.json`);

  const valid=(data:any)=>{
    try { return data?.id===customId && data.inheritsFrom===mcVersion
      && data.mainClass==='net.fabricmc.loader.impl.launch.knot.KnotClient'
      && Array.isArray(data.libraries) && data.libraries.length>0 && data.libraries.length<100
      && data.libraries.every((lib:any)=>typeof lib?.name==='string'
        && /^[a-zA-Z0-9_.+\-]+:[a-zA-Z0-9_.+\-]+:[a-zA-Z0-9_.+\-]+(?::[a-zA-Z0-9_.+\-]+)?$/.test(lib.name)
        && typeof lib.url==='string' && !!trustedGameUrl(lib.url)); }
    catch { return false; }
  };
  try { if(valid(JSON.parse(await fs.readFile(jsonPath,'utf8'))))return customId; }
  catch(error:any) { if(error.code!=='ENOENT' && !(error instanceof SyntaxError))throw error; }
  const url = 'https://meta.fabricmc.net/v2/versions/loader/'+encodeURIComponent(mcVersion)+'/'+encodeURIComponent(fabricVersion)+'/profile/json';
  const failures: string[] = [];
  let data: any;
  try {
    const res = await net.fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!res.ok) { await res.body?.cancel(); throw new Error('HTTP '+res.status); }
    data = await res.json();
    if (!valid(data)) throw new Error('Некорректный профиль Fabric.');
  } catch {
    failures.push('официальный источник недоступен');
    const entry = (profiles as Record<string, {sha256: string; name: string}>)[customId];
    const token = await communityDownloadToken();
    if (!entry || !token) throw new Error('Не удалось загрузить профиль Fabric. Для резервной загрузки войдите в SEFI Community. Повторите запуск.');
    try {
      const res = await net.fetch('https://mc.sotocoming.ru/api/public/community/download-mirror/'+entry.sha256+'/'+encodeURIComponent(entry.name), {
        redirect: 'error', signal: AbortSignal.timeout(15000), headers: { 'X-Community-Token': token },
      });
      if (!res.ok) { await res.body?.cancel(); throw new Error('HTTP '+res.status); }
      const reader = res.body?.getReader();
      if (!reader) throw new Error('Пустой профиль Fabric.');
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) {
          const part = await reader.read(); if (part.done) break;
          size += part.value.length;
          if (size > 1024 * 1024) throw new Error('Слишком большой профиль Fabric.');
          chunks.push(part.value);
        }
      } finally { await reader.cancel().catch(() => {}); }
      const bytes = Buffer.concat(chunks);
      if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error('Контрольная сумма профиля Fabric не совпадает.');
      data = JSON.parse(bytes.toString('utf8'));
      if (!valid(data)) throw new Error('Некорректный профиль Fabric.');
    } catch {
      throw new Error('Не удалось загрузить профиль Fabric: '+failures.join(', ')+', зеркало SEFI недоступно или вернуло повреждённый файл. Повторите запуск позже.');
    }
  }
  await atomicWrite(jsonPath,JSON.stringify(data,null,2));

  return customId;
}
