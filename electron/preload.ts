import { contextBridge, ipcRenderer } from 'electron';
import type { IElectronAPI } from '../src/types/electron';
import type { GameState, DownloadProgress, Settings } from '../src/types';

const api: IElectronAPI = {
  prepareLaunchReport: message => ipcRenderer.invoke('prepare-launch-report',message),
  previewLaunchReport: (id,options) => ipcRenderer.invoke('preview-launch-report',id,options),
  sendLaunchReport: (id,token) => ipcRenderer.invoke('send-launch-report',id,token),
  exportLaunchReport: (id,token) => ipcRenderer.invoke('export-launch-report',id,token),
  getReleaseNotesVersion: () => ipcRenderer.invoke('get-release-notes-version'),
  acknowledgeReleaseNotes: version => ipcRenderer.invoke('acknowledge-release-notes', version),
  launchGame: () => ipcRenderer.invoke('launch-game'),
  
  repairResourcePacks: () => ipcRenderer.invoke('repair-resource-packs'),
  repairClickBindings: () => ipcRenderer.invoke('repair-click-bindings'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: Settings) => ipcRenderer.invoke('save-settings', settings),
  getJavaStatus: () => ipcRenderer.invoke('get-java-status'),
  prepareJava: () => ipcRenderer.invoke('prepare-java'),
  selectJavaPath: () => ipcRenderer.invoke('select-java-path'),
  selectGameDirectory: () => ipcRenderer.invoke('select-game-directory'),
  openDirectory: (dirPath: string) => ipcRenderer.invoke('open-directory', dirPath),
  
  getCommunitySkin: id => ipcRenderer.invoke('get-community-skin', id),
  chooseSkin: () => ipcRenderer.invoke('choose-skin'),
  saveCommunitySkin: (id, png, model) => ipcRenderer.invoke('save-community-skin', id, png, model),
  resetCommunitySkin: id => ipcRenderer.invoke('reset-community-skin', id),
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  addOfflineAccount: (username: string) => ipcRenderer.invoke('add-offline-account', username),
  loginMicrosoft: () => ipcRenderer.invoke('login-microsoft'),
  cancelCommunityLogin: () => ipcRenderer.invoke('cancel-community-login'),
  loginCommunity: () => ipcRenderer.invoke('login-community'),
  linkMinecraftAccount: (id: string) => ipcRenderer.invoke('link-minecraft-account', id),
  refreshCommunityProfile: (accountId: string) => ipcRenderer.invoke('refresh-community-profile', accountId),
  removeAccount: (id: string) => ipcRenderer.invoke('remove-account', id),
  setActiveAccount: (id: string) => ipcRenderer.invoke('set-active-account', id),
  
  getModpackStatus: () => ipcRenderer.invoke('get-modpack-status'),
  importModpackArchive: () => ipcRenderer.invoke('import-modpack-archive'),
  
  getLauncherConfig: () => ipcRenderer.invoke('get-launcher-config'),
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  getNewsReactions: () => ipcRenderer.invoke('get-news-reactions'),
  reactNews: (id: string, reaction: 'like', prev: 'like' | null) =>
    ipcRenderer.invoke('react-news', id, reaction, prev),

  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => {
    const handler = (_event: any, progress: DownloadProgress) => callback(progress);
    ipcRenderer.on('download-progress', handler);
    return () => ipcRenderer.removeListener('download-progress', handler);
  },
  
  onGameStateChange: (callback: (state: GameState) => void) => {
    const handler = (_event: any, state: GameState) => callback(state);
    ipcRenderer.on('game-state-change', handler);
    return () => ipcRenderer.removeListener('game-state-change', handler);
  },

  onUpdateStatusChange: (callback: (info: any) => void) => {
    const handler = (_event: any, info: any) => callback(info);
    ipcRenderer.on('update-status-change', handler);
    return () => ipcRenderer.removeListener('update-status-change', handler);
  },
  
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
};

// Remote subframes must never receive the launcher bridge.
if (process.isMainFrame) contextBridge.exposeInMainWorld('electronAPI', api);
