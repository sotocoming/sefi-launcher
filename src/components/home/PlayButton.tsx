import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { serverAccessWarning } from '../../utils/server-access';
import { launchErrorMessage } from '../../utils/errors';
import { ArrowRight, Play, Download, Loader2, AlertCircle } from 'lucide-react';
import { useStore } from '../../store/store';

export const PlayButton: React.FC<{ onOpenAccounts: () => void }> = ({ onOpenAccounts }) => {
  const { gameState, launch, activeAccount, settings, launcherConfig } = useStore();
  const host = launcherConfig?.server.ip || 'minecraft.sotocoming.ru';
  const port = launcherConfig?.server.port || 25565;
  const endpoints = launcherConfig?.server.endpoints?.length ? launcherConfig.server.endpoints : [
    { id: 'primary', label: 'Основной', address: port === 25565 ? host : `${host}:${port}` },
  ];
  const selectedId = settings?.selectedServerId || endpoints[0].id;
  const selectedServer = endpoints.find(endpoint => endpoint.id === selectedId);
  const autoConnect = settings?.autoConnect === true;
  const [copyResult, setCopyResult] = useState<{ message: string; ok: boolean } | null>(null);
  const [warningAccountId, setWarningAccountId] = useState<string | null>(null);
  const warningDialog = useRef<HTMLDialogElement>(null);
  const accessWarning = serverAccessWarning(activeAccount);
  useEffect(() => {
    if (warningAccountId && accessWarning) warningDialog.current?.showModal();
    else warningDialog.current?.close();
  }, [warningAccountId, accessWarning]);
  const handlePlay = () => {
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
  const errorMessage = launchErrorMessage(gameState.status === 'error' ? gameState.message : '');
  const copyError = async () => {
    try { await navigator.clipboard.writeText(errorMessage); setCopyResult({ message: errorMessage, ok: true }); }
    catch { setCopyResult({ message: errorMessage, ok: false }); }
  };

  const isDownloading = gameState.status === 'downloading';
  const isExtracting = gameState.status === 'extracting';
  const isLaunching = gameState.status === 'launching';
  const isChecking = gameState.status === 'checking';
  const isRunning = gameState.status === 'running';
  const isError = gameState.status === 'error';

  const downloadProgress = isDownloading ? gameState.progress : null;
  const percentage = downloadProgress?.percentage ? Math.round(downloadProgress.percentage) : 0;
  const taskText = downloadProgress?.task || 'Загрузка компонентов...';
  const speedText = downloadProgress?.speed
    ? `${(downloadProgress.speed / 1024 / 1024).toFixed(1)} MB/s`
    : 'CurseForge CDN';

  if (isDownloading || isExtracting || isChecking) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        role="status" aria-live="polite" className="sefi-panel p-4"
      >
        <div className="flex items-center">
          <div className="flex size-9 items-center justify-center rounded-xl bg-fuchsia-500/20 text-fuchsia-300">
            {isDownloading ? <Download size={18} /> : <Loader2 size={18} className="animate-spin" />}
          </div>

          <div className="ml-3 min-w-0 flex-1">
            <div className="text-sm font-semibold text-white truncate">
              {isExtracting ? 'Распаковка ассетов и модов...' : taskText}
            </div>
            <div className="mt-0.5 text-xs text-white/40">
              {isExtracting ? 'Пожалуйста, подождите' : speedText}
            </div>
          </div>

          <div className="ml-3 text-sm font-bold text-fuchsia-200">
            {isDownloading ? `${percentage}%` : ''}
          </div>
        </div>

        <div className="mt-3.5 h-2 overflow-hidden rounded-full bg-white/[0.08]">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: isExtracting ? 1 : Math.max(0, Math.min(1, percentage / 100)) }}
            transition={{ ease: 'linear', duration: 0.2 }}
            className="h-full origin-left rounded-full bg-sefi-purple"
          />
        </div>
      </motion.div>
    );
  }

  // If community profile is marked as 'microsoft' license, player MUST be playing through an official Microsoft session
  const needsMicrosoftLogin = activeAccount?.mcType === 'microsoft' && activeAccount.type !== 'microsoft';
  const isDisabled = !activeAccount || !settings || needsMicrosoftLogin || isLaunching || isRunning || (autoConnect && !selectedServer);

  const getSubtext = () => {
    if (!activeAccount) return 'Выберите или добавьте профиль';
    if (needsMicrosoftLogin) return `Войдите через Microsoft (${activeAccount.username})`;
    if (isLaunching) return 'Подготовка окружения игры...';
    if (isRunning) return 'Игра уже запущена';
    if (autoConnect && !selectedServer) return 'Выберите доступный адрес сервера';
    if (isError) return 'Подробности ниже. Нажмите, чтобы повторить.';
    return autoConnect ? `Подключение: ${selectedServer?.label} · ${selectedServer?.address}` : 'Открыть меню Minecraft';
  };

  return (
    <div className="relative">
      <motion.button
        whileHover={!isDisabled ? { backgroundColor: '#8d42b4' } : {}}
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
              <Play size={20} fill="currentColor" className="ml-0.5" />
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
                ? 'Нужна лицензия'
                : 'Играть'}
            </div>
            <div className="launch-detail">
              {getSubtext()}
            </div>
          </div>
          <span className="play-arrow" aria-hidden="true"><ArrowRight size={24} strokeWidth={2}/></span>
        </div>
      </motion.button>
      <dialog ref={warningDialog} onCancel={() => setWarningAccountId(null)} onClose={() => setWarningAccountId(null)}
        aria-labelledby="server-access-title" aria-describedby="server-access-detail"
        className="max-w-lg rounded-2xl border border-fuchsia-300/25 bg-[#16101d] p-6 text-white shadow-2xl backdrop:bg-black/70">
        <h2 id="server-access-title" className="text-lg font-bold">Для входа на сервер нужен Twitch</h2>
        <p id="server-access-detail" className="mt-3 text-sm leading-6 text-white/70">{accessWarning}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button autoFocus onClick={() => { setWarningAccountId(null); onOpenAccounts(); }}
            className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold hover:bg-purple-500">Аккаунт</button>
          <button onClick={continueLaunch} disabled={isDisabled}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50">Всё равно запустить</button>
          <button onClick={() => setWarningAccountId(null)} className="px-3 py-2 text-sm text-white/60 hover:text-white">Отмена</button>
        </div>
      </dialog>
      {isError && (
        <div role="alert" className="mt-3 rounded-xl border border-red-400/25 bg-red-950/40 p-4">
          <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm text-red-100 select-text">{errorMessage}</p>
          <button onClick={copyError} className="mt-3 text-xs text-red-200 underline underline-offset-4 hover:text-white">
            {copyResult?.message === errorMessage && copyResult.ok ? 'Скопировано' : 'Скопировать ошибку'}
          </button>
          {copyResult?.message === errorMessage && !copyResult.ok && (
            <p className="mt-2 text-xs text-red-200">Не удалось скопировать. Выделите и скопируйте текст выше.</p>
          )}
        </div>
      )}
    </div>
  );

};
