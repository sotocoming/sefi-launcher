import React from 'react';
import { useStore } from '../../store/store';

export const ModpackStatusCard: React.FC = () => {
  const { modpackStatus, launcherConfig } = useStore();
  const name=launcherConfig?.modpack?.name || 'Homestead Cozy';
  const version=modpackStatus?.currentVersion || modpackStatus?.latestVersion || launcherConfig?.modpack?.version;
  const checking=!modpackStatus;
  const installed=!!modpackStatus?.currentVersion;
  const hasUpdate=modpackStatus?.updateAvailable ?? false;
  const statusKind=checking?'checking':!installed?'missing':hasUpdate?'update':'ready';
  const state=checking?'Проверка…':!installed?'Нужна установка':hasUpdate?'Есть обновление':'Готово к запуску';
  const detail=checking?'Проверяем установленную версию сборки.':!installed?'Установим моды и настройки сервера при первом запуске.':hasUpdate?'Новая версия установится при следующем запуске.':'Моды и настройки сервера проверяем перед каждым запуском.';
  return <section className="pack-panel" aria-label="Игровая сборка">
    <div className="pack-heading">
      <div className="pack-heading-line"><h2 title={name}>{name}</h2>{version&&<span className="pack-version" title={version}>v{version}</span>}</div>
      <p>Minecraft 1.20.1 · Fabric</p>
    </div>
    <p className="pack-summary">{detail}</p>
    <div className={'pack-status is-'+statusKind} role="status" aria-live="polite"><strong>{state}</strong></div>
  </section>;
};
