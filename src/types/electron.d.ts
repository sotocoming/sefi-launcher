import type {
  Settings,
  Account,
  ModpackStatus,
  LauncherConfig,
  DownloadProgress,
  GameState,
  ServerStatus,
  UpdateInfo,
} from './index';

export interface IElectronAPI {
  // Game
  launchGame(): Promise<void>;

  // Settings
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
  selectJavaPath(): Promise<string | null>;
  selectGameDirectory(): Promise<string | null>;
  openDirectory(dirPath: string): Promise<void>;

  // Accounts & Community
  getAccounts(): Promise<Account[]>;
  addOfflineAccount(username: string): Promise<Account>;
  loginMicrosoft(): Promise<Account>;
  loginCommunity(): Promise<Account>;
  linkMinecraftAccount(id: string): Promise<Account | null>;
  refreshCommunityProfile(token: string): Promise<Account | null>;
  removeAccount(id: string): Promise<void>;
  setActiveAccount(id: string): Promise<void>;

  getCommunitySkin(id: string): Promise<import('./index').CommunitySkin | null>;
  chooseSkin(): Promise<import('./index').SkinDraft | null>;
  saveCommunitySkin(id: string, png: string, model: 'classic' | 'slim'): Promise<import('./index').CommunitySkin | null>;
  resetCommunitySkin(id: string): Promise<null>;

  // Modpack
  getModpackStatus(): Promise<ModpackStatus>;
  importModpackArchive(): Promise<{ cancelled: boolean; name?: string }>;

  // Server config
  getLauncherConfig(): Promise<LauncherConfig>;
  getServerStatus(): Promise<ServerStatus>;
  getNewsReactions(): Promise<{ok: boolean; votes: Record<string, 'like' | 'dislike'>}>;
  reactNews(id: string, reaction: 'like' | 'dislike', prev: 'like' | 'dislike' | null): Promise<{ ok: boolean; likes: number; dislikes: number; user_vote: 'like' | 'dislike' | null }>;

  // Updates & Links
  checkForUpdates(): Promise<UpdateInfo>;
  installUpdate(): Promise<void>;
  openExternal(url: string): Promise<void>;

  // Events
  onDownloadProgress(callback: (progress: DownloadProgress) => void): () => void;
  onGameStateChange(callback: (state: GameState) => void): () => void;
  onUpdateStatusChange(callback: (info: UpdateInfo) => void): () => void;

  // Window controls
  minimize(): void;
  maximize(): void;
  close(): void;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

export {};
