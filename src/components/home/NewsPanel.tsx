import React, { useState } from 'react';
import { ChevronRight, ChevronDown, ExternalLink } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { useStore } from '../../store/store';
import autumnImg from '../../assets/news/homestead-news-autumn-festival.png';
import greenhouseImg from '../../assets/news/homestead-news-greenhouse.png';
import winterImg from '../../assets/news/homestead-news-winter.png';

export const NewsPanel: React.FC = () => {
  const { news } = useStore();
  const [isExpanded, setIsExpanded] = useState(false);

  const defaultNews = [
    {
      id: 'autumn',
      title: 'Осенний фестиваль',
      body: 'Новые задания, уютный фермерский декор и сезонные награды.',
      date: 'Сегодня',
      image: autumnImg,
    },
    {
      id: 'greenhouse',
      title: 'Homestead Cozy 1.3.7',
      body: 'Исправления модов, оптимизация загрузки памяти и фиксы.',
      date: '05 окт.',
      image: greenhouseImg,
    },
    {
      id: 'winter',
      title: 'Зимнее событие',
      body: 'Праздничный сезон и обновлённые биомы уже скоро.',
      date: 'Анонс',
      image: winterImg,
    },
  ];

  const activeNewsItems = news && news.length > 0
    ? news
        .filter(n => (n.status === 'published' || (!n.status && !n.archived)) && !n.archived && n.status !== 'scheduled')
        .map((n, i) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          date: [n.date, n.time].filter(Boolean).join(' ') || n.date || '',
          tag: n.tag || 'news',
          likes: n.likes || 0,
          image: n.image_launcher || n.image || defaultNews[i % defaultNews.length].image,
        }))
    : defaultNews.map(n => ({ ...n, tag: 'news' as const, likes: 0 }));

  const latestItem = activeNewsItems[0] || defaultNews[0];
  const otherItems = activeNewsItems.slice(1);

  const handleOpenNews = (e: React.MouseEvent, id?: string) => {
    e.stopPropagation();
    const url = id ? `https://mc.sotocoming.ru/news#${encodeURIComponent(id)}` : 'https://mc.sotocoming.ru/news';
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <GlassCard className="overflow-hidden flex flex-col w-full transition-all duration-300">
      {/* Header bar: Compact and informative */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3.5 py-2.5 shrink-0 bg-black/20">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-fuchsia-400 shadow-[0_0_8px_#d18aff]" />
          <span className="text-xs font-semibold text-white/90">Новости сервера</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenNews}
            title="Открыть mc.sotocoming.ru/news в браузере"
            className="flex items-center gap-1 text-[10px] text-white/40 hover:text-fuchsia-300 transition py-0.5 px-1.5 rounded hover:bg-white/[0.05]"
          >
            <span>на сайт</span>
            <ExternalLink size={10} />
          </button>

          {otherItems.length > 0 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-[10px] text-fuchsia-300/90 hover:text-fuchsia-200 transition py-0.5 px-2 rounded bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-fuchsia-400/20"
            >
              <span>{isExpanded ? 'Свернуть' : `Ещё (${otherItems.length})`}</span>
              {isExpanded ? <ChevronDown size={11} className="rotate-180 transition-transform" /> : <ChevronDown size={11} />}
            </button>
          )}
        </div>
      </div>

      {/* Main Feature: Latest News item always shown compactly */}
      <div
        onClick={(e) => handleOpenNews(e, latestItem.id)}
        className="group flex gap-3 p-3 transition hover:bg-white/[0.04] cursor-pointer"
      >
        <div className="size-11 shrink-0 rounded-lg overflow-hidden border border-white/[0.06] bg-black/40">
          <img
            src={latestItem.image}
            alt={latestItem.title}
            className="size-full object-cover transition duration-300 group-hover:scale-105"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-medium text-fuchsia-300/80">
              {latestItem.date}
            </span>
            <span className="text-[9px] text-white/30 uppercase tracking-wider">Свежее</span>
          </div>
          <div className="mt-0.5 text-xs font-semibold text-white/95 truncate group-hover:text-fuchsia-200 transition">
            {latestItem.title}
          </div>
          <div className="mt-0.5 text-[11px] leading-4 text-white/40 line-clamp-1">
            {latestItem.body}
          </div>
        </div>
      </div>

      {/* Expandable previous news accordion (when toggled open) */}
      {isExpanded && otherItems.length > 0 && (
        <div className="divide-y divide-white/[0.04] border-t border-white/[0.06] bg-black/30 max-h-[160px] overflow-y-auto animate-fadeIn">
          {otherItems.map((item) => (
            <div
              key={item.id}
              onClick={(e) => handleOpenNews(e, item.id)}
              className="group flex gap-2.5 p-2.5 transition hover:bg-white/[0.04] cursor-pointer"
            >
              <div className="size-8 shrink-0 rounded overflow-hidden border border-white/[0.06] bg-black/40 mt-0.5">
                <img
                  src={item.image}
                  alt={item.title}
                  className="size-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-medium text-fuchsia-300/70">
                  {item.date}
                </div>
                <div className="text-[11px] font-medium text-white/85 truncate group-hover:text-fuchsia-200">
                  {item.title}
                </div>
              </div>

              <ChevronRight size={13} className="self-center text-white/20 group-hover:text-fuchsia-300 transition" />
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
};
