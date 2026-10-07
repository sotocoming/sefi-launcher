export interface Settings {
  ramMin: number;
  ramMax: number;
  javaPath: string;
  gameDirectory: string;
  windowWidth: number;
  windowHeight: number;
  closeOnLaunch: boolean;
  fullscreen: boolean;
}

export interface CommunityProfile {
  id: number;
  twitch_id: string;
  twitch_login: string;
  twitch_display_name: string;
  twitch_avatar: string;
  discord_id: string | null;
  discord_username: string | null;
  discord_avatar: string | null;
  mc_nickname: string | null;
  mc_type: 'offline' | 'microsoft';
  whitelist_status: 'pending' | 'approved' | 'rejected';
  session_token: string;
}

export interface Account {
  id: string;
  username: string;
  uuid: string;
  accessToken: string;
  clientToken: string;
  type: 'microsoft' | 'offline';
  skinUrl?: string;
  active: boolean;
  communityToken?: string;
  whitelistStatus?: 'pending' | 'approved' | 'rejected';
  twitchLogin?: string;
  twitchAvatar?: string;
  mcType?: 'offline' | 'microsoft';
  mcUuid?: string | null;
}

export interface ModpackInfo {
  name: string;
  version: string;
  minecraft: string;
  loader: 'fabric' | 'forge' | 'quilt';
  loaderVersion: string;
  curseforgeProjectId: number;
  curseforgeFileId: number;
  sha256: string;
  size: number;
}

export interface ModpackStatus {
  installed: boolean;
  currentVersion: string | null;
  latestVersion: string;
  updateAvailable: boolean;
  modpack: ModpackInfo;
}

export interface LauncherConfig {
  modpack: ModpackInfo;
  server: {
    name?: string;
    ip: string;
    port: number;
  };
  launcher: {
    title: string;
    background: string;
    minVersion: string;
  };
  news: NewsItem[];
}

export interface NewsItem {
  status?: string;
  time?: string;
  id: string;
  title: string;
  body: string;
  date: string;
  image?: string;
  tag?: 'event' | 'update' | 'news';
  url?: string;
  likes?: number;
  dislikes?: number;
  archived?: boolean;
}

export interface DownloadProgress {
  stage: 'modpack' | 'assets' | 'libraries' | 'java' | 'fabric';
  task: string;
  total: number;
  downloaded: number;
  percentage: number;
  speed?: number;
}

export type GameState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'downloading'; progress: DownloadProgress }
  | { status: 'extracting' }
  | { status: 'launching' }
  | { status: 'running'; pid: number }
  | { status: 'error'; message: string };

export interface ServerStatus {
  online: boolean;
  players: number;
  maxPlayers: number;
  motd: string;
  version: string;
  favicon?: string;
}

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

export interface UpdateInfo {
  status: UpdateStatus;
  version?: string;
  releaseNotes?: string;
  percent?: number;
  transferred?: number;
  total?: number;
  error?: string;
}
