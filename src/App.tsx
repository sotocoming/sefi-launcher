import {LaunchReportDialog} from './components/reports/LaunchReportDialog';
import {ReleaseNotes} from './components/updates/ReleaseNotes';
import { useEffect, useState } from 'react';
import type { LaunchRecoveryTarget } from './utils/errors';
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

  const [reportRequest,setReportRequest]=useState<{sequence:number;message:string}|null>(null);
  useEffect(()=>{const open=(event:Event)=>{const value=(event as CustomEvent).detail?.message;setReportRequest(previous=>({sequence:(previous?.sequence||0)+1,message:typeof value==='string'?value.slice(0,16000):''}));};window.addEventListener('sefi-open-launch-report',open);return()=>window.removeEventListener('sefi-open-launch-report',open);},[]);
  const [notesRequest,setNotesRequest]=useState(0);
  const [settingsTarget,setSettingsTarget]=useState<LaunchRecoveryTarget>('game');
  const [updatesRequest,setUpdatesRequest]=useState(0);

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

    Promise.resolve(window.electronAPI?.getUpdateStatus?.()).then(info=>{
      if(info?.status && (info.status !== 'idle' || info.checkedAt) && !useStore.getState().updateInfo) setUpdateInfo(info);
    }).catch(()=>{});

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
      <div className="original-app">
        <a href="#main-content" className="skip-link">К содержимому</a>
        {/* Navigation Sidebar */}
        <Sidebar currentPage={currentPage} onNavigate={page=>{setSettingsTarget('game');setUpdatesRequest(0);setCurrentPage(page);}} />

        {/* Content View with Frameless TitleBar */}
        <main id="main-content" tabIndex={-1} className="original-main app-main">
          <TitleBar onOpenUpdates={()=>{setUpdatesRequest(n=>n+1);setCurrentPage('settings');}} />

          <div className="app-page">
            <AnimatePresence mode="wait">
              {currentPage === 'home' && <HomePage key="home" onNavigate={setCurrentPage} onOpenSettings={tab=>{setSettingsTarget(tab);setUpdatesRequest(0);setCurrentPage('settings');}} />}
              {currentPage === 'map' && <MapPage key="map" />}
              {currentPage === 'news' && <NewsPage key="news" onNavigate={setCurrentPage} />}
              {currentPage === 'accounts' && <AccountsPage key="accounts" />}
              {currentPage === 'settings' && <SettingsPage key="settings" updatesRequest={updatesRequest} initialTab={settingsTarget} onOpenReleaseNotes={()=>setNotesRequest(n=>n+1)} />}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
      <ReleaseNotes request={notesRequest}/>
      <LaunchReportDialog request={reportRequest} onOpenAccounts={()=>setCurrentPage('accounts')}/>
    </MotionConfig>
  );
}
