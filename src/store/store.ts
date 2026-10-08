import { create } from 'zustand';
import { launchErrorMessage } from '../utils/errors';
import {
  Settings,
  Account,
  CommunitySkin,
  ModpackStatus,
  ServerStatus,
  LauncherConfig,
  NewsItem,
  DownloadProgress,
  GameState,
  UpdateInfo,
} from '../types';

interface StoreState {
  currentPage: 'home' | 'map' | 'news' | 'settings' | 'accounts';
  gameState: GameState;
  downloadProgress: DownloadProgress | null;
  settings: Settings | null;
  accounts: Account[];
  activeAccount: Account | null;
  communitySkins: Record<string, CommunitySkin | null>;
  loadCommunitySkin: (id: string) => Promise<CommunitySkin | null>;
  setCommunitySkin: (id: string, skin: CommunitySkin | null) => void;
  modpackStatus: ModpackStatus | null;
  serverStatus: ServerStatus | null;
  launcherConfig: LauncherConfig | null;
  news: NewsItem[];
  updateInfo: UpdateInfo | null;
  
  // Actions
  setCurrentPage: (page: 'home' | 'map' | 'news' | 'settings' | 'accounts') => void;
  setGameState: (state: GameState) => void;
  setDownloadProgress: (progress: DownloadProgress | null) => void;
  setSettings: (settings: Settings) => void;
  setAccounts: (accounts: Account[]) => void;
  setActiveAccount: (account: Account | null) => void;
  setModpackStatus: (status: ModpackStatus | null) => void;
  setServerStatus: (status: ServerStatus | null) => void;
  setLauncherConfig: (config: LauncherConfig | null) => void;
  setNews: (news: NewsItem[]) => void;
  setUpdateInfo: (info: UpdateInfo | null) => void;
  
  // Async actions
  initStore: () => Promise<void>;
  refreshServerStatus: () => Promise<void>;
  updateSettings: (settings: Settings) => Promise<void>;
  launch: () => Promise<void>;
  installLauncherUpdate: () => Promise<void>;
}

const skinRequests = new Map<string, Promise<CommunitySkin | null>>();

let settingsSaveQueue: Promise<void> = Promise.resolve();

export const useStore = create<StoreState>((set, get) => ({
  currentPage: 'home',
  gameState: { status: 'idle' },
  downloadProgress: null,
  settings: null,
  accounts: [],
  activeAccount: null,
  communitySkins: {},
  setCommunitySkin: (id, skin) => set(state => ({ communitySkins: { ...state.communitySkins, [id]: skin } })),
  loadCommunitySkin: (id) => {
    const cached = get().communitySkins;
    if (Object.prototype.hasOwnProperty.call(cached, id)) return Promise.resolve(cached[id]);
    const pending = skinRequests.get(id);
    if (pending) return pending;
    const request = window.electronAPI.getCommunitySkin(id).then(skin => {
      get().setCommunitySkin(id, skin); return skin;
    }).finally(() => { skinRequests.delete(id); });
    skinRequests.set(id, request);
    return request;
  },
  modpackStatus: null,
  serverStatus: null,
  launcherConfig: null,
  news: [],
  updateInfo: null,

  setCurrentPage: (page) => set({ currentPage: page }),
  setGameState: (state) => set({ gameState: state }),
  setDownloadProgress: (progress) => set({ downloadProgress: progress }),
  setSettings: (settings) => set({ settings }),
  setAccounts: (accounts) => set({ accounts }),
  setActiveAccount: (account) => set({ activeAccount: account }),
  setModpackStatus: (status) => set({ modpackStatus: status }),
  setServerStatus: (status) => set({ serverStatus: status }),
  setLauncherConfig: (config) => set({ launcherConfig: config }),
  setNews: (news) => set({ news }),
  setUpdateInfo: (info) => set({ updateInfo: info }),

  initStore: async () => {
    try {
      const [config, accounts, settings, modpackStatus, serverStatus] = await Promise.all([
        window.electronAPI.getLauncherConfig().catch(() => null),
        window.electronAPI.getAccounts().catch(() => []),
        window.electronAPI.getSettings().catch(() => null),
        window.electronAPI.getModpackStatus().catch(() => null),
        window.electronAPI.getServerStatus().catch(() => null)
      ]);

      let currentAccounts = accounts || [];
      // Refresh community accounts in background if any exist
      const commAccounts = currentAccounts.filter((a: Account) => a.communityToken);
      if (commAccounts.length > 0 && window.electronAPI?.refreshCommunityProfile) {
        Promise.all(commAccounts.map((a: Account) => window.electronAPI.refreshCommunityProfile(a.communityToken!)))
          .then(async () => {
            const fresh = await window.electronAPI.getAccounts();
            set({ accounts: fresh, activeAccount: fresh.find((a: Account) => a.active) || fresh[0] || null });
          })
          .catch(() => {});
      }

      set({
        launcherConfig: config,
        news: config?.news || [],
        accounts: currentAccounts,
        activeAccount: currentAccounts.find((a: Account) => a.active) || currentAccounts[0] || null,
        settings: settings,
        modpackStatus: modpackStatus,
        serverStatus: serverStatus
      });
    } catch (e) {
      console.error('Failed to init store', e);
    }
  },

  refreshServerStatus: async () => {
    try {
      if (window.electronAPI?.getServerStatus) {
        const serverStatus = await window.electronAPI.getServerStatus();
        set({ serverStatus });
      }
      if (window.electronAPI?.getLauncherConfig) {
        const config = await window.electronAPI.getLauncherConfig().catch(() => null);
        if (config) {
          set({
            launcherConfig: config,
            news: config.news || [],
          });
        }
      }
    } catch (e) {
      console.error('Failed to refresh status/news', e);
    }
  },

  updateSettings: async (settings: Settings) => {
    const previous = get().settings;
    set({ settings });
    const task = settingsSaveQueue.then(() => window.electronAPI.saveSettings(settings));
    settingsSaveQueue = task.catch(() => {});
    try { await task; }
    catch (e) {
      if (get().settings === settings) set({ settings: previous });
      console.error('Failed to save settings', e);
    }
  },

  launch: async () => {
    const state = get().gameState;
    if (state.status === 'checking' || state.status === 'running' || state.status === 'launching' || state.status === 'downloading' || state.status === 'extracting') {
      return;
    }
    
    try {
      await settingsSaveQueue;
      await window.electronAPI.launchGame();
    } catch (e) {
      console.error('Launch error', e);
      set({ gameState: { status: 'error', message: launchErrorMessage(e) } });
    } finally {
      // Installation may finish even if a later game startup step fails.
      const directory = get().settings?.gameDirectory;
      try {
        const status = await window.electronAPI.getModpackStatus();
        if (get().settings?.gameDirectory === directory) set({ modpackStatus: status });
      } catch (e) { console.error('Failed to refresh installed modpack status', e); }
    }
  },

  installLauncherUpdate: async () => {
    try {
      if (window.electronAPI?.installUpdate) {
        await window.electronAPI.installUpdate();
      }
    } catch (e) {
      console.error('Failed to install update', e);
    }
  }
}));
