import React from 'react';
import './HomePage.css';
import { motion } from 'framer-motion';
import { ServerStatusCard } from '../components/home/ServerStatusCard';
import { ModpackStatusCard } from '../components/home/ModpackStatusCard';
import { PlayButton } from '../components/home/PlayButton';
import { NewsBanner } from '../components/home/NewsBanner';
import { useStore } from '../store/store';
import world from '../assets/interface/world.png';
import mascot from '../assets/interface/mascot.png';
export const HomePage: React.FC<{onNavigate:(page:'home'|'map'|'news'|'accounts'|'settings')=>void}> = ({onNavigate}) => {
 const name=useStore(s=>s.launcherConfig?.server?.name || 'Sweet Home');
 return <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="home-scene">
  <img className="original-world" src={world} alt=""/>
  <div className="original-intro"><h1>Твой уютный мир<br/><span>Всегда рядом</span></h1><p><b>{name}</b> · Minecraft 1.20.1 · Fabric</p></div>
  <img className="original-mascot" src={mascot} alt="Маскот SEFI с чёрным котом"/>
  <div className="original-console"><div className="launcher-overview"><div className="status-panels"><ServerStatusCard/><ModpackStatusCard/></div></div><NewsBanner onOpenNews={()=>onNavigate('news')}/><PlayButton onOpenAccounts={()=>onNavigate('accounts')}/></div>
 </motion.div>;
};
