import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MemoryStick, Coffee, Monitor, FolderOpen, Sparkles, DownloadCloud, RotateCcw } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { useStore } from '../store/store';
import type { JavaStatus } from '../types';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, setUpdateInfo, updateInfo, gameState, installLauncherUpdate } = useStore();

  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const playing = !['idle', 'error'].includes(gameState.status);
  const checkUpdates = async () => {
    if (playing || checkingUpdate) return;
    setCheckingUpdate(true);
    try { setUpdateInfo(await window.electronAPI.checkForUpdates()); }
    catch { setUpdateInfo({ status: 'error', error: 'Не удалось проверить обновления. Повторите позже.' }); }
    finally { setCheckingUpdate(false); }
  };
  const updateText = playing ? 'Проверки приостановлены на время игры.'
    : updateInfo?.status === 'checking' ? 'Проверяем обновления…'
    : updateInfo?.status === 'downloading' ? 'Скачивание обновления: '+(updateInfo.percent || 0)+'%'
    : updateInfo?.status === 'ready' ? 'Обновление скачано и готово к установке.'
    : updateInfo?.status === 'available' ? 'Найдено обновление. Начинаем загрузку…'
    : updateInfo?.status === 'error' ? 'Не удалось проверить или скачать обновление. Повторите позже.'
    : updateInfo?.status === 'idle' ? 'Установлена актуальная версия.'
    : 'Проверяйте вручную или дождитесь автоматической проверки.';
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [importError, setImportError] = useState(false);
  const [ram, setRam] = useState(settings?.ramMax ? Math.round(settings.ramMax / 1024) : 6);
  const [fullscreen, setFullscreen] = useState(settings?.fullscreen ?? false);
  const [closeAfterLaunch, setCloseAfterLaunch] = useState(settings?.closeOnLaunch ?? false);
  const [javaPath, setJavaPath] = useState(settings?.javaPath || 'Java SEFI · автоматическая установка');
  const [javaStatus, setJavaStatus] = useState<JavaStatus | null>(null);
  const [javaBusy, setJavaBusy] = useState(false);
  const [javaError, setJavaError] = useState('');
  const [javaTask, setJavaTask] = useState('');
  useEffect(() => {
    let cancelled = false;
    setJavaStatus(null);
    window.electronAPI.getJavaStatus().then(value => { if (!cancelled) setJavaStatus(value); })
      .catch(() => { if (!cancelled) setJavaStatus({ status: 'error', source: settings?.javaPath ? 'custom' : 'managed', message: 'Не удалось проверить Java.' }); });
    return () => { cancelled = true; };
  }, [settings?.javaPath, gameState.status]);
  useEffect(() => window.electronAPI.onDownloadProgress(progress => {
    if (progress.stage === 'java') setJavaTask(progress.task + (progress.total > 100 ? ' · ' + Math.round(progress.percentage) + '%' : ''));
  }), []);
  const cleanJavaError = (error: unknown) => (error instanceof Error ? error.message : String(error)).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
  const handlePrepareJava = async () => {
    if (playing || javaBusy || !settings) return;
    setJavaBusy(true); setJavaError(''); setJavaTask('Проверка Java SEFI…');
    try { setJavaStatus(await window.electronAPI.prepareJava()); }
    catch (error) { setJavaError(cleanJavaError(error)); }
    finally { setJavaBusy(false); setJavaTask(''); }
  };
  const [gameDir, setGameDir] = useState(settings?.gameDirectory || 'C:\\Users\\...\\.sefi-launcher');

  useEffect(() => {
    if (settings) {
      setRam(Math.round(settings.ramMax / 1024));
      setFullscreen(settings.fullscreen);
      setCloseAfterLaunch(settings.closeOnLaunch);
      setJavaPath(settings.javaPath || 'Java SEFI · автоматическая установка');
      if (settings.gameDirectory) setGameDir(settings.gameDirectory);
    }
  }, [settings]);

  const handleRamChange = (val: number) => {
    setRam(val);
    if (settings) {
      updateSettings({
        ...settings,
        ramMax: val * 1024,
        ramMin: Math.min(2048, val * 1024),
      });
    }
  };

  const handleToggleFullscreen = () => {
    const next = !fullscreen;
    setFullscreen(next);
    if (settings) {
      updateSettings({ ...settings, fullscreen: next });
    }
  };

  const handleToggleClose = () => {
    const next = !closeAfterLaunch;
    setCloseAfterLaunch(next);
    if (settings) {
      updateSettings({ ...settings, closeOnLaunch: next });
    }
  };

  const handleSelectJava = async () => {
    if (playing || javaBusy || !settings) return;
    setJavaBusy(true); setJavaError('');
    try {
      const selected = await window.electronAPI.selectJavaPath();
      if (selected) await updateSettings({ ...useStore.getState().settings!, javaPath: selected });
    } catch (error) { setJavaError(cleanJavaError(error)); }
    finally { setJavaBusy(false); }
  };
  const handleResetJava = async () => {
    if (playing || javaBusy || !settings) return;
    setJavaError('');
    await updateSettings({ ...settings, javaPath: '' });
  };

  const handleOpenGameDir = async () => {
    if (window.electronAPI?.openDirectory) {
      await window.electronAPI.openDirectory(gameDir);
    }
  };

  const [directoryError, setDirectoryError] = useState('');
  const handleSelectGameDir = async () => {
    setDirectoryError('');
    try {
      const selected = await window.electronAPI.selectGameDirectory();
      if (selected && settings) {
        setGameDir(selected);
        await updateSettings({ ...useStore.getState().settings!, gameDirectory: selected });
      }
    } catch (error) { setDirectoryError(cleanJavaError(error)); }
  };

  const handleImport = async () => {
    setImporting(true); setImportMessage(''); setImportError(false);
    try {
      const result = await window.electronAPI.importModpackArchive();
      if (!result.cancelled) setImportMessage('Архив проверен и сохранён. Нажмите «Играть»: недостающие моды скачаются отдельно.');
    } catch (error) {
      setImportError(true);
      setImportMessage((error instanceof Error ? error.message : 'Не удалось импортировать архив.').replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ''));
    } finally { setImporting(false); }
  };

  return (
    <motion.div
      key="settings"
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      className="h-full overflow-y-auto px-8 pb-10 pt-6 select-none"
    >
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Настройки</h1>
        <p className="mt-1 text-sm text-white/40">
          Параметры производительности, Java и поведения лаунчера
        </p>
      </div>

      <div className="mt-6 space-y-4 max-w-[800px]">
        <GlassCard className="p-5">
          <div className="text-sm font-semibold text-white">Сборка и загрузка</div>
          <p className="mt-2 text-xs leading-relaxed text-white/60">
            Моды загружаются с Modrinth, затем с CurseForge и доступного зеркала SEFI.
            Если архив уже скачан, выберите официальный ZIP Homestead 1.3.7: проверим версию и состав.
            ZIP CurseForge содержит настройки и часть модов; остальные загрузятся при запуске.
          </p>
          <button disabled={importing} onClick={handleImport}
            className="mt-4 rounded-lg border border-fuchsia-400/25 bg-fuchsia-400/10 px-4 py-2 text-sm text-fuchsia-200 disabled:opacity-50">
            {importing ? 'Проверяем архив…' : 'Импортировать ZIP сборки'}
          </button>
          {importMessage && <p role={importError ? 'alert' : 'status'} className={`mt-3 text-xs leading-relaxed select-text ${importError ? 'text-rose-300' : 'text-emerald-300'}`}>{importMessage}</p>}
        </GlassCard>

        {/* Memory & Performance */}
        <GlassCard className="p-5">
          <div className="flex items-center gap-2.5">
            <MemoryStick size={18} className="text-fuchsia-300" />
            <div className="text-sm font-semibold text-white">Память и производительность</div>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white/90">Выделенная оперативная память</div>
              <div className="mt-0.5 text-xs text-white/40">
                Для модпака Homestead Cozy рекомендуется 4–8 ГБ
              </div>
            </div>

            <div className="rounded-lg bg-fuchsia-400/10 border border-fuchsia-400/20 px-3 py-1 text-sm font-bold text-fuchsia-200">
              {ram} ГБ
            </div>
          </div>

          <input
            type="range"
            min={2}
            max={16}
            step={1}
            value={ram}
            onChange={(e) => handleRamChange(Number(e.target.value))}
            className="mt-5 w-full accent-fuchsia-500 cursor-pointer"
          />

          <div className="mt-2 flex justify-between text-[11px] text-white/30 font-mono">
            <span>2 ГБ</span>
            <span className="text-emerald-400/80">Рекомендуемая зона: 4 – 8 ГБ</span>
            <span>16 ГБ</span>
          </div>
        </GlassCard>

        {/* Java & Directories */}
        <GlassCard className="p-5">
          <div className="flex items-center gap-2.5">
            <Coffee size={18} className="text-fuchsia-300" />
            <div className="text-sm font-semibold text-white">Java и пути</div>
          </div>

          <div className="mt-4 space-y-4 divide-y divide-white/[0.05]">
            <div className="pt-2 flex items-center justify-between first:pt-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white/90">Среда выполнения Java</span>
                  <span className={"rounded-md px-2 py-0.5 text-[10px] font-medium border " + (javaStatus?.status === 'ready' ? 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20' : javaStatus?.status === 'error' ? 'bg-rose-400/10 text-rose-300 border-rose-400/20' : 'bg-white/5 text-white/60 border-white/10')}>
                    {javaBusy ? 'Подготовка…' : !javaStatus ? 'Проверяем…' : javaStatus.status === 'ready' ? 'Java ' + javaStatus.version + ' · 64 бит' : javaStatus.status === 'missing' ? 'Установится при запуске' : 'Нужна проверка'}
                  </span>
                </div>
                <div className="mt-1 text-xs text-white/35 font-mono truncate max-w-[400px]">
                  {javaPath}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {settings?.javaPath && (
                  <button
                    onClick={handleResetJava}
                    disabled={playing || javaBusy || !settings}
                    title="Использовать отдельную Java SEFI"
                    className="h-8 rounded-[8px] border border-white/[0.08] bg-white/[0.04] px-2.5 text-xs text-white/50 transition hover:bg-white/[0.08] hover:text-white cursor-pointer"
                  >
                    Java SEFI
                  </button>
                )}
                <button
                  disabled={playing || javaBusy || !settings}
                  onClick={handleSelectJava}
                  className="h-8 rounded-[8px] border border-white/[0.08] bg-white/[0.04] px-3 text-xs text-white/80 transition hover:bg-white/[0.08] hover:text-white cursor-pointer"
                >
                  Обзор...
                </button>
              </div>
            </div>

            <div className="pt-4 space-y-2">
              <p className="text-xs text-white/60 leading-relaxed">{settings?.javaPath ? 'Выбрана своя Java. Проверяем версию, разрядность и запуск с выделенной памятью. Чтобы перейти на автоматическую установку, нажмите «Java SEFI».' : 'SEFI скачает отдельную Java 21 для этой сборки. Она хранится в папке лаунчера и проверяется перед запуском игры.'}</p>
              {javaStatus?.path && <p className="text-[11px] font-mono text-white/40 break-all select-text">{javaStatus.path}</p>}
              <p role="status" className="text-xs text-white/60">{javaTask || javaStatus?.message}</p>
              {javaError && <p role="alert" className="text-xs text-rose-300 whitespace-pre-wrap select-text">{javaError}</p>}
              {!settings?.javaPath && <button disabled={playing || javaBusy || !settings} onClick={handlePrepareJava}
                className="rounded-lg border border-fuchsia-400/25 bg-fuchsia-400/10 px-3 py-2 text-xs text-fuchsia-200 disabled:opacity-50">
                {javaBusy ? 'Подготовка Java…' : javaStatus?.status === 'ready' ? 'Проверить Java SEFI' : 'Скачать Java SEFI'}
              </button>}
            </div>

            <div className="pt-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white/90">Папка установки клиента</div>
                <div className="mt-1 text-xs text-white/35 font-mono truncate max-w-[400px]">
                  {gameDir}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={playing || javaBusy || !settings}
                  onClick={handleSelectGameDir}
                  title="Выбрать другую папку для установки игры"
                  className="h-8 rounded-[8px] border border-white/[0.08] bg-white/[0.04] px-3 text-xs text-white/80 transition hover:bg-white/[0.08] hover:text-white cursor-pointer"
                >
                  Изменить...
                </button>
                <button
                  disabled={!settings}
                  onClick={handleOpenGameDir}
                  title="Открыть папку в проводнике Windows"
                  className="flex h-8 items-center gap-1.5 rounded-[8px] border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 text-xs text-fuchsia-200 transition hover:bg-fuchsia-500/20 hover:text-white cursor-pointer"
                >
                  <FolderOpen size={13} />
                  <span>Открыть папку</span>
                </button>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-white/40">При выборе целого диска создадим на нём папку SEFI Minecraft.</p>
          {directoryError && <p role="alert" className="mt-2 text-xs text-rose-300 whitespace-pre-wrap select-text">{directoryError}</p>}
        </GlassCard>

        {/* Display & Launch Options */}
        <GlassCard className="p-5">
          <div className="flex items-center gap-2.5">
            <Monitor size={18} className="text-fuchsia-300" />
            <div className="text-sm font-semibold text-white">Экран и запуск</div>
          </div>

          <div className="mt-4 space-y-3">
            <button
              onClick={handleToggleFullscreen}
              className="flex w-full items-center justify-between py-1.5 text-sm cursor-pointer"
            >
              <span className="text-white/75">Полноэкранный режим по умолчанию</span>
              <div
                className={`flex h-6 w-11 items-center rounded-full p-0.5 transition ${
                  fullscreen ? 'bg-fuchsia-500' : 'bg-white/10'
                }`}
              >
                <motion.div
                  animate={{ x: fullscreen ? 20 : 0 }}
                  className="size-5 rounded-full bg-white shadow"
                />
              </div>
            </button>

            <button
              onClick={handleToggleClose}
              className="flex w-full items-center justify-between py-1.5 text-sm cursor-pointer"
            >
              <span className="text-white/75">Скрывать лаунчер на время игры</span>
              <div
                className={`flex h-6 w-11 items-center rounded-full p-0.5 transition ${
                  closeAfterLaunch ? 'bg-fuchsia-500' : 'bg-white/10'
                }`}
              >
                <motion.div
                  animate={{ x: closeAfterLaunch ? 20 : 0 }}
                  className="size-5 rounded-full bg-white shadow"
                />
              </div>
            </button>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center gap-2.5"><RotateCcw size={18} className="text-fuchsia-300" /><h2 className="text-sm font-semibold text-white">Обновления лаунчера</h2></div>
          <p className="mt-2 text-xs text-white/50">Автоматически раз в 2 часа. Во время игры проверки приостановлены.</p>
          <p role="status" className="mt-3 text-xs text-white/70">{updateText}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={checkUpdates} disabled={playing || checkingUpdate || ['checking','available','downloading'].includes(updateInfo?.status || '')} className="rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-2 text-xs text-fuchsia-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-fuchsia-500/20">{checkingUpdate ? 'Проверяем…' : 'Проверить обновления'}</button>
            {updateInfo?.status === 'ready' && <button type="button" onClick={installLauncherUpdate} disabled={playing} className="rounded-lg bg-emerald-500/20 px-4 py-2 text-xs text-emerald-200 disabled:opacity-40">Установить и перезапустить</button>}
          </div>
        </GlassCard>

        {/* Update System & Test Mode (strictly visible during dev / npm run dev) */}
        {import.meta.env.DEV && (
          <GlassCard className="p-5 border-emerald-500/20 bg-emerald-950/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sparkles size={18} className="text-emerald-400" />
                <div>
                  <div className="text-sm font-semibold text-white">Автообновление лаунчера (Dev Mode)</div>
                  <div className="text-xs text-white/50">Проверка релизов и тихая установка через GitHub Releases</div>
                </div>
              </div>
              <div className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] text-emerald-400 font-medium">
                Бесшовный режим (Silent)
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-xs text-white/60">Тестовый просмотр внешнего вида в шапке:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setUpdateInfo({ status: 'downloading', version: '1.0.1', percent: 45 })}
                  className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-white/80 transition hover:bg-white/[0.1] cursor-pointer"
                >
                  <DownloadCloud size={12} className="text-emerald-400" />
                  <span>Имитировать скачивание (45%)</span>
                </button>
                <button
                  onClick={() => setUpdateInfo({ status: 'ready', version: '1.0.1' })}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-1 text-xs text-emerald-300 transition hover:bg-emerald-500/30 cursor-pointer font-medium"
                >
                  <Sparkles size={12} />
                  <span>Имитировать готовность</span>
                </button>
                <button
                  onClick={() => setUpdateInfo(null)}
                  title="Сбросить тестовый вид"
                  className="flex size-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/50 transition hover:text-white hover:bg-white/[0.08] cursor-pointer"
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            </div>
          </GlassCard>
        )}
      </div>
    </motion.div>
  );
};
