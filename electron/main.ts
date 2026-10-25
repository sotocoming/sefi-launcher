import {prepareLaunchReport,previewLaunchReport,sendLaunchReport,exportLaunchReport,getReportTickets} from './launch-reports';
import { getReleaseNotesVersion, acknowledgeReleaseNotes } from './release-notes';
import { cancelCommunityBrowser } from './minecraft/community-browser';
import { trustedIpc, trustedDocument, embeddingHeaders } from './ipc-security';
import { canonicalPack } from './minecraft/pack-sources';
import packCatalog from './minecraft/modpack-catalog.json';
import { app, BrowserWindow, ipcMain, session, dialog, shell, net } from 'electron';
import path from 'path';
import fs from 'fs';
import { autoUpdater } from 'electron-updater';
import { UpdateChecks } from './update-checks';
import type { UpdateInfo } from '../src/types';
import { getSettings, saveSettings, getLauncherConfig } from './config';
import { getServerStatus } from './server-status';
import { getAccounts, addOfflineAccount, loginMicrosoft, loginCommunity, linkMinecraftAccount, refreshCommunityProfile, removeAccount, setActiveAccount } from './minecraft/accounts';
import { getModpackStatus } from './minecraft/modpack';
import { chooseSkin, getCommunitySkin, saveCommunitySkin, resetCommunitySkin } from './minecraft/skins';
import { getOfficialSkin } from './minecraft/official-skin';
import { GameWindow } from './game-window';
import { serverClockStatus } from './minecraft/server-clock';
import { communityRequest } from './minecraft/community-request';
import { getJavaStatus, getJavaPath, inspectJava } from './minecraft/java';
import { prepareGameDirectory } from './minecraft/game-directory';
import { publicAccount } from './minecraft/account-store';
import { launchGame } from './minecraft/launcher';
import { DiscordPresence } from './discord-presence';
import { loadWindowInterface } from './window-loading';
import { repairClickBindings, repairResourcePacks } from './minecraft/control-repair';

const isDev = !app.isPackaged;
const profileDirectory = app.commandLine.getSwitchValue('user-data-dir');
if (profileDirectory) {
  fs.mkdirSync(path.resolve(profileDirectory), { recursive: true });
  app.setPath('userData', path.resolve(profileDirectory));
}
if (process.platform === 'win32') {
  const appId = isDev ? 'com.sefi.launcher.dev' : 'com.sefi.launcher';
  app.setAppUserModelId(appId);
}

let mainWindow: BrowserWindow | null = null;
const gameWindow = new GameWindow(() => mainWindow);
app.on('before-quit', () => gameWindow.dispose());
let hiddenForGame = false;
let gameBusy = false;
let controlsRepairBusy = false;
let updateChecks: UpdateChecks | null = null;
let integrationsReady = false;
const discordPresence = new DiscordPresence();
app.once('before-quit', () => discordPresence.close());
const indexFile = path.join(app.getAppPath(), 'dist/index.html');
const secureIpc = trustedIpc(ipcMain, () => mainWindow, indexFile, isDev);
secureIpc.handle('get-report-tickets', (_event,id:unknown)=>getReportTickets(id));
let clockProbe: Promise<unknown> | null = null;
let clockProbeAt = -Infinity;
secureIpc.handle('get-clock-status', async () => {
  if (!serverClockStatus().checked && !clockProbe && performance.now()-clockProbeAt>60000) {
    clockProbeAt=performance.now();clockProbe=communityRequest('/api/public/community/launcher/ticket/config').catch(()=>{}).finally(()=>{clockProbe=null;});
  }
  if(clockProbe)await clockProbe;
  return serverClockStatus();
});
secureIpc.handle('open-time-settings', async () => {if(process.platform==='win32')await shell.openExternal('ms-settings:dateandtime');});
function sendToMain(channel: string, value: unknown) {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) mainWindow.webContents.send(channel, value);
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1100,
    minHeight: 680,
    frame: false,
    icon: app.isPackaged ? path.join(process.resourcesPath, 'brand/icon.ico') : path.join(app.getAppPath(), 'build/icon.png'),
    backgroundColor: '#09090D',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (isDev && process.platform === 'win32') mainWindow.setAppDetails({
    appId: 'com.sefi.launcher.dev',
    appIconPath: path.join(app.getAppPath(), 'build/icon.ico'),
    appIconIndex: 0,
  });

  const created = mainWindow;
  created.on('close', event => gameWindow.close(event));
  created.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  created.webContents.on('will-navigate', (event, url) => {
    if (!trustedDocument(url, indexFile, isDev)) event.preventDefault();
  });
  created.webContents.on('will-redirect', (event, url, _inPlace, mainFrame) => {
    if (mainFrame && !trustedDocument(url, indexFile, isDev)) event.preventDefault();
  });
  created.webContents.on('will-attach-webview', event => event.preventDefault());
  created.on('closed', () => { if (mainWindow === created) mainWindow = null; });
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: embeddingHeaders(details.url, details.resourceType, details.responseHeaders || {}) });
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    void loadWindowInterface(created, path.join(app.getAppPath(), 'dist/index.html'), error => {
      console.error('[Window] Interface load failed:', (error as Error)?.message || 'unknown');
      dialog.showErrorBox('SEFI Launcher', 'Не удалось открыть интерфейс. Переустановите лаунчер из последнего релиза.');
    });
  }

  if (!integrationsReady) {
    integrationsReady = true;
    setupIpc();
    setupAutoUpdater();
    void getSettings().then(settings => {
      discordPresence.configure(settings.discordPresence !== false);
      return getLauncherConfig();
    }).then(config => getSettings().then(settings => discordPresence.configure(settings.discordPresence !== false, config))).catch(() => {});
  }
}

function setupIpc() {
  secureIpc.on('window-minimize', () => mainWindow?.minimize());
  secureIpc.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow?.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  secureIpc.on('window-close', () => mainWindow?.close());

  secureIpc.handle('prepare-launch-report', (_,message) => prepareLaunchReport(message));
  secureIpc.handle('preview-launch-report', (_,id,options) => previewLaunchReport(id,options));
  secureIpc.handle('send-launch-report', (_,id,token) => sendLaunchReport(id,token));
  secureIpc.handle('export-launch-report', (_,id,token) => {
    if(!mainWindow||mainWindow.isDestroyed())throw new Error('Окно лаунчера закрыто.');
    return exportLaunchReport(mainWindow,id,token);
  });
  secureIpc.handle('get-release-notes-version', getReleaseNotesVersion);
  secureIpc.handle('acknowledge-release-notes', (_, version) => acknowledgeReleaseNotes(version));
  secureIpc.handle('get-settings', getSettings);
  secureIpc.handle('save-settings', async (_, settings) => {
    await saveSettings(settings);
    discordPresence.configure((await getSettings()).discordPresence !== false);
  });

  function skinWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow {
    if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) {
      throw new Error('Скины доступны только из основного окна лаунчера.');
    }
    return mainWindow;
  }
  secureIpc.handle('choose-skin', event => chooseSkin(skinWindow(event)));
  secureIpc.handle('get-community-skin', (event, id: string) => { skinWindow(event); return getCommunitySkin(id); });
  secureIpc.handle('get-official-skin', (event, id: string, refresh?: boolean) => { skinWindow(event); return getOfficialSkin(id, refresh); });
  secureIpc.handle('save-community-skin', (event, id: string, png: string, model: 'classic' | 'slim') => {
    skinWindow(event); return saveCommunitySkin(id, png, model);
  });
  secureIpc.handle('reset-community-skin', (event, id: string) => { skinWindow(event); return resetCommunitySkin(id); });

  secureIpc.handle('get-accounts', async()=> (await getAccounts()).map(a=>publicAccount(a)));
  secureIpc.handle('add-offline-account', async (_, username) => publicAccount(await addOfflineAccount(username)));
  const bringToFront = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(true);
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setAlwaysOnTop(false);
      }, 500);
    }
  };

  secureIpc.handle('login-microsoft', async () => {
    const acc = await loginMicrosoft();
    bringToFront();
    return publicAccount(acc);
  });
  secureIpc.handle('cancel-community-login', () => cancelCommunityBrowser());
  secureIpc.handle('login-community', async () => {
    const acc = await loginCommunity();
    bringToFront();
    return publicAccount(acc);
  });
  secureIpc.handle('link-minecraft-account', async (event, id: string) => {
    if (event.sender !== mainWindow?.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) {
      throw new Error('Привязка доступна только из основного окна лаунчера.');
    }
    const acc = await linkMinecraftAccount(id);
    bringToFront();
    return publicAccount(acc);
  });

  secureIpc.handle('refresh-community-profile', async (_, accountId: string) => {
    const account = (await getAccounts()).find(a => a.id === accountId);
    return account?.communityToken ? publicAccount(await refreshCommunityProfile(account.communityToken)) : null;
  });
  secureIpc.handle('remove-account', async (_, id) => await removeAccount(id));
  secureIpc.handle('set-active-account', async (_, id) => await setActiveAccount(id));

  secureIpc.handle('get-launcher-config', getLauncherConfig);
  secureIpc.handle('get-server-status', async () => {
    const config = await getLauncherConfig();
    const settings = await getSettings();
    const endpoint = config.server.endpoints?.find(item => item.id === settings.selectedServerId) || config.server.endpoints?.[0];
    return getServerStatus(endpoint?.host || config.server.ip, endpoint?.port || config.server.port);
  });

  async function newsRequest(event: Electron.IpcMainInvokeEvent, body?: object) {
    if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) {
      throw new Error('Недоступное окно.');
    }
    const account = (await getAccounts()).find(account => account.active);
    if (!account?.communityToken) throw new Error('Войдите в SEFI Community, чтобы оценивать новости.');
    const response = await fetch('https://mc.sotocoming.ru/api/public/news/' + (body ? 'react' : 'reactions'), {
      method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', 'X-Community-Token': account.communityToken },
      ...(body ? {body: JSON.stringify(body)} : {}),
    });
    const data = await response.json() as {error?: string; [key: string]: unknown};
    if (!response.ok) throw new Error(data.error || 'Не удалось загрузить реакции.');
    return data;
  }
  secureIpc.handle('get-news-reactions', event => newsRequest(event));
  secureIpc.handle('react-news', (event, id: string, reaction: string) => newsRequest(event, {id, reaction}));

  secureIpc.handle('import-modpack-archive', async event => {
    if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) {
      throw new Error('Недоступное окно.');
    }
    const config = await getLauncherConfig();
    if (config.modpack.curseforgeProjectId !== packCatalog.projectId || config.modpack.curseforgeFileId !== packCatalog.fileId) {
      throw new Error('Импорт для текущей сборки ещё не поддерживается. Обновите лаунчер.');
    }
    const choice = await dialog.showOpenDialog(mainWindow, { title: 'Импорт Homestead 1.3.7', properties: ['openFile'],
      filters: [{ name: 'Официальный архив CurseForge', extensions: ['zip'] }] });
    if (choice.canceled || !choice.filePaths[0]) return { cancelled: true };
    const settings = await getSettings();
    const imported = await canonicalPack(settings.gameDirectory, choice.filePaths[0]);
    return { cancelled: false, name: imported?.name };
  });

  secureIpc.handle('get-modpack-status', async () => {
    const settings = await getSettings();
    return await getModpackStatus(settings.gameDirectory);
  });

  secureIpc.handle('launch-game', async () => {
    if (controlsRepairBusy) throw new Error('Дождитесь завершения исправления управления.');
    await launchGame((state) => {
      gameWindow.state(state.status);
      discordPresence.gameState(state);
      gameBusy = !['idle', 'error'].includes(state.status);
      autoUpdater.autoInstallOnAppQuit = !app.commandLine.hasSwitch('ui-preview') && !gameBusy;
      if (!gameBusy) void updateChecks?.run();
      sendToMain('game-state-change', state);
      if (state.status === 'downloading') {
        sendToMain('download-progress', state.progress);
      }
      if (hiddenForGame && (state.status === 'idle' || state.status === 'error')) {
        hiddenForGame = false;
        bringToFront();
      }
    }, (hideWindow) => {
      if (hideWindow && mainWindow && !mainWindow.isDestroyed()) {
        hiddenForGame = true;
        gameWindow.hide();
      }
    }, location => discordPresence.gameLocation(location));
  });

  secureIpc.handle('repair-click-bindings', async () => {
    if (gameBusy || controlsRepairBusy) throw new Error('Закройте Minecraft и дождитесь завершения запуска.');
    controlsRepairBusy = true;
    gameBusy = true;
    sendToMain('game-state-change', { status: 'checking' });
    try { return await repairClickBindings((await getSettings()).gameDirectory); }
    finally { controlsRepairBusy = false; gameBusy = false; sendToMain('game-state-change', { status: 'idle' }); }
  });

  secureIpc.handle('repair-resource-packs', async () => {
    if (gameBusy || controlsRepairBusy) throw new Error('Закройте Minecraft и дождитесь завершения запуска.');
    controlsRepairBusy = true; gameBusy = true;
    sendToMain('game-state-change', { status: 'checking' });
    try { return await repairResourcePacks((await getSettings()).gameDirectory); }
    finally { controlsRepairBusy = false; gameBusy = false; sendToMain('game-state-change', { status: 'idle' }); }
  });

  secureIpc.handle('get-java-status', async () => getJavaStatus((await getSettings()).javaPath));
  secureIpc.handle('prepare-java', async () => {
    if (gameBusy) throw new Error('Дождитесь завершения запуска или закройте игру.');
    gameBusy = true;
    try {
      sendToMain('game-state-change', { status: 'checking' });
      await getJavaPath(progress => {
        sendToMain('download-progress', progress);
        sendToMain('game-state-change', { status: 'downloading', progress });
      });
      return await getJavaStatus('');
    } finally { gameBusy = false; sendToMain('game-state-change', { status: 'idle' }); }
  });

  secureIpc.handle('select-java-path', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Выберите исполняемый файл Java',
      properties: ['openFile'],
      filters: [
        { name: 'Исполняемые файлы Java (javaw.exe, java.exe)', extensions: ['exe'] },
        { name: 'Все файлы', extensions: ['*'] }
      ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      await inspectJava(result.filePaths[0]);
      return result.filePaths[0];
    }
    return null;
  });

  secureIpc.handle('select-game-directory', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Выберите папку установки клиента игры',
      properties: ['openDirectory', 'createDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return await prepareGameDirectory(result.filePaths[0]);
    }
    return null;
  });

  secureIpc.handle('open-directory', async (_, dirPath: string) => {
    if (typeof dirPath !== 'string' || !dirPath || dirPath.length > 32767) throw new Error('Некорректная папка.');
    const configured = path.resolve((await getSettings()).gameDirectory);
    if (path.resolve(dirPath).toLowerCase() !== configured.toLowerCase()) throw new Error('Открыть можно только папку игры из настроек.');
    try {
      const resolved = path.resolve(dirPath);
      if (!fs.existsSync(resolved)) {
        fs.mkdirSync(resolved, { recursive: true });
      }
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        const error = await shell.openPath(resolved);
        if (error) throw new Error(error);
      }
    } catch (e) {
      console.error('Failed to open directory:', e);
      throw new Error('Не удалось открыть папку игры. Проверьте доступ и наличие диска.');
    }
  });

  secureIpc.handle('open-external', async (_, url: string) => {
    if (typeof url !== 'string' || url.length > 4096) throw new Error('Некорректная ссылка.');
    const target = new URL(url);
    if (!['https:', 'http:'].includes(target.protocol) || target.username || target.password) throw new Error('Разрешены только веб-ссылки без учётных данных.');
    await shell.openExternal(target.href);
  });
}

function setupAutoUpdater() {
  if (app.commandLine.hasSwitch('ui-preview')) {
    autoUpdater.autoInstallOnAppQuit = false;
    secureIpc.handle('check-for-updates', async () => ({status:'error',error:'Локальная тестовая сборка. Автообновления отключены.'}));
    secureIpc.handle('get-update-status', () => ({status:'idle'}));
    secureIpc.handle('install-update', () => { throw new Error('В тестовой сборке установка обновлений отключена.'); });
    return;
  }
  let updateState: UpdateInfo = { status: 'idle' };
  let downloadReady = false;
  const fail = (err: unknown) => {
    const phase = updateState.status === 'installing' ? 'install' : ['available','downloading'].includes(updateState.status) ? 'download' : updateState.phase || 'check';
    publish({status:'error',phase,canInstall:downloadReady,version:updateState.version,error:err instanceof Error ? err.message : 'Update error'});
  };
  const publish = (state: UpdateInfo) => { updateState = state; sendToMain('update-status-change', state); };
  updateChecks = new UpdateChecks({
    state: () => updateState,
    blocked: () => gameBusy || !net.isOnline(),
    check: async () => { try { await autoUpdater.checkForUpdates(); } catch (err) { if(updateState.status !== 'error') fail(err); throw err; } },
  });
  autoUpdater.logger = console;
  // Automatically download updates in the background when available
  autoUpdater.autoDownload = true;
  // Automatically install when the app exits if already downloaded
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    publish({
      status: 'checking'
    });
  });

  autoUpdater.on('update-available', (info) => {
    publish({
      status: 'available',
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
    });
  });

  autoUpdater.on('update-not-available', () => {
    publish({
      status: 'idle', checkedAt: Date.now()
    });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    publish({
      status: 'downloading',
      version: updateState.version,
      percent: Math.round(progressObj.percent),
      transferred: progressObj.transferred,
      total: progressObj.total
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    downloadReady = true;
    publish({
      status: 'ready', canInstall:true,
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('AutoUpdater error:', err);
    fail(err);
  });

  secureIpc.handle('get-update-status', () => updateState);
  secureIpc.handle('check-for-updates', async () => {
    if (isDev) return { status: 'error', error: 'Обновления доступны в установленном лаунчере.' };
    return await updateChecks!.run(true);
  });

  secureIpc.handle('install-update', () => {
    // isSilent: true installs silently, isForceRunAfter: true launches new version immediately
    if (gameBusy) throw new Error('Сначала завершите Minecraft.');
    if (isDev || !downloadReady) throw new Error('Обновление ещё не загружено.');
    if (updateState.status === 'installing') return;
    publish({...updateState,status:'installing',phase:'install',canInstall:true});
    try { autoUpdater.quitAndInstall(false, true); } catch(err) { fail(err); throw err; }
  });

  // Check for updates shortly after launcher launch in production
  if (!isDev) {
    setTimeout(() => {
      void updateChecks?.run();
    }, 4000);
    const timer = setInterval(() => { void updateChecks?.run(); }, 5 * 60_000);
    timer.unref();
    mainWindow?.on('focus', () => { void updateChecks?.run(); });
    app.once('before-quit', () => clearInterval(timer));
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
