import React from 'react';
import { ChevronRight, Newspaper, Sparkles } from 'lucide-react';
import { useStore } from '../../store/store';

interface NewsBannerProps {
  onOpenNews: () => void;
}

export const NewsBanner: React.FC<NewsBannerProps> = ({ onOpenNews }) => {
  const { news } = useStore();

  const activeNews = (news || []).filter(
    n => (n.status === 'published' || (!n.status && !n.archived)) && !n.archived && n.status !== 'scheduled'
  );

  const latest = activeNews[0];

  if (!latest) {
    return (
      <div
        onClick={onOpenNews}
        className="group flex h-[48px] w-full items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/30 px-3.5 py-1.5 transition duration-200 hover:border-white/[0.15] hover:bg-white/[0.04] cursor-pointer shadow-lg backdrop-blur-md"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-white/40 group-hover:text-fuchsia-300 transition">
            <Newspaper size={14} />
          </div>
          <span className="truncate text-xs font-medium text-white/45 group-hover:text-white/70 transition">
            Пока нет опубликованных новостей
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 text-[11px] font-medium text-white/40 group-hover:text-white/70">
          <span>Новости</span>
          <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    );
  }

  const tagLabel = latest.tag === 'event' ? 'ИВЕНТ' : latest.tag === 'update' ? 'ОБНОВЛЕНИЕ' : 'НОВОСТЬ';
  const tagColor = latest.tag === 'event' ? 'text-amber-300 border-amber-400/30 bg-amber-500/10' :
                   latest.tag === 'update' ? 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10' :
                   'text-fuchsia-300 border-fuchsia-400/30 bg-fuchsia-500/10';

  return (
    <div
      onClick={onOpenNews}
      className="group flex h-[48px] w-full items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-black/40 px-3 py-1.5 transition duration-200 hover:border-fuchsia-400/35 hover:bg-white/[0.04] cursor-pointer shadow-lg backdrop-blur-md"
    >
      {/* Left: Thumbnail & Headline */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="relative size-7 shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-black/50">
          {(latest.image_launcher || latest.image) ? (
            <img
              src={latest.image_launcher || latest.image}
              alt=""
              className="size-full object-cover transition-transform duration-300 group-hover:scale-110"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-fuchsia-300 bg-fuchsia-500/10">
              <Newspaper size={14} />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider border ${tagColor}`}>
            {tagLabel}
          </span>

          <span className="truncate text-xs font-semibold text-white/90 group-hover:text-fuchsia-200 transition">
            {latest.title}
          </span>
        </div>
      </div>

      {/* Right: Action hint */}
      <div className="flex items-center gap-1 shrink-0 pl-2 text-[11px] font-medium text-fuchsia-300/80 group-hover:text-fuchsia-200">
        <Sparkles size={11} className="text-fuchsia-400" />
        <span>Новости</span>
        <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
      </div>
    </div>
  );
};
