import React from 'react';
import { Minus, Square, X } from 'lucide-react';
import { LauncherUpdateIndicator } from '../updates/LauncherUpdate';

interface WindowButtonProps {
  icon: typeof Minus;
  onClick: () => void;
  danger?: boolean;
  label: string;
}

const WindowButton: React.FC<WindowButtonProps> = ({ icon: Icon, onClick, danger, label }) => {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`window-action titlebar-no-drag ${danger ? 'is-close' : ''}`}
    >
      <Icon size={12} strokeWidth={1.5} />
    </button>
  );
};

export const TitleBar: React.FC<{onOpenUpdates:()=>void}> = ({onOpenUpdates}) => {

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
    <header className="window-chrome titlebar-drag relative z-50 flex h-11 w-full shrink-0 items-center justify-between border-b border-white/[0.04] bg-[#09090d]/80 backdrop-blur-md px-3 select-none">
      <span className="flex-1 pointer-events-none pl-3 text-xs text-sefi-textSecondary">SEFI Launcher</span>

      {/* Right controls area: Update status + window action buttons */}
      <div className="flex items-center gap-3 titlebar-no-drag">
        <LauncherUpdateIndicator onOpen={onOpenUpdates}/>

        {/* Window Controls */}
        <div className="window-actions">
          <WindowButton label="Свернуть окно" icon={Minus} onClick={handleMinimize} />
          <WindowButton label="Развернуть или восстановить" icon={Square} onClick={handleMaximize} />
          <WindowButton label="Закрыть окно" icon={X} onClick={handleClose} danger />
        </div>
      </div>
    </header>
  );
};
