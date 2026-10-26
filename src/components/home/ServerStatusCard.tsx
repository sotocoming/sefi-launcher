import React, { useEffect, useState } from 'react';
import { Copy, Check, Wifi, Users, Server } from 'lucide-react';

import { useStore } from '../../store/store';

export const ServerStatusCard: React.FC = () => {
  const { serverStatus, launcherConfig, settings, updateSettings, gameState } = useStore();

  const isOnline = serverStatus?.online === true;
  const checking = !serverStatus;
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

  const selectedEndpoint = endpoints.find(endpoint => endpoint.id === selectedId);
  const selectedPort = selectedEndpoint && 'port' in selectedEndpoint && typeof selectedEndpoint.port === 'number' ? selectedEndpoint.port : port;
  const ping = isOnline && typeof serverStatus?.pingMs === 'number' ? serverStatus.pingMs : null;

  return <section className="server-panel server-connect" aria-label="Сервер сообщества">
    <div className="server-heading">
      <div className="server-title"><strong title={name}>{name}</strong></div>
      <span className={`online ${checking ? 'checking' : !isOnline ? 'offline' : ''}`}>
        <i aria-hidden="true"/><span>{checking ? 'Проверка…' : isOnline ? 'Онлайн' : 'Оффлайн'}</span>
      </span>
      <span className="player-count" aria-label={isOnline ? 'Игроки: '+playersOnline+' из '+playersMax : 'Игроки недоступны'}><Users size={15} strokeWidth={1.5} aria-hidden="true"/><span>{isOnline ? playersOnline : '—'}<small>{isOnline ? ' / '+playersMax : ''}</small></span></span>
    </div>
    <div className="connection-body">
      <div className="route-picker">
        <div className="route-tabs" role="radiogroup" aria-label="Адрес сервера для подключения">
          {endpoints.map(endpoint => <button key={endpoint.id} type="button" role="radio" aria-checked={selectedId === endpoint.id}
            disabled={busy} aria-label={endpoint.label+': '+endpoint.address}
            tabIndex={selectedEndpoint ? selectedId === endpoint.id ? 0 : -1 : endpoint.id === endpoints[0].id ? 0 : -1}
            onKeyDown={event => {
              if (busy || !settings || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const index = endpoints.findIndex(item => item.id === endpoint.id);
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? endpoints.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + endpoints.length) % endpoints.length;
              void updateSettings({ ...settings, selectedServerId: endpoints[next].id });
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
            }}
            onClick={() => { if (settings) void updateSettings({ ...settings, selectedServerId: endpoint.id }); }}>
            {endpoint.label}
          </button>)}
        </div>
        <div className="route-address">
          <div className="route-address-main"><Server size={15} strokeWidth={1.5} aria-hidden="true"/><span title={selectedEndpoint?.address}>{selectedEndpoint?.address || 'Выберите маршрут'}</span>
            <button className="copy-address" type="button" disabled={!selectedEndpoint}
              aria-label={selectedEndpoint ? 'Скопировать '+selectedEndpoint.label+': '+selectedEndpoint.address : 'Скопировать адрес'}
              onClick={async () => { if (!selectedEndpoint) return; try { await navigator.clipboard.writeText(selectedEndpoint.address); setCopied(selectedEndpoint.id); } catch { setCopied(null); } }}>
              {copied === selectedEndpoint?.id ? <Check size={13}/> : <Copy size={13}/>}
            </button>
          </div>
          <div className="route-address-meta"><span className="route-latency" aria-label={ping === null ? 'Пинг недоступен' : 'Пинг '+ping+' мс'}><Wifi size={15} strokeWidth={1.5} aria-hidden="true"/>{ping === null ? '—' : ping+' мс'}</span><span className="route-port"><Server size={14} strokeWidth={1.5} aria-hidden="true"/>Порт <b>{selectedPort}</b></span></div>
        </div>
      </div>
    </div>
    <label className="auto-row server-auto"><span>Подключаться сразу</span><input type="checkbox" checked={autoConnect} disabled={busy}
      onChange={event => { if (settings) void updateSettings({ ...settings, autoConnect: event.target.checked }); }}/></label>
  </section>;
};
