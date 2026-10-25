import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { serverAccessWarning } from '../../utils/server-access';
import { launchFailure, type LaunchRecoveryTarget } from '../../utils/errors';
import { LaunchFailurePanel } from './LaunchFailurePanel';
import { ArrowRight, Play, Download, Loader2, AlertCircle } from 'lucide-react';
import { useStore } from '../../store/store';

export const PlayButton: React.FC<{ onOpenAccounts: () => void; onOpenSettings:(tab:LaunchRecoveryTarget)=>void }> = ({ onOpenAccounts,onOpenSettings }) => {
  const { gameState, launch, activeAccount, settings, launcherConfig } = useStore();
  const host = launcherConfig?.server?.ip || 'minecraft.sotocoming.ru';
  const port = launcherConfig?.server?.port || 25565;
  const endpoints = launcherConfig?.server?.endpoints?.length ? launcherConfig.server.endpoints : [
    { id: 'primary', label: 'Основной', address: port === 25565 ? host : `${host}:${port}` },
  ];
  const selectedId = settings?.selectedServerId || endpoints[0].id;
  const selectedServer = endpoints.find(endpoint => endpoint.id === selectedId);
  const autoConnect = settings?.autoConnect === true;
  const [reloading,setReloading]=useState(false);
  const [warningAccountId, setWarningAccountId] = useState<string | null>(null);
  const warningDialog = useRef<HTMLDialogElement>(null);
  const accessWarning = serverAccessWarning(activeAccount);
  useEffect(() => {
    if (warningAccountId && accessWarning) warningDialog.current?.showModal();
    else warningDialog.current?.close();
  }, [warningAccountId, accessWarning]);
  const reloadSettings=async()=>{setReloading(true);try{await useStore.getState().initStore();if(useStore.getState().settings)useStore.getState().setGameState({status:'idle'});}finally{setReloading(false);}};
  const handlePlay = () => {
    if(!activeAccount || activeAccount.mcType==='microsoft' && activeAccount.type!=='microsoft'){onOpenAccounts();return;}
    if(!settings){void reloadSettings();return;}
    if(autoConnect&&!selectedServer){document.querySelector<HTMLButtonElement>('.route-tabs button:not(:disabled)')?.focus();return;}
    if (accessWarning && activeAccount) setWarningAccountId(activeAccount.id);
    else void launch();
  };
  const continueLaunch = () => {
    if (activeAccount?.id !== warningAccountId) {
      setWarningAccountId(null);
      return;
    }
    setWarningAccountId(null);
    void launch();
  };
  const isDownloading = gameState.status === 'downloading';
  const isExtracting = gameState.status === 'extracting';
  const isLaunching = gameState.status === 'launching';
  const isChecking = gameState.status === 'checking';
  const isRunning = gameState.status === 'running';
  const isError = gameState.status === 'error';

  const downloadProgress = isDownloading ? gameState.progress : null;
  const percentage = Number.isFinite(downloadProgress?.percentage) ? Math.min(100,Math.max(0,Math.round(downloadProgress!.percentage))) : 0;
  const taskText = downloadProgress?.task || 'Загрузка компонентов...';
  const speedText = Number.isFinite(downloadProgress?.speed) && downloadProgress!.speed!>0 ? (downloadProgress!.speed!/1048576).toLocaleString('ru-RU',{maximumFractionDigits:1})+' МБ/с' : 'Загружаем компоненты игры.';

  if (isDownloading || isExtracting || isChecking) {
    const title=isChecking?'Проверяем игру':isExtracting?'Распаковываем файлы':taskText;
    const detail=isChecking?'Проверяем профиль и компоненты сборки.':isExtracting?'Подготавливаем файлы Minecraft.':speedText;
    return <div className="launch-preparation" role="status" aria-live="polite">
      <div className="launch-preparation-line">
        {isDownloading?<Download size={17} strokeWidth={1.6}/>:<Loader2 size={17} strokeWidth={1.6} className="animate-spin"/>}
        <div className="launch-preparation-copy"><strong title={title}>{title}</strong><p>{detail}</p></div>
        {isDownloading&&<span className="launch-preparation-percent">{percentage}%</span>}
      </div>
      {isDownloading&&<div className="launch-preparation-track" role="progressbar" aria-label="Загрузка компонентов Minecraft" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}><span style={{transform:'scaleX('+percentage/100+')'}}/></div>}
    </div>;
  }
  // If community profile is marked as 'microsoft' license, player MUST be playing through an official Microsoft session
  const needsMicrosoftLogin = activeAccount?.mcType === 'microsoft' && activeAccount.type !== 'microsoft';
  const isDisabled = isLaunching || isRunning || reloading;
  const canRetry=!!activeAccount&&!!settings&&!needsMicrosoftLogin&&(!autoConnect||!!selectedServer);
  const failure=launchFailure(gameState.status==='error'?gameState.message:'');
  if(!settings&&isError){failure.kind='configuration';failure.title='Не удалось прочитать настройки';failure.description='Проверьте доступ к папке лаунчера и повторите чтение настроек.';failure.action='reload';failure.actionLabel='Повторить проверку';}
  const recover=()=>{if(failure.action==='accounts')onOpenAccounts();else if(failure.action==='settings')onOpenSettings(failure.tab||'game');else if(failure.action==='reload')void reloadSettings();else if(failure.action==='server')document.querySelector<HTMLButtonElement>('.route-tabs button:not(:disabled)')?.focus();else handlePlay();};

  const getSubtext = () => {
    if (!activeAccount) return 'Выберите или добавьте профиль';
    if(!settings) return 'Нажмите, чтобы повторить чтение настроек';
    if (needsMicrosoftLogin) return `Войдите через Microsoft (${activeAccount.username})`;
    if (isLaunching) return 'Подготовка окружения игры...';
    if (isRunning) return 'Игра уже запущена';
    if (autoConnect && !selectedServer) return 'Выберите доступный адрес сервера';
    if(reloading)return 'Читаем настройки лаунчера…';
    return autoConnect ? `Подключение: ${selectedServer?.label} · ${selectedServer?.address}` : 'Открыть меню Minecraft';
  };

  return (
    <div className="relative launch-controls">
      {isError ? <LaunchFailurePanel failure={failure} onRecover={recover} onRetry={handlePlay} canRetry={canRetry} busy={reloading}/> : <motion.button
        whileHover={!isDisabled ? { backgroundColor: '#8748a6' } : {}}
        whileTap={!isDisabled ? { opacity: 0.9 } : {}}
        onClick={handlePlay}
        disabled={isDisabled}
        className={`play launch-button ${isError ? 'launch-button-error' : ''}`}
      >
        <div className="play-inner">
          <div
            className="play-circle launch-icon"
          >
            {isLaunching ? (
              <Loader2 size={20} className="animate-spin" />
            ) : isError ? (
              <AlertCircle size={22} />
            ) : (
              <Play size={17} fill="currentColor" className="ml-0.5" />
            )}
          </div>

          <div className="play-copy">
            <div className="launch-title">
              {isLaunching
                ? 'Запуск…'
                : isRunning
                ? 'В игре'
                : isError
                ? 'Повторить запуск'
                : !activeAccount
                ? 'Выберите аккаунт'
                : needsMicrosoftLogin
                ? 'Войти в Microsoft'
                : !settings ? 'Проверить настройки' : autoConnect&&!selectedServer ? 'Выбрать сервер' : 'Играть'}
            </div>
            <div className="launch-detail">
              {getSubtext()}
            </div>
          </div>
          <span className="play-arrow" aria-hidden="true"><ArrowRight size={22} strokeWidth={1.5}/></span>
        </div>
      </motion.button>}
      <dialog ref={warningDialog} onCancel={() => setWarningAccountId(null)} onClose={() => setWarningAccountId(null)}
        aria-labelledby="server-access-title" aria-describedby="server-access-detail"
        className="server-access-dialog max-w-lg rounded-2xl border border-fuchsia-300/25 bg-[#16101d] p-6 text-white shadow-2xl backdrop:bg-black/70">
        <h2 id="server-access-title" className="text-lg font-bold">{accessWarning?.includes('ещё не связали')?'Свяжите Minecraft с Twitch':'Для сервера нужен Twitch'}</h2>
        <p id="server-access-detail" className="mt-3 text-sm leading-6 text-white/70">{accessWarning}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button autoFocus onClick={() => { setWarningAccountId(null); onOpenAccounts(); }}
            className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold hover:bg-purple-500">Аккаунт</button>
          <button onClick={continueLaunch} disabled={isDisabled}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50">Всё равно запустить</button>
          <button onClick={() => setWarningAccountId(null)} className="px-3 py-2 text-sm text-white/60 hover:text-white">Отмена</button>
        </div>
      </dialog>

    </div>
  );

};
