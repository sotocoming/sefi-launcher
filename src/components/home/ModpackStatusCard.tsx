import React from 'react';
import { Check, ArrowUpCircle, Download, Loader2, Layers3 } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { useStore } from '../../store/store';
import modpackIcon from '../../assets/icons/homestead-modpack-icon.png';

export const ModpackStatusCard: React.FC = () => {
  const { modpackStatus, launcherConfig } = useStore();

  const name = launcherConfig?.modpack?.name || 'Homestead Cozy';
  const version = modpackStatus?.currentVersion || modpackStatus?.latestVersion || launcherConfig?.modpack?.version;
  const checking = !modpackStatus;
  const hasInstalledVersion = !!modpackStatus?.currentVersion;
  const hasUpdate = modpackStatus?.updateAvailable ?? false;

  return (
    <GlassCard className="pack-panel">
      <div className="flex min-h-12 shrink-0 items-center gap-2.5 min-w-0">
        <div className="size-12 shrink-0 rounded-lg overflow-hidden border border-fuchsia-400/25 bg-black/40 ">
          <img src={modpackIcon} alt="" className="size-full object-cover" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-xs text-sefi-textSecondary font-medium">{hasInstalledVersion ? 'Установленная сборка' : 'Игровая сборка'}</div>
          <div className="text-base font-semibold text-white truncate">
            {name} {version && <span className="text-fuchsia-300 font-semibold">v{version}</span>}
          </div>
        </div>
      </div>

      <div className="shrink-0 py-2">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-fuchsia-200/70">
          <Layers3 size={12} className="shrink-0 text-fuchsia-300/60" />
          Моды и настройки сервера
        </div>
        <p className="text-sm leading-relaxed text-sefi-textSecondary">
          {checking ? 'Уточняем установленную версию сборки.' : !hasInstalledVersion ? 'Установим всё необходимое при первом запуске.' : hasUpdate ? 'Новая версия установится при следующем запуске.' : 'Перед каждым запуском проверяем версию сборки.'}
        </p>
      </div>

      <div className={`flex min-h-10 flex-wrap shrink-0 items-center justify-between gap-2 rounded-lg border px-3 ${hasUpdate || !hasInstalledVersion ? 'border-amber-400/15 bg-amber-400/[0.06]' : 'border-emerald-400/15 bg-emerald-400/[0.06]'}`}>
        <div className="flex flex-1 items-center gap-2 min-w-0">
          {checking ? (
            <><Loader2 size={14} className="text-white/40 shrink-0 animate-spin" /><span className="text-xs font-semibold text-white/50 leading-4 ">Проверка</span></>
          ) : !hasInstalledVersion ? (
            <><Download size={14} className="text-amber-400 shrink-0" /><span className="text-xs font-semibold text-amber-300 leading-4 whitespace-nowrap">Установить</span></>
          ) : hasUpdate ? (
            <>
              <ArrowUpCircle size={14} className="text-amber-400 shrink-0" />
              <span className="text-xs font-semibold text-amber-300 leading-4 whitespace-nowrap">
                Обновление
              </span>
            </>
          ) : (
            <>
              <Check size={14} className="text-emerald-400 shrink-0 stroke-[2.5]" />
              <span className="text-xs font-semibold text-emerald-300 leading-4 whitespace-nowrap">
                Готово к запуску
              </span>
            </>
          )}
        </div>

        <div className="text-xs tabular-nums text-white/40 shrink-0 bg-black/30 px-1.5 py-0.5 rounded border border-white/[0.04]">
          1.20.1 Fabric
        </div>
      </div>
    </GlassCard>
  );
};
