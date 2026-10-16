import React, { useEffect, useState } from 'react';
import { Server, Users, Activity, Wifi, Copy, Check } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { useStore } from '../../store/store';

export const ServerStatusCard: React.FC = () => {
  const { serverStatus, launcherConfig, settings, updateSettings, gameState } = useStore();

  const isOnline = serverStatus?.online ?? true;
  const playersOnline = serverStatus?.players ?? 0;
  const playersMax = serverStatus?.maxPlayers ?? 20;
  const ip = launcherConfig?.server?.ip || 'minecraft.sotocoming.ru';
  const port = launcherConfig?.server?.port || 25565;
  const address = port === 25565 ? ip : `${ip}:${port}`;
  const endpoints = launcherConfig?.server?.endpoints?.length ? launcherConfig.server.endpoints : [{ id: 'primary', label: 'Основной', address }];
  const selectedId = settings?.selectedServerId || endpoints[0].id;
  const autoConnect = settings?.autoConnect === true;
  const busy = !settings || ['checking', 'downloading', 'extracting', 'launching', 'running'].includes(gameState.status);
  const name = launcherConfig?.server?.name || 'Sweet Home';
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(null), 1800); return () => clearTimeout(timer); }, [copied]);

  return (
    <GlassCard className="p-3.5 flex flex-col justify-between gap-1 h-[192px]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_12px_rgba(52,211,153,0.1)]">
            <Server size={17} />
          </div>

          <div className="min-w-0">
            <div className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Сервер сообщества</div>
            <div className="text-xs font-bold text-white tracking-wide truncate max-w-[150px]" title={name}>
              {name}
            </div>
          </div>
        </div>

        <div className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold shrink-0 ${isOnline ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-300' : 'bg-rose-400/10 border-rose-400/20 text-rose-300'}`}>
          <span className="relative flex size-1.5">
            {isOnline && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            )}
            <span
              className={`relative inline-flex size-1.5 rounded-full ${
                isOnline ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
            />
          </span>
          {isOnline ? 'Онлайн' : 'Оффлайн'}
        </div>
      </div>

      <div className="space-y-1 shrink-0" role="radiogroup" aria-label="Адрес сервера для подключения">
        {endpoints.map(endpoint => <div key={endpoint.id}
          className={`group flex h-[22px] min-w-0 items-center rounded-md border transition-colors ${autoConnect && selectedId === endpoint.id ? 'border-fuchsia-400/20 bg-fuchsia-400/[0.07]' : 'border-transparent bg-white/[0.025] hover:bg-white/[0.06]'}`}>
          <button type="button" role="radio" aria-checked={autoConnect && selectedId === endpoint.id}
            disabled={busy || !autoConnect} title={`Подключение через ${endpoint.label}: ${endpoint.address}`}
            aria-label={`${endpoint.label}: ${endpoint.address}`}
            className="flex h-full min-w-0 flex-1 items-center gap-1.5 px-2 text-left rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fuchsia-300 disabled:cursor-default"
            onClick={() => { if (settings) void updateSettings({ ...settings, selectedServerId: endpoint.id }); }}>
            <span aria-hidden="true" className={`${autoConnect ? 'visible' : 'invisible'} flex size-2.5 shrink-0 items-center justify-center rounded-full border ${selectedId === endpoint.id ? 'border-fuchsia-300/70' : 'border-white/20'}`}>
              {selectedId === endpoint.id && <span className="size-1 rounded-full bg-fuchsia-300" />}
            </span>
            <span className="w-7 shrink-0 truncate text-[8px] font-semibold uppercase text-fuchsia-300/80">{endpoint.label}</span>
            <code className="min-w-0 flex-1 truncate text-[9px] leading-4 text-white/75">{copied === endpoint.id ? 'Скопировано' : endpoint.address}</code>
          </button>
          <button type="button" title="Скопировать адрес" aria-label={`Скопировать ${endpoint.label}: ${endpoint.address}`}
            className="flex h-full w-6 shrink-0 items-center justify-center rounded-md text-white/30 hover:text-white/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fuchsia-300"
            onClick={async () => { try { await navigator.clipboard.writeText(endpoint.address); setCopied(endpoint.id); } catch { setCopied(null); } }}>
            {copied === endpoint.id ? <Check size={10} className="text-emerald-300" /> : <Copy size={10} />}
          </button>
        </div>)}
      </div>

      <label className="flex h-4 shrink-0 cursor-pointer items-center justify-between gap-2 text-[9px] text-white/50" title="После запуска Minecraft подключаться к выбранному адресу">
        <span>Подключаться сразу</span>
        <input type="checkbox" checked={autoConnect} disabled={busy}
          className="peer sr-only"
          onChange={event => { if (settings) void updateSettings({ ...settings, autoConnect: event.target.checked }); }} />
        <span aria-hidden="true" className="relative h-3.5 w-6 shrink-0 rounded-full border border-white/10 bg-white/[0.06] transition-colors peer-checked:border-fuchsia-400/40 peer-checked:bg-fuchsia-500/30 peer-focus-visible:ring-1 peer-focus-visible:ring-fuchsia-300 peer-disabled:opacity-40">
          <span className={`absolute top-0.5 size-2 rounded-full transition-all ${autoConnect ? 'left-3 bg-fuchsia-300' : 'left-0.5 bg-white/40'}`} />
        </span>
      </label>

      <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-white/[0.05]">
        <div className="rounded-lg bg-black/30 border border-white/[0.04] px-2 py-1 text-center">
          <div className="flex items-center justify-center gap-1 text-[9px] text-white/40 font-medium">
            <Users size={10} />
            <span>Игроки</span>
          </div>
          <div className="mt-0.5 text-[11px] font-bold text-white/90">
            {playersOnline} / {playersMax}
          </div>
        </div>

        <div className="rounded-lg bg-black/30 border border-white/[0.04] px-2 py-1 text-center">
          <div className="flex items-center justify-center gap-1 text-[9px] text-white/40 font-medium">
            <Activity size={10} />
            <span>Пинг</span>
          </div>
          <div className="mt-0.5 text-[11px] font-bold text-emerald-300">
            ~35 ms
          </div>
        </div>

        <div className="rounded-lg bg-black/30 border border-white/[0.04] px-2 py-1 text-center">
          <div className="flex items-center justify-center gap-1 text-[9px] text-white/40 font-medium">
            <Wifi size={10} />
            <span>Порт</span>
          </div>
          <div className="mt-0.5 text-[11px] font-bold text-white/90">
            {port}
          </div>
        </div>
      </div>
    </GlassCard>
  );
};
