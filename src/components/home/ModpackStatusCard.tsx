import React from 'react';
import { Check, ArrowUpCircle } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { useStore } from '../../store/store';
import modpackIcon from '../../assets/icons/homestead-modpack-icon.png';

export const ModpackStatusCard: React.FC = () => {
  const { modpackStatus, launcherConfig } = useStore();

  const name = launcherConfig?.modpack?.name || 'Homestead Cozy';
  const version = launcherConfig?.modpack?.version || '1.0.0';
  const hasUpdate = modpackStatus?.updateAvailable ?? false;

  return (
    <GlassCard className="p-3.5 flex flex-col justify-between h-[122px]">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="size-9 shrink-0 rounded-xl overflow-hidden border border-fuchsia-400/25 bg-black/40 shadow-[0_0_12px_rgba(180,92,255,0.15)]">
          <img src={modpackIcon} alt="Icon" className="size-full object-cover" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Установленная сборка</div>
          <div className="text-xs font-bold text-white tracking-wide truncate">
            {name} <span className="text-fuchsia-300 font-semibold">v{version}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          {hasUpdate ? (
            <>
              <ArrowUpCircle size={14} className="text-amber-400 shrink-0" />
              <span className="text-[11px] font-semibold text-amber-300 truncate">
                Обновление готово
              </span>
            </>
          ) : (
            <>
              <Check size={14} className="text-emerald-400 shrink-0 stroke-[2.5]" />
              <span className="text-[11px] font-semibold text-emerald-300 truncate">
                Готово к запуску
              </span>
            </>
          )}
        </div>

        <div className="text-[10px] font-mono text-white/40 shrink-0 bg-black/30 px-1.5 py-0.5 rounded border border-white/[0.04]">
          1.20.1 Fabric
        </div>
      </div>
    </GlassCard>
  );
};
