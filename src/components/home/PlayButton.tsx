import { motion } from 'framer-motion';
import { useState } from 'react';
import { launchErrorMessage } from '../../utils/errors';
import { Play, Download, Loader2, AlertCircle } from 'lucide-react';
import { useStore } from '../../store/store';

export const PlayButton: React.FC = () => {
  const { gameState, launch, activeAccount } = useStore();
  const [copyResult, setCopyResult] = useState<{ message: string; ok: boolean } | null>(null);
  const errorMessage = launchErrorMessage(gameState.message);
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
        className="rounded-[18px] border border-fuchsia-300/25 bg-[#16101d]/90 p-4 shadow-[0_12px_40px_rgba(177,72,255,0.18)] backdrop-blur-xl"
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
            initial={{ width: 0 }}
            animate={{ width: isExtracting ? '100%' : `${percentage}%` }}
            transition={{ ease: 'linear', duration: 0.2 }}
            className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-400"
          />
        </div>
      </motion.div>
    );
  }

  // If community profile is marked as 'microsoft' license, player MUST be playing through an official Microsoft session
  const needsMicrosoftLogin = activeAccount?.mcType === 'microsoft' && activeAccount.type !== 'microsoft';
  const isDisabled = !activeAccount || needsMicrosoftLogin || isLaunching || isRunning;

  const getSubtext = () => {
    if (!activeAccount) return 'Выберите или добавьте профиль';
    if (needsMicrosoftLogin) return `Войдите через Microsoft (${activeAccount.username})`;
    if (isLaunching) return 'Подготовка окружения игры...';
    if (isRunning) return 'Игра уже запущена';
    if (isError) return 'Подробности ниже. Нажмите, чтобы повторить.';
    return 'Homestead Cozy • v1.3.7';
  };

  return (
    <div className="relative">
      <motion.button
        whileHover={!isDisabled ? { scale: 1.01 } : {}}
        whileTap={!isDisabled ? { scale: 0.99 } : {}}
        onClick={launch}
        disabled={isDisabled}
        className={`group relative h-[86px] w-full overflow-hidden rounded-[18px] border transition-all duration-300 ${
          isDisabled
            ? 'border-white/[0.06] bg-[#1a1722]/60 cursor-not-allowed opacity-75'
            : isError
            ? 'border-red-500/40 bg-gradient-to-r from-rose-900 to-red-600 shadow-[0_12px_40px_rgba(255,80,80,0.25)]'
            : 'border-white/20 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-purple-500 shadow-[0_18px_50px_rgba(178,73,255,0.32)] hover:shadow-[0_20px_60px_rgba(178,73,255,0.45)]'
        }`}
      >
        {/* Soft gloss overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent opacity-60" />

        {/* Shimmer light sweep on hover */}
        {!isDisabled && (
          <div className="absolute -left-32 top-0 h-full w-48 rotate-12 bg-white/20 blur-3xl transition duration-700 group-hover:translate-x-[750px]" />
        )}

        <div className="relative flex items-center justify-start gap-4 px-6 h-full">
          <div
            className={`flex size-11 shrink-0 items-center justify-center rounded-full shadow-lg ${
              isDisabled
                ? 'bg-white/10 text-white/40'
                : isError
                ? 'bg-white text-red-600'
                : 'bg-white text-fuchsia-600 shadow-fuchsia-900/40'
            }`}
          >
            {isLaunching ? (
              <Loader2 size={20} className="animate-spin text-fuchsia-600" />
            ) : isError ? (
              <AlertCircle size={22} />
            ) : (
              <Play size={20} fill="currentColor" className="ml-0.5" />
            )}
          </div>

          <div className="text-left min-w-0 flex-1">
            <div className="text-[22px] font-black tracking-[0.06em] text-white leading-tight">
              {isLaunching
                ? 'ЗАПУСК...'
                : isRunning
                ? 'В ИГРЕ'
                : isError
                ? 'ПОВТОРИТЬ ЗАПУСК'
                : !activeAccount
                ? 'ВЫБЕРИТЕ АККАУНТ'
                : needsMicrosoftLogin
                ? 'НУЖНА ЛИЦЕНЗИЯ'
                : 'ИГРАТЬ'}
            </div>
            <div className="mt-0.5 text-[12px] font-medium text-white/70 tracking-wide truncate">
              {getSubtext()}
            </div>
          </div>
        </div>
      </motion.button>
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
