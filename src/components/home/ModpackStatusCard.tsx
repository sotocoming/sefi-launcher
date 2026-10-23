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

  const state = checking ? 'Проверка…' : !hasInstalledVersion ? 'Нужна установка' : hasUpdate ? 'Есть обновление' : 'Готово к запуску';
  const detail = checking ? 'Проверяем установленную версию сборки.' : !hasInstalledVersion ? 'Установим моды и настройки сервера при первом запуске.' : hasUpdate ? 'Новая версия установится при следующем запуске.' : 'Моды и настройки сервера проверяем перед запуском.';
  return <section className="pack-panel" aria-label="Игровая сборка">
    <div className="pack-background-layer" aria-hidden="true"><img className="pack-background" src={modpackIcon} alt=""/></div>
    <div className="pack-heading"><div><h2>{name} {version && <span>v{version}</span>}</h2><p>Minecraft 1.20.1 · Fabric</p></div></div>
    <div className="pack-description"><strong className={checking || !hasInstalledVersion || hasUpdate ? 'pack-pending' : 'pack-ready-text'}>{state}</strong><p>{detail}</p></div>
  </section>;
};
