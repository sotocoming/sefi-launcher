import React from 'react';
import { Minus, Square, X, DownloadCloud, RefreshCw, Sparkles } from 'lucide-react';
import { useStore } from '../../store/store';

interface WindowButtonProps {
  icon: typeof Minus;
  onClick: () => void;
  danger?: boolean;
}

const WindowButton: React.FC<WindowButtonProps> = ({ icon: Icon, onClick, danger }) => {
  return (
    <button
      onClick={onClick}
      className={`titlebar-no-drag flex size-8 items-center justify-center rounded-lg text-white/40 transition ${
        danger
          ? 'hover:bg-red-500/80 hover:text-white'
          : 'hover:bg-white/[0.08] hover:text-white'
      }`}
    >
      <Icon size={14} />
    </button>
  );
};

export const TitleBar: React.FC = () => {
  const { updateInfo, installLauncherUpdate } = useStore();

  const handleMinimize = () => {
    if (window.electronAPI?.minimize) {
      window.electronAPI.minimize();
    }
  };

  const handleMaximize = () => {
    if (window.electronAPI?.maximize) {
      window.electronAPI.maximize();
    }
  };

  const handleClose = () => {
    if (window.electronAPI?.close) {
      window.electronAPI.close();
    }
  };

  return (
    <header className="titlebar-drag relative z-50 flex h-11 w-full shrink-0 items-center justify-between border-b border-white/[0.04] bg-[#09090d]/80 backdrop-blur-md px-3 select-none">
      <div className="flex-1 pointer-events-none" />

      {/* Right controls area: Update status + window action buttons */}
      <div className="flex items-center gap-3 titlebar-no-drag">
        {/* Update Notification Indicator */}
        {updateInfo?.status === 'downloading' && (
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400">
            <DownloadCloud size={13} className="animate-bounce text-emerald-400" />
            <span>Загрузка {updateInfo.version ? `v${updateInfo.version}` : ''} ({updateInfo.percent || 0}%)</span>
          </div>
        )}

        {updateInfo?.status === 'ready' && (
          <button
            onClick={installLauncherUpdate}
            className="flex items-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-500/20 px-3.5 py-1 text-xs font-semibold text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.25)] transition hover:bg-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Sparkles size={13} className="text-emerald-300 animate-pulse" />
            <span>Обновление готово! <b>Перезапустить</b></span>
          </button>
        )}

        {/* Window Controls */}
        <div className="flex items-center gap-1">
          <WindowButton icon={Minus} onClick={handleMinimize} />
          <WindowButton icon={Square} onClick={handleMaximize} />
          <WindowButton icon={X} onClick={handleClose} danger />
        </div>
      </div>
    </header>
  );
};
