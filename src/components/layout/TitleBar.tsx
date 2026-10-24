import React from 'react';
import { Minus, Square, X } from 'lucide-react';
import { LauncherUpdateIndicator } from '../updates/LauncherUpdate';

interface WindowButtonProps {
  icon: 'minimize' | 'maximize' | 'close';
  onClick: () => void;
  danger?: boolean;
  label: string;
}

const WindowButton: React.FC<WindowButtonProps> = ({ icon, onClick, danger, label }) => {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`window-action titlebar-no-drag ${danger ? 'is-close' : ''}`}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="square" aria-hidden="true" focusable="false">
        {icon === 'minimize' && <path d="M2.5 6h7" />}
        {icon === 'maximize' && <rect x="2.5" y="2.5" width="7" height="7" />}
        {icon === 'close' && <path d="m2.5 2.5 7 7m0-7-7 7" />}
      </svg>
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
          <WindowButton label="Свернуть окно" icon="minimize" onClick={handleMinimize} />
          <WindowButton label="Развернуть или восстановить" icon="maximize" onClick={handleMaximize} />
          <WindowButton label="Закрыть окно" icon="close" onClick={handleClose} danger />
        </div>
      </div>
    </header>
  );
};
