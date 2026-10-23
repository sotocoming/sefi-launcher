import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, ThumbsUp, ChevronDown } from 'lucide-react';

import { NewsMarkdown } from '../components/ui/NewsMarkdown';
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

  const [userVotes, setUserVotes] = useState<Record<string, 'like' | null>>({});
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reactionError, setReactionError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setAuthorized(false); setUserVotes({}); setReactionError('');
    if (activeAccount?.communityConnected && window.electronAPI?.getNewsReactions) {
      window.electronAPI.getNewsReactions().then(data => {
        if (!cancelled) { setUserVotes(data.votes || {}); setAuthorized(true); }
      }).catch(() => { if (!cancelled) setReactionError('Обновите вход в SEFI Community, чтобы оценивать новости.'); });
    }
    return () => { cancelled = true; };
  }, [activeAccount?.id, activeAccount?.communityConnected]);

  const allNewsItems = (news || [])
    .filter(n => (n.status === 'published' || (!n.status && !n.archived)) && !n.archived && n.status !== 'scheduled')
    .map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body_markdown ?? n.body,
      date: n.date,
      time: n.time,
      tag: (n.tag || 'news') as 'event' | 'update' | 'news',
      likes: n.likes ?? 0,
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

  const handleReact = async (id: string, type: 'like') => {
    if (!authorized || busy) return;
    const accountId = activeAccount?.id;
    setBusy(true); setReactionError('');
    const prevVote = userVotes[id] || null;

    try {
      let data: { ok: boolean; likes: number; user_vote: 'like' | null };

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
          item.id === id ? { ...item, likes: data.likes } : item
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

  const [selectedId,setSelectedId]=useState<string|null>(null);
  const selected=filteredItems.find(n=>n.id===selectedId)||filteredItems[0];
  const expanded=!!selected&&!!expandedIds[selected.id];
  const long=!!selected&&((selected.body||'').length>200||(selected.body||'').split('\n').length>4);
  return <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="workspace-page news-page">
   <header className="page-head"><div><h1>Жизнь Sweet Home</h1><p>Обновления, события и истории нашего мира</p></div><button className="s-button" onClick={()=>handleOpenExternal()}>Читать на сайте <ExternalLink size={13}/></button></header>
   <div className="page-tabs">{(['all','event','update','news'] as const).map(f=><button key={f} aria-pressed={activeFilter===f} onClick={()=>setActiveFilter(f)}>{{all:'Все',event:'Ивенты',update:'Обновления',news:'Новости'}[f]}</button>)}</div>
   {reactionError&&<p role="status" className="feedback">{reactionError}</p>}
   {!selected?<div className="empty-panel">В этой категории пока нет новостей.</div>:<div className="news-workspace"><article className="news-feature">
    {selected.image&&<img className="feature-cover" src={selected.image} alt=""/>}
    <div className="feature-meta"><span>{tagLabels[selected.tag]?.label||'Новость'}</span><time>{selected.date} {selected.time}</time></div>
    <div className={selected.image?'feature-copy':'feature-copy no-cover'}><h2>{selected.title}</h2><NewsMarkdown source={selected.body} collapsed={!expanded&&long}/>
    {long&&<button className="text-action" aria-expanded={expanded} onClick={()=>toggleExpand(selected.id)}>{expanded?'Свернуть':'Читать полностью'} <ChevronDown size={13}/></button>}
    <footer className="article-footer"><button className="s-button" disabled={!authorized||busy} aria-pressed={userVotes[selected.id]==='like'} aria-label={userVotes[selected.id]==='like'?'Снять лайк':'Поставить лайк'} onClick={()=>handleReact(selected.id,'like')}><ThumbsUp size={13}/>{selected.likes}</button>{!authorized?<button className="text-action" onClick={()=>onNavigate('accounts')}>Войти, чтобы оценить</button>:<button className="text-action" onClick={()=>handleOpenExternal(selected.id)}>На сайте <ExternalLink size={12}/></button>}</footer></div>
   </article><aside className="news-list" aria-label="Все новости">{filteredItems.map(n=><button className="news-row" key={n.id} aria-pressed={selected.id===n.id} onClick={()=>setSelectedId(n.id)}><strong>{n.title}</strong><span>{n.date} · {tagLabels[n.tag]?.label||'Новость'}</span></button>)}</aside></div>}
  </motion.div>;
};
