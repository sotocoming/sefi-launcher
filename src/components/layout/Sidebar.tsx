import { PlayerAvatar } from '../accounts/PlayerAvatar';
import React from 'react';
import { Home, Map, Newspaper, UserRound, Settings, Heart, ChevronRight } from 'lucide-react';

import { useStore } from '../../store/store';
import sefiLogo from '../../assets/interface/logo-cat.png';
import { version as launcherVersion } from '../../../package.json';

interface SidebarProps {
  currentPage: 'home' | 'map' | 'news' | 'accounts' | 'settings';
  onNavigate: (page: 'home' | 'map' | 'news' | 'accounts' | 'settings') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate }) => {
  const { activeAccount, news, launcherConfig } = useStore();

  const publishedNewsCount = (news || []).filter(
    n => (n.status === 'published' || (!n.status && !n.archived)) && !n.archived && n.status !== 'scheduled'
  ).length;

  const navItems = [
    { id: 'home' as const, label: 'Главная', icon: Home },
    { id: 'map' as const, label: 'Карта сервера', icon: Map },
    { id: 'news' as const, label: 'Новости', icon: Newspaper, count: publishedNewsCount },
    { id: 'accounts' as const, label: 'Аккаунт', icon: UserRound },
    { id: 'settings' as const, label: 'Настройки', icon: Settings },
  ];

  const links = (launcherConfig?.community_links || []).filter(link => {
    try { const url = new URL(link.url); return ['support','discord','twitch'].includes(link.id) && url.protocol === 'https:' && !url.username && !url.password; }
    catch { return false; }
  });
  const status=activeAccount?.communityConnected ? activeAccount.whitelistStatus === 'approved' ? 'Доступ открыт' : activeAccount.whitelistStatus === 'rejected' ? 'Доступ отклонён' : 'Ожидает одобрения' : activeAccount ? 'Готово к игре' : 'Требуется вход';
  return <aside className="sidebar">
   <button className="brand-button" onClick={()=>onNavigate('home')} aria-label="SEFI — главная"><img className="logo" src={sefiLogo} alt="SEFI Launcher"/></button>
   <nav className="nav" aria-label="Основная навигация">{navItems.map(item=><button key={item.id} className={currentPage===item.id?'active':''} aria-current={currentPage===item.id?'page':undefined} onClick={()=>onNavigate(item.id)}><item.icon size={16} strokeWidth={1.7}/><span>{item.label}</span></button>)}</nav>
   <div className="community-actions">{links.map(link=><button className="community-action" key={link.id} onClick={()=>void window.electronAPI.openExternal(link.url)}>{link.id==='support'?<Heart size={16} strokeWidth={1.7}/>:link.id==='discord'?<svg className="community-brand-icon" aria-hidden="true" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Discord</title><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>:<svg className="community-brand-icon" aria-hidden="true" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Twitch</title><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/></svg>}<span>{link.label}</span></button>)}</div>
   <button className="account-block" onClick={()=>onNavigate('accounts')} aria-label="Открыть аккаунт"><PlayerAvatar account={activeAccount}/><span className="account-summary"><strong>{activeAccount?.username||'Нет аккаунта'}</strong><small>{status}</small></span><ChevronRight size={14}/></button>
   <span className="launcher-version">SEFI Launcher v{launcherVersion}</span>
  </aside>;
};
