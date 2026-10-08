import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Newspaper, ExternalLink, ThumbsUp, ThumbsDown, Calendar, ChevronDown } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { useStore } from '../store/store';

interface NewsPageProps {
  onNavigate: (page: 'home' | 'map' | 'news' | 'accounts' | 'settings') => void;
}

export const NewsPage: React.FC<NewsPageProps> = ({ onNavigate }) => {
  const { news, setNews, activeAccount } = useStore();
  const [activeFilter, setActiveFilter] = useState<'all' | 'event' | 'update' | 'news'>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const [userVotes, setUserVotes] = useState<Record<string, 'like' | 'dislike' | null>>({});
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reactionError, setReactionError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setAuthorized(false); setUserVotes({}); setReactionError('');
    if (activeAccount?.communityToken && window.electronAPI?.getNewsReactions) {
      window.electronAPI.getNewsReactions().then(data => {
        if (!cancelled) { setUserVotes(data.votes || {}); setAuthorized(true); }
      }).catch(() => { if (!cancelled) setReactionError('Обновите вход в SEFI Community, чтобы оценивать новости.'); });
    }
    return () => { cancelled = true; };
  }, [activeAccount?.id, activeAccount?.communityToken]);

  const allNewsItems = (news || [])
    .filter(n => (n.status === 'published' || (!n.status && !n.archived)) && !n.archived && n.status !== 'scheduled')
    .map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      date: n.date,
      time: n.time,
      tag: (n.tag || 'news') as 'event' | 'update' | 'news',
      likes: n.likes ?? 0,
      dislikes: n.dislikes ?? 0,
      image: n.image_launcher || n.image || '',
    }));

  const filteredItems = activeFilter === 'all'
    ? allNewsItems
    : allNewsItems.filter(item => item.tag === activeFilter);

  const handleOpenExternal = (id?: string) => {
    const url = id ? `https://mc.sotocoming.ru/news#${encodeURIComponent(id)}` : 'https://mc.sotocoming.ru/news';
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const handleReact = async (id: string, type: 'like' | 'dislike') => {
    if (!authorized || busy) return;
    const accountId = activeAccount?.id;
    setBusy(true); setReactionError('');
    const prevVote = userVotes[id] || null;

    try {
      let data: { ok: boolean; likes: number; dislikes: number; user_vote: 'like' | 'dislike' | null };

      if (window.electronAPI?.reactNews) {
        data = await window.electronAPI.reactNews(id, type, prevVote);
      } else { throw new Error('Для реакции войдите через SEFI Launcher или сайт.'); }

      if (data && data.ok && useStore.getState().activeAccount?.id === accountId) {
        const nextVote = data.user_vote;
        const updatedVotes = { ...userVotes, [id]: nextVote };
        setUserVotes(updatedVotes);
        // Синхронизируем счетчик в общем сторе
        const currentList = news || [];
        const updatedNews = currentList.map(item =>
          item.id === id ? { ...item, likes: data.likes, dislikes: data.dislikes } : item
        );
        setNews(updatedNews);
      }
    } catch (err) {
      setReactionError(err instanceof Error ? err.message : 'Не удалось сохранить реакцию.');
    } finally {
      setBusy(false);
    }
  };

  const tagLabels: Record<string, { label: string; color: string; border: string }> = {
    event: { label: 'Ивент', color: 'text-amber-300', border: 'border-amber-400/25 bg-amber-500/10' },
    update: { label: 'Обновление', color: 'text-emerald-300', border: 'border-emerald-400/25 bg-emerald-500/10' },
    news: { label: 'Новость', color: 'text-fuchsia-300', border: 'border-fuchsia-400/25 bg-fuchsia-500/10' },
  };

  return (
    <motion.div
      key="news"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="relative flex h-full flex-col overflow-hidden bg-[#09090d] select-none pt-6 px-8 pb-6"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-300">
            <Newspaper size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Новости и события сервера
            </h1>
            <p className="text-xs text-white/45">
              Анонсы обновлений, праздников и жизни Homestead
            </p>
          </div>
        </div>

        <button
          onClick={() => handleOpenExternal()}
          className="flex items-center gap-1.5 rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/15 px-3 py-1.5 text-xs font-medium text-fuchsia-200 transition hover:bg-fuchsia-500/25 hover:text-white"
        >
          <span>Читать на сайте</span>
          <ExternalLink size={13} />
        </button>
      </div>

      {/* Filter Buttons Bar */}
      <div className="flex items-center gap-2 pb-4">
        {(['all', 'event', 'update', 'news'] as const).map((filter) => {
          const names = { all: 'Все', event: 'Ивенты', update: 'Обновления', news: 'Новости' };
          const active = activeFilter === filter;
          return (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                active
                  ? 'bg-white/[0.12] text-white border border-white/20'
                  : 'text-white/45 hover:bg-white/[0.04] hover:text-white/80 border border-transparent'
              }`}
            >
              {names[filter]}
            </button>
          );
        })}
      </div>

      {!authorized && <button type="button" onClick={() => onNavigate('accounts')} className="mb-4 self-start text-sm text-fuchsia-300 underline underline-offset-4 hover:text-fuchsia-200 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-fuchsia-300">Войдите в SEFI Community, чтобы оценивать новости</button>}
      {reactionError && <p role="status" className="mb-4 text-sm text-amber-300">{reactionError}</p>}
      {/* News List */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {filteredItems.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-xs text-white/40">
            В этой категории пока нет новостей.
          </div>
        ) : (
          filteredItems.map((item) => {
            const tagInfo = tagLabels[item.tag] || tagLabels.news;
            const currentVote = userVotes[item.id];

            const isExpanded = !!expandedIds[item.id];
            const isLong = (item.body || '').length > 200 || (item.body || '').split('\n').length > 4;

            return (
              <GlassCard
                key={item.id}
                className="overflow-hidden p-0 border border-white/[0.08] hover:border-white/[0.15] transition"
              >
                <div className="flex flex-col md:flex-row">
                  {item.image && (
                    <div className="h-48 md:w-64 md:aspect-[3/4] md:max-h-[380px] md:self-start shrink-0 overflow-hidden bg-black/40">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="size-full object-cover transition duration-300 hover:scale-105"
                      />
                    </div>
                  )}

                  <div className="flex flex-1 flex-col justify-between p-5">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tagInfo.border} ${tagInfo.color}`}>
                          {tagInfo.label}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] text-white/40">
                          <Calendar size={11} />
                          <span>{item.date} {item.time && `· ${item.time}`}</span>
                        </div>
                      </div>

                      <h2
                        onClick={() => handleOpenExternal(item.id)}
                        className="text-base font-bold text-white hover:text-fuchsia-300 transition cursor-pointer mb-2"
                      >
                        {item.title}
                      </h2>

                      <p className={`text-xs leading-relaxed text-white/60 whitespace-pre-line ${isExpanded ? '' : 'line-clamp-4'}`}>
                        {item.body}
                      </p>

                      {isLong && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(item.id)}
                          className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-fuchsia-300/90 hover:text-fuchsia-200 transition cursor-pointer"
                        >
                          <span>{isExpanded ? 'Свернуть' : 'Читать полностью'}</span>
                          <ChevronDown size={13} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
                      <div className="flex items-center gap-2">
                        <button
                          disabled={!authorized || busy}
                          onClick={() => handleReact(item.id, 'like')}
                          title={currentVote === 'like' ? 'Снять лайк' : 'Поставить лайк'}
                          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                            currentVote === 'like'
                              ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40 shadow-[0_0_12px_rgba(52,211,153,0.25)]'
                              : 'bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white border border-white/[0.06]'
                          }`}
                        >
                          <ThumbsUp size={12} className={currentVote === 'like' ? 'fill-current' : ''} />
                          <span>{item.likes}</span>
                        </button>

                        <button
                          disabled={!authorized || busy}
                          onClick={() => handleReact(item.id, 'dislike')}
                          title={currentVote === 'dislike' ? 'Снять дизлайк' : 'Поставить дизлайк'}
                          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                            currentVote === 'dislike'
                              ? 'bg-rose-500/25 text-rose-300 border border-rose-400/40 shadow-[0_0_12px_rgba(244,63,94,0.25)]'
                              : 'bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white border border-white/[0.06]'
                          }`}
                        >
                          <ThumbsDown size={12} className={currentVote === 'dislike' ? 'fill-current' : ''} />
                          <span>{item.dislikes}</span>
                        </button>
                      </div>

                      <button
                        onClick={() => handleOpenExternal(item.id)}
                        className="flex items-center gap-1 text-xs font-medium text-fuchsia-300/80 hover:text-fuchsia-200 transition"
                      >
                        <span>Подробнее</span>
                        <ExternalLink size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              </GlassCard>
            );
          })
        )}
      </div>
    </motion.div>
  );
};
