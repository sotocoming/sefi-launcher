const { Client } = require('minecraft-launcher-core');
import fs from 'fs/promises';
import path from 'path';
import type { GameState, DownloadProgress } from '../../src/types';
import { getSettings, getLauncherConfig } from '../config';
import { getAccounts } from './accounts';
import { getJavaPath } from './java';
import { ensureSefiSkinMod } from './skin-mod';
import { skinApiOrigin } from './skins';
import { startTicketBroker, redactLaunchLog } from './ticket-broker';
import { getModpackStatus, installModpack, ensureSefiAuthMod } from './modpack';
import { ensureServersInServersDat } from './servers-dat';
import { applyFullscreenSetting } from './window-options';

async function ensureFabricProfile(gameDir: string, mcVersion: string, fabricVersion: string): Promise<string> {
  const customId = `fabric-loader-${fabricVersion}-${mcVersion}`;
  const versionDir = path.join(gameDir, 'versions', customId);
  const jsonPath = path.join(versionDir, `${customId}.json`);

  try {
    await fs.access(jsonPath);
  } catch {
    await fs.mkdir(versionDir, { recursive: true });
    const url = `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${fabricVersion}/profile/json`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Не удалось загрузить профиль Fabric: ${res.statusText}`);
    }
    const data = await res.json();
    await fs.writeFile(jsonPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  return customId;
}

let launchBusy = false;
let gameRunning = false;

export async function launchGame(onStateChange: (state: GameState) => void, onStarted?: (hideWindow: boolean) => void) {
  if (launchBusy || gameRunning) return;
  launchBusy = true;
  try { await performLaunch(onStateChange, onStarted); }
  catch (error) {
    onStateChange({ status: 'error', message: error instanceof Error ? error.message : 'Не удалось подготовить игру.' });
  } finally { launchBusy = false; }
}

async function performLaunch(onStateChange: (state: GameState) => void, onStarted?: (hideWindow: boolean) => void) {
  onStateChange({ status: 'checking' });

  const settings = await getSettings();
  const accounts = await getAccounts();
  const activeAccount = accounts.find((a) => a.active);

  if (!activeAccount) {
    onStateChange({ status: 'error', message: 'Активный аккаунт не найден. Выберите или добавьте профиль.' });
    return;
  }

  if (activeAccount.communityToken) {
    try {
      const response = await fetch('https://mc.sotocoming.ru/api/public/community/me', {
        headers: { 'X-Community-Token': activeAccount.communityToken }, redirect: 'error', signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error('Войдите в SEFI Community заново.');
      const profile = await response.json() as { user?: {mc_verified_at?: number; mc_nickname?: string; mc_type?: string; mc_uuid?: string} };
      if (!profile.user) throw new Error('Войдите в SEFI Community заново.');
      if (profile.user.mc_verified_at) {
        const boundUuid = (profile.user.mc_uuid || '').replace(/-/g, '').toLowerCase();
        const sessionUuid = (activeAccount.uuid || '').replace(/-/g, '').toLowerCase();
        if (profile.user.mc_type !== 'microsoft' || !/^[0-9a-f]{32}$/.test(boundUuid)) {
          throw new Error('Не удалось проверить привязку Minecraft Java. Обновите профиль сообщества.');
        }
        if (activeAccount.type !== 'microsoft' || sessionUuid !== boundUuid || !activeAccount.accessToken) {
          throw new Error(`Для Minecraft ${profile.user.mc_nickname || ''} нужен вход Microsoft. Откройте «Аккаунты» и войдите в привязанный Microsoft-аккаунт.`);
        }
      }
    } catch (error) {
      onStateChange({ status: 'error', message: error instanceof Error ? error.message : 'Не удалось проверить игровой профиль.' });
      return;
    }
  }

  const javaPath = (settings.javaPath && settings.javaPath.trim())
    ? settings.javaPath.trim()
    : await getJavaPath((progress) => {
        onStateChange({ status: 'downloading', progress });
      });

  const status = await getModpackStatus(settings.gameDirectory);
  if (!status.installed || status.updateAvailable) {
    await installModpack(settings.gameDirectory, (progress) => {
      onStateChange({ status: 'downloading', progress });
    });
  }

  onStateChange({
    status: 'downloading',
    progress: {
      stage: 'fabric',
      task: 'Проверка и установка Fabric Loader 0.18.4',
      total: 100,
      downloaded: 0,
      percentage: 0,
    },
  });

  const customVersionId = await ensureFabricProfile(settings.gameDirectory, '1.20.1', '0.18.4');

  const launcher = new Client();

  launcher.on('progress', (e: any) => {
    let stage: DownloadProgress['stage'] = 'assets';
    if (e.type === 'libraries') stage = 'libraries';
    if (e.type === 'natives') stage = 'libraries';

    onStateChange({
      status: 'downloading',
      progress: {
        stage,
        task: `Загрузка игровых ресурсов: ${e.type}`,
        total: e.total,
        downloaded: e.task,
        percentage: e.total > 0 ? (e.task / e.total) * 100 : 0,
      },
    });
  });

  launcher.on('debug', (msg: string) => {
    console.log('[Minecraft Debug]:', redactLaunchLog(msg));
  });

  launcher.on('data', (data: string) => {
    console.log('[Minecraft Log]:', data);
  });

  let broker: Awaited<ReturnType<typeof startTicketBroker>> | undefined;
  launcher.on('close', (code: any) => {
    gameRunning = false;
    broker?.close();
    console.log('[Minecraft Closed with code]:', code);
    onStateChange({ status: 'idle' });
  });

  onStateChange({ status: 'launching' });

  const launcherConfig = await getLauncherConfig().catch(() => null);
  const serverHost = launcherConfig?.server?.ip || 'minecraft.sotocoming.ru';
  const serverPort = launcherConfig?.server?.port || 25565;
  const serverName = launcherConfig?.server?.name || 'Sweet Home';
  const fullAddress = serverPort === 25565 ? serverHost : `${serverHost}:${serverPort}`;
  const endpoints = launcherConfig?.server?.endpoints?.length ? launcherConfig.server.endpoints : [{ id: 'primary', label: 'Основной', host: serverHost, port: serverPort, address: fullAddress }];

  await ensureSefiSkinMod(settings.gameDirectory);
  const customArgs: string[] = [`-Dsefi.skinApi=${skinApiOrigin()}`];
  // Remove legacy credential artifacts. The new protocol uses memory-only, connection-bound proofs.
  await fs.unlink(path.join(settings.gameDirectory, 'sefi_ticket.txt')).catch(() => {});
  if (activeAccount.type === 'offline' && activeAccount.communityToken) {
    try {
      await ensureSefiAuthMod(settings.gameDirectory);
      broker = await startTicketBroker(activeAccount);
      customArgs.push(`-Dsefi.authPort=${broker.port}`, `-Dsefi.serverAddress=${fullAddress}`, `-Dsefi.serverAddresses=${endpoints.map(e => e.address).join(",")}`); // Port only, no credential in process arguments.
    } catch (error) {
      broker?.close();
      onStateChange({ status: 'error', message: error instanceof Error ? error.message : 'Не удалось подготовить автовход.' });
      return;
    }
  }

  const opts = {
    clientPackage: null,
    authorization: {
      access_token: activeAccount.accessToken || '00000000000000000000000000000000',
      client_token: activeAccount.clientToken || '00000000000000000000000000000000',
      uuid: activeAccount.uuid,
      name: activeAccount.username,
      user_properties: '{}',
      meta: {
        type: activeAccount.type === 'microsoft' ? 'msa' : 'mojang',
      },
    },
    root: settings.gameDirectory,
    customArgs: customArgs.length > 0 ? customArgs : undefined,
    version: {

      number: '1.20.1',
      type: 'release',
      custom: customVersionId,
    },
    javaPath: javaPath,
    memory: {
      max: `${settings.ramMax}M`,
      min: `${settings.ramMin}M`,
    },
    window: {
      width: settings.windowWidth,
      height: settings.windowHeight,
      fullscreen: settings.fullscreen,
    },
    server: {
      host: serverHost,
      port: serverPort,
    },
  };

  try {
    await ensureServersInServersDat(settings.gameDirectory, endpoints.map(e => ({ id: e.id, name: `${serverName} · ${e.label}`, ip: e.address })));
    await applyFullscreenSetting(settings.gameDirectory, settings.fullscreen);
    const child = await launcher.launch(opts);
    child?.once('error', (error: Error) => {
      gameRunning = false;
      broker?.close();
      onStateChange({ status: 'error', message: error.message || 'Не удалось запустить Java.' });
    });
    if (!child || !child.pid) {
      throw new Error('Процесс Minecraft не смог стартовать (проверьте логи Java)');
    }
    gameRunning = true;
    onStateChange({ status: 'running', pid: child.pid });
    onStarted?.(settings.closeOnLaunch === true);
  } catch (err: any) {
    broker?.close();
    console.error('Launch failed:', err);
    onStateChange({ status: 'error', message: err.message || String(err) });
  }
}
