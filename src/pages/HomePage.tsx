import React from 'react';
import { motion } from 'framer-motion';
import { ServerStatusCard } from '../components/home/ServerStatusCard';
import { ModpackStatusCard } from '../components/home/ModpackStatusCard';
import { PlayButton } from '../components/home/PlayButton';
import { NewsBanner } from '../components/home/NewsBanner';
import { useStore } from '../store/store';
import bgImage from '../assets/backgrounds/sefi-home-background.png';
import mascotImage from '../assets/characters/sefi-mascot.png';

interface HomePageProps {
  onNavigate: (page: 'home' | 'map' | 'news' | 'accounts' | 'settings') => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const serverName = useStore(state => state.launcherConfig?.server?.name?.trim() || 'Sweet Home');
  return (
    <motion.div
      key="home"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="relative h-full overflow-hidden select-none"
    >
      {/* Background with warm depth, vignette and atmospheric lighting */}
      <div
        className="absolute inset-0 bg-cover bg-center scale-[1.02] filter contrast-[1.05] brightness-[0.88]"
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#09090d_6%,rgba(9,9,13,0.72)_36%,rgba(9,9,13,0.45)_68%,rgba(9,9,13,0.75)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(196,92,255,0.12)_0%,transparent_60%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(0deg,#09090d_8%,transparent_45%,rgba(0,0,0,0.35)_100%)]" />

      {/* Sefirota Mascot (placed on the right, mirrored horizontally) */}
      <div className="pointer-events-none absolute bottom-0 right-4 z-0 w-[420px] max-w-[36vw] opacity-85 transition-opacity duration-500">
        <img
          src={mascotImage}
          alt="Sefirota Mascot"
          className="h-auto w-full object-contain -scale-x-100 filter drop-shadow-[0_0_40px_rgba(180,92,255,0.35)] drop-shadow-[0_12px_24px_rgba(0,0,0,0.8)]"
        />
      </div>


      {/* Main Content Area */}
      <div className="relative z-10 flex h-full flex-col px-8 pb-7 pt-6 overflow-y-auto">
        <header className="max-w-[580px]">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-300/80">
            <span className="size-1.5 rounded-full bg-fuchsia-400 shadow-[0_0_8px_#d18aff]" />
            <span className="truncate" title={serverName}>{serverName}</span>
          </div>

          <h1 className="text-[34px] font-black leading-[1.05] tracking-[-0.03em] text-white">
            Твой уютный мир
            <br />
            <span className="text-white/40">Всегда рядом</span>
          </h1>

          <p className="mt-2 text-xs text-white/45">
            Minecraft 1.20.1 • Fabric • 300+ модов
          </p>
        </header>

        {/* Lower Rows: Strictly max-w-[580px] so Sefirota is never covered and cards are never pushed */}
        <div className="mt-auto space-y-3 max-w-[580px]">
          {/* Status Cards Row: Rigid 122px height */}
          <div className="grid grid-cols-2 gap-3">
            <ServerStatusCard />
            <ModpackStatusCard />
          </div>

          {/* Compact News Banner (Fixed 48px height, never expands upwards) */}
          <NewsBanner onOpenNews={() => onNavigate('news')} />

          {/* Play Button Row */}
          <div className="w-full">
            <PlayButton />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
