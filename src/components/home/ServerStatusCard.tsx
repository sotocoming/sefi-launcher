import React, { useEffect, useState } from 'react';
import { Copy, Check, Users, Wifi } from 'lucide-react';

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

  return <section className="server-panel" aria-label="Сервер сообщества">
   <div className="server-heading"><div className="server-title"><strong>{name}</strong><p>Сервер сообщества</p></div><span className={`online ${checking?'checking':!isOnline?'offline':''}`}><i aria-hidden="true"/><span>{checking?'Проверка…':isOnline?'Онлайн':'Оффлайн'}</span></span></div>
   <div className="connection-body"><div className="endpoint-list" role="radiogroup" aria-label="Адрес сервера для подключения">{endpoints.map(e=><div className={`endpoint ${autoConnect&&selectedId===e.id?'selected':''}`} key={e.id}>
   <button className="endpoint-select" role="radio" aria-checked={autoConnect&&selectedId===e.id} disabled={busy||!autoConnect} aria-label={e.label+': '+e.address} onClick={()=>{if(settings)void updateSettings({...settings,selectedServerId:e.id});}}><span className={`endpoint-radio ${!autoConnect?'invisible':''}`} aria-hidden="true">{selectedId===e.id&&<i/>}</span><b>{e.label}</b><span>{e.address}</span></button>
   <button className="copy-address" aria-label={'Скопировать '+e.label+': '+e.address} onClick={async()=>{try{await navigator.clipboard.writeText(e.address);setCopied(e.id);}catch{setCopied(null);}}}>{copied===e.id?<Check size={12}/>:<Copy size={12}/>}</button></div>)}</div>
   <label className="auto-row"><span>Подключаться сразу</span><input type="checkbox" checked={autoConnect} disabled={busy} onChange={event=>{if(settings)void updateSettings({...settings,autoConnect:event.target.checked});}}/></label></div>
   <dl className="server-metrics server-readouts">
     <div><dt className="sr-only">Игроки</dt><dd><Users size={13} aria-hidden="true"/><span className="metric-value">{checking||!isOnline?'—':playersOnline}</span>{isOnline&&<span className="metric-unit">/ {playersMax}</span>}</dd></div>
     <div><dt className="sr-only">Пинг</dt><dd className="ping"><Wifi size={13} aria-hidden="true"/><span className="metric-value">{isOnline&&typeof serverStatus?.pingMs==='number'?serverStatus.pingMs:'—'}</span>{isOnline&&typeof serverStatus?.pingMs==='number'&&<span className="metric-unit">мс</span>}</dd></div>
     <div className="port-readout"><dt>Порт</dt><dd>{port}</dd></div>
   </dl>
  </section>;
};
