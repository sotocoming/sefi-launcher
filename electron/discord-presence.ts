import { DiscordRpc, type DiscordActivity } from './discord-rpc';
import type { GameState, LauncherConfig } from '../src/types';
import type { GameLocation } from './game-presence';
import settings from './discord-presence-config.json';

function clean(value: string): string { return value.replace(/§./g, '').replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 120); }
function address(value: string): string { return value.toLowerCase().replace(/:25565$/, ''); }
function worldName(dimension?: string): string {
  if (!dimension) return '';
  return ({ 'minecraft:overworld': 'Обычный мир', 'minecraft:the_nether': 'Незер', 'minecraft:the_end': 'Энд' } as Record<string, string>)[dimension] || 'Другой мир';
}
export function playerCount(count: number): string {
  const lastTwo = count % 100, last = count % 10;
  return `${count} ${lastTwo >= 11 && lastTwo <= 14 ? 'игроков' : last === 1 ? 'игрок' : last >= 2 && last <= 4 ? 'игрока' : 'игроков'}`;
}

export function activityFor(state: GameState, location: GameLocation | null, config: LauncherConfig | undefined,
  started: number): DiscordActivity {
  const name = clean(config?.server.name || 'Sweet Home');
  let details = 'В лаунчере', description = 'Готовится к приключению';
  if (['checking', 'downloading', 'extracting'].includes(state.status)) { details = 'Готовит Minecraft'; description = 'Собирает всё для игры'; }
  if (state.status === 'launching') { details = 'Запускает Minecraft'; description = 'Скоро в игре'; }
  if (state.status === 'running') {
    details = 'Minecraft запущен'; description = 'Выбирает приключение';
    if (location?.mode === 'menu') { details = 'В главном меню'; description = 'Выбирает приключение'; }
    if (location?.mode === 'singleplayer') { details = 'Одиночный мир'; description = worldName(location.dimension) || 'Играет в Minecraft'; }
    if (location?.mode === 'multiplayer') {
      const known = [config ? `${config.server.ip}:${config.server.port}` : '',
        ...(config?.server.endpoints?.map(endpoint => endpoint.address) || [])].filter(Boolean);
      const ours = known.some(value => address(value) === address(location.server || ''));
      const endpoint = config?.server.endpoints?.find(value => address(value.address) === address(location.server || ''));
      const region = ours && endpoint?.label ? clean(endpoint.label).slice(0, 32) : '';
      details = (ours ? 'На сервере' : 'Другой сервер') + (location.players ? ` · ${playerCount(location.players)}` : '');
      description = [worldName(location.dimension), region].filter(Boolean).join(' · ') || 'Играет в Minecraft';
    }
  }
  return { type: 0, details, state: description,
    ...(state.status === 'running' ? { timestamps: { start: started } } : {}),
    assets: { large_image: settings.imageUrl || settings.imageKey, large_text: name },
    buttons: [{ label: 'Сайт сервера', url: settings.website }] };
}

export class DiscordPresence {
  private rpc = new DiscordRpc(settings.applicationId);
  private state: GameState = { status: 'idle' };
  private location: GameLocation | null = null;
  private config?: LauncherConfig;
  private started = Math.floor(Date.now() / 1000);
  configure(enabled: boolean, config?: LauncherConfig): void {
    if (config) this.config = config;
    this.publish(); this.rpc.setEnabled(enabled);
  }
  gameState(state: GameState): void {
    if (state.status === 'running' && this.state.status !== 'running') this.started = Math.floor(Date.now() / 1000);
    if (state.status !== 'running') this.location = null;
    this.state = state; this.publish();
  }
  gameLocation(location: GameLocation | null): void { this.location = location; this.publish(); }
  private publish(): void { this.rpc.setActivity(activityFor(this.state, this.location, this.config, this.started)); }
  close(): void { this.rpc.close(); }
}
