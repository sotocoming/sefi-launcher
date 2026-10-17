import React from 'react';
import { motion } from 'framer-motion';
import { ServerStatusCard } from '../components/home/ServerStatusCard';
import { ModpackStatusCard } from '../components/home/ModpackStatusCard';
import { PlayButton } from '../components/home/PlayButton';
import { NewsBanner } from '../components/home/NewsBanner';
import { useStore } from '../store/store';
import bgImage from '../assets/backgrounds/sefi-home-background.png';

interface HomePageProps {
  onNavigate: (page: 'home' | 'map' | 'news' | 'accounts' | 'settings') => void;
}
export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const serverName = useStore(state => state.launcherConfig?.server?.name?.trim() || 'Sweet Home');
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="home-view">
      <header className="home-hero">
        <img src={bgImage} alt="" className="home-hero-image" />
        <div className="home-hero-shade" />
        <div className="home-heading">
          <p className="text-sm font-medium text-sefi-purple">Твой уютный мир</p>
          <h1>{serverName}</h1>
          <p className="max-w-md text-sm leading-6 text-sefi-textSecondary">Возвращайся к своим постройкам, открытиям и друзьям.</p>
        </div>
      </header>
      <div className="home-content">
        <div className="home-status">
          <ServerStatusCard />
          <ModpackStatusCard />
        </div>
        <NewsBanner onOpenNews={() => onNavigate('news')} />
        <PlayButton onOpenAccounts={() => onNavigate('accounts')} />
      </div>
    </motion.div>
  );
};
