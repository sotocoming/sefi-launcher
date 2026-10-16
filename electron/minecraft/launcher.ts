import { protectMinecraftHandler } from './game-integrity';
const { Client } = require('minecraft-launcher-core');
import fs from 'fs/promises';
import { net } from 'electron';
import { ensureFabricProfile } from './fabric-profile';
import path from 'path';
import type { GameState, DownloadProgress } from '../../src/types';
import { getSettings, getLauncherConfig } from '../config';
import { getAccounts } from './accounts';
import { ensureMicrosoftAccount } from './account-session';
import { communityRequest } from './community-request';
import { resolveJava } from './java';
import { prepareGameDirectory } from './game-directory';
import { ensureSefiSkinMod } from './skin-mod';
import { skinApiOrigin } from './skins';
import { startTicketBroker, redactLaunchLog } from './ticket-broker';
import { getModpackStatus, installModpack, ensureSefiAuthMod } from './modpack';
import { ensureServersInServersDat } from './servers-dat';
import { applyFullscreenSetting } from './window-options';


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
  let activeAccount = accounts.find((a) => a.active);

  if (!activeAccount) {
    onStateChange({ status: 'error', message: 'Активный аккаунт не найден. Выберите или добавьте профиль.' });
    return;
  }

  if (activeAccount.communityToken) {
    try {
      const profile = await communityRequest('/api/public/community/me',activeAccount.communityToken) as {user?: {mc_verified_at?:number;mc_nickname?:string;mc_type?:string;mc_uuid?:string}};
      if (!profile.user) throw new Error('Сессия SEFI не подтверждена. Войдите в SEFI Community заново.');
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

  if(activeAccount.type==='microsoft')activeAccount=await ensureMicrosoftAccount(activeAccount.id);
  settings.gameDirectory = await prepareGameDirectory(settings.gameDirectory);
  const javaPath = await resolveJava(settings.javaPath || '', settings.ramMax, (progress) => {
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

  class VerifiedClient extends Client {
    preparationError?: Error;
    printVersion() { super.printVersion(); protectMinecraftHandler(this.handler, (error) => { this.preparationError = error; }); }
    async startMinecraft(args: string[]) {
      if (activeAccount?.type === 'microsoft') {
        const current = await ensureMicrosoftAccount(activeAccount.id, true);
        const token = args.indexOf('--accessToken');
        if (token < 0 || token + 1 >= args.length) throw new Error('Не найдены параметры авторизации Minecraft.');
        args[token + 1] = current.accessToken;
      }
      return super.startMinecraft(args);
    }
  }
  const launcher = new VerifiedClient();

  launcher.on('download-status', (event: any) => {
    const total = Number(event.total) || 0;
    const downloaded = Number(event.current) || 0;
    onStateChange({ status: 'downloading', progress: {
      stage: event.type === 'assets' ? 'assets' : 'libraries',
      task: 'Загрузка: ' + String(event.name), total, downloaded,
      percentage: total > 0 ? Math.min(100, downloaded / total * 100) : 0,
    } });
  });
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

  const startupLog: string[] = [];
  const rememberStartup = (message: string) => {
    startupLog.push(redactLaunchLog(String(message)).slice(-1500));
    if (startupLog.length > 12) startupLog.shift();
  };
  launcher.on('debug', (msg: string) => {
    rememberStartup(msg);
    console.log('[Minecraft Debug]:', redactLaunchLog(msg));
  });

  launcher.on('data', (data: string) => {
    rememberStartup(data);
    console.log('[Minecraft Log]:', redactLaunchLog(data));
  });

  let broker: Awaited<ReturnType<typeof startTicketBroker>> | undefined;
  launcher.on('close', (code: any) => {
    gameRunning = false;
    broker?.close();
    console.log('[Minecraft Closed with code]:', code);
    onStateChange(code===0 ? {status:'idle'} : {status:'error',message:'Minecraft завершился с ошибкой (код '+code+').\n'+startupLog.join('\n').slice(-4000)});
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

  // Long modpack downloads may outlive the game token: renew again immediately before spawn.
  if(activeAccount.type==='microsoft')activeAccount=await ensureMicrosoftAccount(activeAccount.id,true);
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
    quickPlay: { type: 'multiplayer', identifier: fullAddress },
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
      if (launcher.preparationError) throw launcher.preparationError;
      throw new Error('Процесс Minecraft не смог стартовать. Java: ' + javaPath + '\n' + startupLog.join('\n').slice(-4000));
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
