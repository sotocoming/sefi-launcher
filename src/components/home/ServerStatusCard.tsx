import React, { useEffect, useState } from 'react';
import { Server, Users, Activity, Wifi, Copy, Check } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { useStore } from '../../store/store';

export const ServerStatusCard: React.FC = () => {
  const { serverStatus, launcherConfig } = useStore();

  const isOnline = serverStatus?.online ?? true;
  const playersOnline = serverStatus?.players ?? 0;
  const playersMax = serverStatus?.maxPlayers ?? 20;
  const ip = launcherConfig?.server?.ip || 'minecraft.sotocoming.ru';
  const port = launcherConfig?.server?.port || 25565;
  const address = port === 25565 ? ip : `${ip}:${port}`;
  const endpoints = launcherConfig?.server?.endpoints?.length ? launcherConfig.server.endpoints : [{ id: 'primary', label: 'Основной', address }];
  const name = launcherConfig?.server?.name || 'Sweet Home';
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(null), 1800); return () => clearTimeout(timer); }, [copied]);

  return (
    <GlassCard className="p-3.5 flex flex-col justify-between gap-2 h-[192px]">
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

        <div className="flex items-center gap-1.5 rounded-full bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 shrink-0">
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

      <div className="space-y-1" aria-label="Адреса сервера">
        {endpoints.map(endpoint => <button key={endpoint.id} type="button"
          className="group flex w-full min-w-0 items-center gap-2 rounded-md bg-white/[0.025] px-2 py-1 text-left hover:bg-white/[0.06] transition-colors"
          title={`${endpoint.label}: ${endpoint.address} · скопировать`}
          aria-label={`Скопировать ${endpoint.label}: ${endpoint.address}`}
          onClick={async () => { try { await navigator.clipboard.writeText(endpoint.address); setCopied(endpoint.id); } catch { setCopied(null); } }}>
          <span className="w-12 shrink-0 truncate text-[8px] font-semibold uppercase text-fuchsia-300/80">{endpoint.label}</span>
          <code className="min-w-0 flex-1 truncate text-[10px] leading-4 text-white/75">{copied === endpoint.id ? 'Скопировано' : endpoint.address}</code>
          {copied === endpoint.id ? <Check size={11} className="shrink-0 text-emerald-300" /> : <Copy size={11} className="shrink-0 text-white/30 group-hover:text-white/70" />}
        </button>)}
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.05]">
        <div className="rounded-lg bg-black/30 border border-white/[0.04] px-2 py-1.5 text-center">
          <div className="flex items-center justify-center gap-1 text-[9px] text-white/40 font-medium">
            <Users size={10} />
            <span>Игроки</span>
          </div>
          <div className="mt-0.5 text-[11px] font-bold text-white/90">
            {playersOnline} / {playersMax}
          </div>
        </div>

        <div className="rounded-lg bg-black/30 border border-white/[0.04] px-2 py-1.5 text-center">
          <div className="flex items-center justify-center gap-1 text-[9px] text-white/40 font-medium">
            <Activity size={10} />
            <span>Пинг</span>
          </div>
          <div className="mt-0.5 text-[11px] font-bold text-emerald-300">
            ~35 ms
          </div>
        </div>

        <div className="rounded-lg bg-black/30 border border-white/[0.04] px-2 py-1.5 text-center">
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
