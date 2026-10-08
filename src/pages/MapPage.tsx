import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, RotateCw, Compass } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';

export const MapPage: React.FC = () => {
  const [iframeKey, setIframeKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const handleOpenExternal = () => {
    const url = 'https://mc.sotocoming.ru/maps';
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const handleReload = () => {
    setIsLoading(true);
    setIframeKey((prev) => prev + 1);
  };

  return (
    <motion.div
      key="map"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="relative flex h-full flex-col overflow-hidden bg-[#09090d] select-none pt-6 px-8 pb-6"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-300">
            <Compass size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">
                Карта сервера Homestead
              </h1>
              <span className="rounded-full bg-emerald-500/15 border border-emerald-400/25 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                Онлайн мир
              </span>
            </div>
            <p className="text-xs text-white/45">
              Спутниковый обзор верхнего мира, ландшафта и построек поселенцев
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReload}
            title="Перезагрузить карту"
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/[0.08] hover:text-white"
          >
            <RotateCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Обновить</span>
          </button>

          <button
            onClick={handleOpenExternal}
            className="flex items-center gap-1.5 rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/15 px-3 py-1.5 text-xs font-medium text-fuchsia-200 transition hover:bg-fuchsia-500/25 hover:text-white"
          >
            <span>В браузере</span>
            <ExternalLink size={13} />
          </button>
        </div>
      </div>

      {/* Main Map Viewer */}
      <GlassCard className="relative flex-1 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101711] p-0 shadow-2xl">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0d120e] gap-3">
            <div className="size-8 animate-spin rounded-full border-2 border-emerald-400/20 border-t-emerald-400" />
            <span className="text-xs font-mono text-emerald-300/80 tracking-wide">
              Загрузка карты мира Homestead…
            </span>
          </div>
        )}

        <iframe
          key={iframeKey}
          src="https://mc.sotocoming.ru/maps"
          title="Homestead Server Map"
          className="size-full border-0 bg-[#101711]"
          onLoad={() => setIsLoading(false)}
        />
      </GlassCard>
    </motion.div>
  );
};
