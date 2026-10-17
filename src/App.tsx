import { useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { useStore } from './store/store';
import { Sidebar } from './components/layout/Sidebar';
import { TitleBar } from './components/layout/TitleBar';
import { HomePage } from './pages/HomePage';
import { MapPage } from './pages/MapPage';
import { NewsPage } from './pages/NewsPage';
import { AccountsPage } from './pages/AccountsPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  const { initStore, refreshServerStatus, setGameState, setDownloadProgress, setUpdateInfo } = useStore();
  const [currentPage, setCurrentPage] = useState<'home' | 'map' | 'news' | 'accounts' | 'settings'>('home');

  useEffect(() => {
    initStore();

    // Poll Minecraft community server status every 30 seconds
    const interval = setInterval(() => {
      refreshServerStatus();
    }, 30000);

    let unsubGameState = () => {};
    let unsubDownload = () => {};
    let unsubUpdate = () => {};

    if (window.electronAPI?.onGameStateChange) {
      unsubGameState = window.electronAPI.onGameStateChange((state) => {
        setGameState(state);
      });
      unsubDownload = window.electronAPI.onDownloadProgress((progress) => {
        setDownloadProgress(progress);
      });
    }

    if (window.electronAPI?.onUpdateStatusChange) {
      unsubUpdate = window.electronAPI.onUpdateStatusChange((info) => {
        setUpdateInfo(info);
      });
    }

    return () => {
      clearInterval(interval);
      unsubGameState();
      unsubDownload();
      unsubUpdate();
    };
  }, [initStore, refreshServerStatus, setGameState, setDownloadProgress, setUpdateInfo]);

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.18 }}>
    <div className="launcher-shell h-screen w-screen bg-sefi-bg flex items-center justify-center p-0 overflow-hidden text-sefi-textPrimary font-sans">
      <div className="relative flex h-full w-full overflow-hidden border border-white/[0.07] bg-sefi-bg shadow-[0_40px_120px_rgba(0,0,0,0.65)]">
        <a href="#main-content" className="skip-link">К содержимому</a>
        {/* Navigation Sidebar */}
        <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />

        {/* Content View with Frameless TitleBar */}
        <main id="main-content" tabIndex={-1} className="relative min-w-0 flex-1 overflow-hidden flex flex-col bg-sefi-bg">
          <TitleBar />

          <div className="relative flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              {currentPage === 'home' && <HomePage key="home" onNavigate={setCurrentPage} />}
              {currentPage === 'map' && <MapPage key="map" />}
              {currentPage === 'news' && <NewsPage key="news" onNavigate={setCurrentPage} />}
              {currentPage === 'accounts' && <AccountsPage key="accounts" />}
              {currentPage === 'settings' && <SettingsPage key="settings" />}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
    </MotionConfig>
  );
}
