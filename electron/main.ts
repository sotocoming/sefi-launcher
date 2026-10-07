import { canonicalPack } from './minecraft/pack-sources';
import packCatalog from './minecraft/modpack-catalog.json';
import { app, BrowserWindow, ipcMain, session, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { autoUpdater } from 'electron-updater';
import { getSettings, saveSettings, getLauncherConfig } from './config';
import { getServerStatus } from './server-status';
import { getAccounts, addOfflineAccount, loginMicrosoft, loginCommunity, linkMinecraftAccount, refreshCommunityProfile, removeAccount, setActiveAccount } from './minecraft/accounts';
import { getModpackStatus } from './minecraft/modpack';
import { launchGame } from './minecraft/launcher';

const isDev = !app.isPackaged;
const profileDirectory = app.commandLine.getSwitchValue('user-data-dir');
if (profileDirectory) {
  fs.mkdirSync(path.resolve(profileDirectory), { recursive: true });
  app.setPath('userData', path.resolve(profileDirectory));
}
if (process.platform === 'win32') app.setAppUserModelId('com.sefi.launcher');

let mainWindow: BrowserWindow | null = null;
let hiddenForGame = false;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
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
    icon: app.isPackaged ? path.join(process.resourcesPath, 'brand/icon.ico') : path.join(app.getAppPath(), 'build/icon.ico'),
    backgroundColor: '#09090D',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Allow in-app embedding of server map and news iframe strictly from trusted domain
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = Object.assign({}, details.responseHeaders);
    try {
      const parsedUrl = new URL(details.url);
      if (parsedUrl.hostname.endsWith('sotocoming.ru')) {
        delete responseHeaders['x-frame-options'];
        delete responseHeaders['X-Frame-Options'];
        if (responseHeaders['content-security-policy']) {
          responseHeaders['content-security-policy'] = responseHeaders['content-security-policy'].map(csp =>
            csp.replace(/frame-ancestors[^;]+;?/gi, '')
          );
        }
      }
    } catch {}
    callback({ responseHeaders });
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html')).catch(() => {
      dialog.showErrorBox('SEFI Launcher', 'Не удалось открыть интерфейс. Переустановите лаунчер из последнего релиза.');
    });
  }

  setupIpc();
  setupAutoUpdater();
}

function setupIpc() {
  ipcMain.on('window-minimize', () => mainWindow?.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow?.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on('window-close', () => mainWindow?.close());

  ipcMain.handle('get-settings', getSettings);
  ipcMain.handle('save-settings', async (_, settings) => await saveSettings(settings));

  ipcMain.handle('get-accounts', getAccounts);
  ipcMain.handle('add-offline-account', async (_, username) => await addOfflineAccount(username));
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

  ipcMain.handle('login-microsoft', async () => {
    const acc = await loginMicrosoft();
    bringToFront();
    return acc;
  });
  ipcMain.handle('login-community', async () => {
    const acc = await loginCommunity();
    bringToFront();
    return acc;
  });
  ipcMain.handle('link-minecraft-account', async (event, id: string) => {
    if (event.sender !== mainWindow?.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) {
      throw new Error('Привязка доступна только из основного окна лаунчера.');
    }
    const acc = await linkMinecraftAccount(id);
    bringToFront();
    return acc;
  });

  ipcMain.handle('refresh-community-profile', async (_, token) => await refreshCommunityProfile(token));
  ipcMain.handle('remove-account', async (_, id) => await removeAccount(id));
  ipcMain.handle('set-active-account', async (_, id) => await setActiveAccount(id));

  ipcMain.handle('get-launcher-config', getLauncherConfig);
  ipcMain.handle('get-server-status', getServerStatus);

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
  ipcMain.handle('get-news-reactions', event => newsRequest(event));
  ipcMain.handle('react-news', (event, id: string, reaction: string) => newsRequest(event, {id, reaction}));

  ipcMain.handle('import-modpack-archive', async event => {
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

  ipcMain.handle('get-modpack-status', async () => {
    const settings = await getSettings();
    return await getModpackStatus(settings.gameDirectory);
  });

  ipcMain.handle('launch-game', async () => {
    await launchGame((state) => {
      mainWindow?.webContents.send('game-state-change', state);
      if (state.status === 'downloading') {
        mainWindow?.webContents.send('download-progress', state.progress);
      }
      if (hiddenForGame && (state.status === 'idle' || state.status === 'error')) {
        hiddenForGame = false;
        bringToFront();
      }
    }, (hideWindow) => {
      if (hideWindow && mainWindow && !mainWindow.isDestroyed()) {
        hiddenForGame = true;
        mainWindow.hide();
      }
    });
  });

  ipcMain.handle('select-java-path', async () => {
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
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('select-game-directory', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Выберите папку установки клиента игры',
      properties: ['openDirectory', 'createDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('open-directory', async (_, dirPath: string) => {
    if (!dirPath || typeof dirPath !== 'string') return;
    try {
      const resolved = path.resolve(dirPath);
      if (!fs.existsSync(resolved)) {
        fs.mkdirSync(resolved, { recursive: true });
      }
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        await shell.openPath(resolved);
      }
    } catch (e) {
      console.error('Failed to open directory:', e);
    }
  });

  ipcMain.handle('open-external', async (_, url: string) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      await shell.openExternal(url);
    }
  });
}

function setupAutoUpdater() {
  autoUpdater.logger = console;
  // Automatically download updates in the background when available
  autoUpdater.autoDownload = true;
  // Automatically install when the app exits if already downloaded
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('update-status-change', {
      status: 'checking'
    });
  });

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-status-change', {
      status: 'available',
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
    });
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update-status-change', {
      status: 'idle'
    });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow?.webContents.send('update-status-change', {
      status: 'downloading',
      percent: Math.round(progressObj.percent),
      transferred: progressObj.transferred,
      total: progressObj.total
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update-status-change', {
      status: 'ready',
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('AutoUpdater error:', err);
    mainWindow?.webContents.send('update-status-change', {
      status: 'error',
      error: err?.message || 'Update check error'
    });
  });

  ipcMain.handle('check-for-updates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return {
        status: result?.updateInfo?.version ? 'available' : 'idle',
        version: result?.updateInfo?.version,
        releaseNotes: result?.updateInfo?.releaseNotes?.toString()
      };
    } catch (e: any) {
      return { status: 'error', error: e?.message };
    }
  });

  ipcMain.handle('install-update', () => {
    // isSilent: true installs silently, isForceRunAfter: true launches new version immediately
    autoUpdater.quitAndInstall(false, true);
  });

  // Check for updates shortly after launcher launch in production
  if (!isDev) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, 4000);
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
