import { PlayerAvatar } from '../accounts/PlayerAvatar';
import React from 'react';
import { Home, Map, Newspaper, Users, Settings, Heart, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '../../store/store';
import sefiLogo from '../../assets/branding/sefi-logo.png';
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
    { id: 'accounts' as const, label: 'Аккаунты', icon: Users },
    { id: 'settings' as const, label: 'Настройки', icon: Settings },
  ];

  const links = (launcherConfig?.community_links || []).filter(link => {
    try { const url = new URL(link.url); return ['support','discord','twitch'].includes(link.id) && url.protocol === 'https:' && !url.username && !url.password; }
    catch { return false; }
  });
  return (
    <aside className="flex w-[224px] shrink-0 flex-col border-r border-white/[0.06] bg-[#0c0c12] z-30 select-none">
      {/* Brand Header with sefi-logo.png */}
      <div className="flex h-[74px] items-center px-4">
        <div className="flex items-center gap-3 w-full">
          <img
            src={sefiLogo}
            alt="SEFI Launcher"
            className="h-10 w-auto max-w-[180px] object-contain filter drop-shadow-[0_0_12px_rgba(180,92,255,0.4)]"
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="mt-3 space-y-1 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentPage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`group relative flex h-11 w-full items-center gap-3 rounded-[10px] px-3 text-sm font-medium transition ${
                active
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/45 hover:bg-white/[0.04] hover:text-white/75'
              }`}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 h-5 w-[3px] rounded-full bg-fuchsia-400 shadow-[0_0_14px_#d66cff]"
                />
              )}

              <Icon
                size={18}
                className={active ? 'text-fuchsia-300' : 'text-white/50 group-hover:text-white/80'}
              />
              <span className="flex-1 text-left">{item.label}</span>
              {item.count !== undefined && item.count > 0 && (
                <span title={`Новостей: ${item.count}`}
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-fuchsia-500/20 text-[10px] leading-none tabular-nums font-semibold text-fuchsia-300 border border-fuchsia-400/20">
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
        {links.length > 0 && <div className="mt-4 border-t border-white/[0.07] pt-3">
          {links.map(link => <button key={link.id} type="button" title={link.label} onClick={() => void window.electronAPI.openExternal(link.url)} className="group flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-sm text-white/55 transition hover:bg-fuchsia-400/10 hover:text-fuchsia-200">
            {link.id === 'support' ? <Heart size={18} className="shrink-0 text-fuchsia-300" /> : link.id === 'twitch' ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="shrink-0" aria-hidden="true"><path d="M11.571 4.714h1.715v5.143h-1.715zm4.715 0H18v5.143h-1.714zM6 0 1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="shrink-0" aria-hidden="true"><path d="M8 5 5 6c-2 3-3 7-3 11l5 2 1-2m8-12 3 1c2 3 3 7 3 11l-5 2-1-2M7 8c3-2 7-2 10 0M7 16c3 2 7 2 10 0"/><circle cx="8.5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="15.5" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>}
            <span className="min-w-0 flex-1 text-left text-xs leading-tight line-clamp-2">{link.label}</span><ExternalLink size={12} className="shrink-0 text-white/30" />
          </button>)}
        </div>}
      </nav>

      {/* Active Account Widget */}
      <div className="mt-auto p-3">
        <div 
          onClick={() => onNavigate('accounts')}
          className="group cursor-pointer rounded-[14px] border border-white/[0.07] bg-white/[0.035] p-3 transition hover:border-fuchsia-400/30 hover:bg-white/[0.06]"
        >
          <div className="flex items-center gap-3">
            <PlayerAvatar account={activeAccount} />

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">
                {activeAccount?.username || 'Нет аккаунта'}
              </div>

              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium leading-none">
                <span className={`inline-block size-1.5 rounded-full ${
                  activeAccount?.communityToken
                    ? activeAccount.whitelistStatus === 'approved'
                      ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                      : activeAccount.whitelistStatus === 'rejected'
                      ? 'bg-rose-400 shadow-[0_0_6px_#f43f5e]'
                      : 'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
                    : activeAccount
                    ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                    : 'bg-zinc-500'
                }`} />
                <span className={
                  activeAccount?.communityToken
                    ? activeAccount.whitelistStatus === 'approved'
                      ? 'text-emerald-400/90'
                      : activeAccount.whitelistStatus === 'rejected'
                      ? 'text-rose-400/90'
                      : 'text-amber-400/90'
                    : activeAccount
                    ? 'text-white/60'
                    : 'text-white/40'
                }>
                  {activeAccount?.communityToken
                    ? activeAccount.whitelistStatus === 'approved'
                      ? 'Доступ открыт'
                      : activeAccount.whitelistStatus === 'rejected'
                      ? 'Доступ отклонён'
                      : 'Ожидает одобрения'
                    : activeAccount
                    ? 'Готово к игре'
                    : 'Требуется вход'}
                </span>
              </div>

            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between">
            <span className="inline-flex rounded-md bg-violet-400/10 px-2 py-0.5 text-[10px] font-medium text-violet-300">
              {activeAccount?.communityToken
                ? 'Twitch'
                : activeAccount?.type === 'microsoft'
                ? 'Лицензия'
                : 'Офлайн'}
            </span>
            <span className="text-[10px] text-white/30 group-hover:text-white/60 transition">
              Сменить →
            </span>
          </div>
        </div>
        <p className="mt-3 px-1 text-[11px] leading-none text-white/40 select-text" title="Версия лаунчера">
          SEFI Launcher v{launcherVersion}
        </p>
      </div>
    </aside>
  );
};
