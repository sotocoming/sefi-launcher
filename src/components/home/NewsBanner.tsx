import React from 'react';
import { ChevronRight, Newspaper } from 'lucide-react';
import { useStore } from '../../store/store';
export const NewsBanner: React.FC<{ onOpenNews: () => void }> = ({ onOpenNews }) => {
  const news = useStore(state => state.news);
  const latest = (news || []).find(n => (n.status === 'published' || (!n.status && !n.archived)) && !n.archived && n.status !== 'scheduled');
  return <button type="button" onClick={onOpenNews} className="news-strip">
    <span className="flex min-w-0 items-center gap-3"><Newspaper size={18} aria-hidden="true" className="shrink-0 text-sefi-purple" /><span className="truncate text-sm">{latest?.title || 'Пока нет опубликованных новостей'}</span></span>
    <span className="flex shrink-0 items-center gap-2 text-xs">Новости<ChevronRight size={16} aria-hidden="true" /></span>
  </button>;
};
