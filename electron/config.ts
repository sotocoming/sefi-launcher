import { app, net } from 'electron';
import { atomicWrite } from './minecraft/atomic-files';
import { setTimeout as delay } from 'timers/promises';
import fs from 'fs/promises';
import path from 'path';
import { normalizeGameDirectory } from './minecraft/game-directory';
import type { Settings, LauncherConfig } from '../src/types';

let settingsWrites: Promise<void> = Promise.resolve();

export async function getSettings(): Promise<Settings> {
  await settingsWrites;
  const userDataPath = app.getPath('userData');
  const settingsFile = path.join(userDataPath, 'settings.json');
  const appData = app.getPath('appData');

  const DEFAULT_SETTINGS: Settings = {
    ramMin: 2048,
    ramMax: 4096,
    javaPath: '',
    gameDirectory: path.join(appData, '.sefi-launcher'),
    windowWidth: 854,
    windowHeight: 480,
    closeOnLaunch: false,
    fullscreen: false,
    discordPresence: true,
  };

  try {
    const data = await fs.readFile(settingsFile, 'utf-8');
    const settings = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    return { ...settings, gameDirectory: normalizeGameDirectory(settings.gameDirectory) };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  if (!settings || typeof settings.fullscreen !== 'boolean' || typeof settings.closeOnLaunch !== 'boolean') {
    throw new Error('Некорректные настройки экрана и запуска.');
  }
  if (![settings.ramMin,settings.ramMax].every(v=>Number.isInteger(v)&&v>=512&&v<=32768) || settings.ramMin>settings.ramMax || typeof settings.javaPath!=='string' || typeof settings.gameDirectory!=='string' || ![settings.windowWidth,settings.windowHeight].every(v=>Number.isInteger(v)&&v>=240&&v<=16384)) throw new Error('Некорректные настройки памяти, Java или размера окна.');
  if (settings.discordPresence !== undefined && typeof settings.discordPresence !== 'boolean') throw new Error('Некорректная настройка статуса Discord.');
  const serialized = JSON.stringify({ ...settings, gameDirectory: normalizeGameDirectory(settings.gameDirectory) }, null, 2);
  const task = settingsWrites.then(async () => {
    const userDataPath = app.getPath('userData');
    await fs.mkdir(userDataPath, { recursive: true });
    const settingsFile = path.join(userDataPath, 'settings.json');
    await atomicWrite(settingsFile,serialized);
  });
  settingsWrites = task.catch(() => {});
  await task;
}

let configRequest: Promise<LauncherConfig> | undefined;
let cachedConfig: LauncherConfig | undefined;
let cachedAt=0;
function configShape(value:any): value is LauncherConfig {
  return !!value && typeof value.modpack?.version==='string' && typeof value.modpack?.name==='string'
    && [value.modpack.curseforgeProjectId,value.modpack.curseforgeFileId].every((id:any)=>Number.isSafeInteger(id)&&id>0)
    && typeof value.modpack.minecraft==='string' && typeof value.modpack.loaderVersion==='string'
    && (!value.modpack.sha256 || /^[0-9a-f]{64}$/i.test(value.modpack.sha256))
    && typeof value.server?.ip==='string' && /^[a-zA-Z0-9.-]+$/.test(value.server.ip)
    && Number.isInteger(value.server.port) && value.server.port>0 && value.server.port<=65535
    && Array.isArray(value.news) && typeof value.launcher?.title==='string';
}
async function configJson(url:string, timeout=10000): Promise<any> {
  for(let attempt=0;;attempt++) {
    try {
      const response=await net.fetch(url,{redirect:'error',signal:AbortSignal.timeout(timeout)});
      if(!response.ok) { await response.body?.cancel();throw new Error('HTTP '+response.status); }
      return await response.json();
    } catch(error) { if(attempt>=1)throw error;await delay(400); }
  }
}
export async function getLauncherConfig(): Promise<LauncherConfig> {
  if(cachedConfig && Date.now()-cachedAt<15000)return structuredClone(cachedConfig);
  if(configRequest)return configRequest.then(c=>structuredClone(c));
  configRequest=(async()=>{
    const cacheFile=path.join(app.getPath('userData'),'launcher-config-cache.json');
    let value:LauncherConfig;
    try {
      const [raw,site]=await Promise.all([
        configJson('https://mc.sotocoming.ru/api/launcher/config'),
        configJson('https://mc.sotocoming.ru/api/public/sites',5000).catch(()=>null),
      ]);
      if(!configShape(raw))throw new Error('Некорректные настройки сборки от сервера.');
      const title=site?.values?.mc?.title;
      value={...raw,server:{...raw.server,name:typeof title==='string'&&title.trim()?title.trim().slice(0,160):raw.server.name || 'Sweet Home'}};
      await atomicWrite(cacheFile,JSON.stringify(value)).catch(()=>console.warn('[Config] could not save last known configuration'));
    } catch {
      if(cachedConfig)value=cachedConfig;
      else {
        const saved=await fs.readFile(cacheFile,'utf8').then(JSON.parse).catch(()=>null);
        if(!configShape(saved))throw new Error('Не удалось получить настройки сборки. Проверьте сеть и повторите запуск.');
        value=saved;
      }
      console.warn('[Config] using last known configuration; authorization still requires the server');
    }
    if(value.modpack.minecraft!=='1.20.1' || value.modpack.loader!=='fabric' || value.modpack.loaderVersion!=='0.18.4')throw new Error('Сборка сервера требует обновления лаунчера. Установите новую версию.');
    value={...value,server:{...value.server,endpoints:Array.isArray(value.server.endpoints)?value.server.endpoints.filter(e=>e && typeof e.id==='string' && typeof e.label==='string' && typeof e.host==='string' && /^[a-zA-Z0-9.-]+$/.test(e.host) && Number.isInteger(e.port) && e.port>0 && e.port<=65535).slice(0,8).map(e=>({...e,address:e.port===25565?e.host:e.host+':'+e.port})):undefined}};
    cachedConfig=value;cachedAt=Date.now();return value;
  })();
  try{return structuredClone(await configRequest);}finally{configRequest=undefined;}
}
