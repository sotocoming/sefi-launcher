import React from 'react';


import { useStore } from '../../store/store';
import modpackIcon from '../../assets/icons/homestead-modpack-icon.png';

export const ModpackStatusCard: React.FC = () => {
  const { modpackStatus, launcherConfig } = useStore();

  const name = launcherConfig?.modpack?.name || 'Homestead Cozy';
  const version = modpackStatus?.currentVersion || modpackStatus?.latestVersion || launcherConfig?.modpack?.version;
  const checking = !modpackStatus;
  const hasInstalledVersion = !!modpackStatus?.currentVersion;
  const hasUpdate = modpackStatus?.updateAvailable ?? false;

  return <section className="pack-panel" aria-label="Игровая сборка"><div className="pack-background-layer" aria-hidden="true"><img className="pack-background" src={modpackIcon} alt=""/></div>
  <div className="pack-heading"><div><h2>{name} {version&&<span>v{version}</span>}</h2><p>Minecraft 1.20.1 · Fabric</p></div></div>
  <div className="pack-description"><div className="pack-description-copy"><strong>Моды и настройки сервера</strong><p>{checking?'Проверяем установленную версию сборки.':!hasInstalledVersion?'Установим всё необходимое при первом запуске.':hasUpdate?'Новая версия установится при следующем запуске.':'Версию сборки проверяем перед каждым запуском.'}</p></div></div>
  <div className="pack-ready"><div><span className="pack-state-label">Состояние сборки</span><strong className={checking||!hasInstalledVersion||hasUpdate?'pack-pending':''}>{checking?'Проверка…':!hasInstalledVersion?'Нужна установка':hasUpdate?'Есть обновление':'Готово к запуску'}</strong></div></div></section>;
};
