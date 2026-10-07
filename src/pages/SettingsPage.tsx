import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MemoryStick, Coffee, Monitor, FolderOpen, Sparkles, DownloadCloud, RotateCcw } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { useStore } from '../store/store';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, setUpdateInfo } = useStore();

  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [importError, setImportError] = useState(false);
  const [ram, setRam] = useState(settings?.ramMax ? Math.round(settings.ramMax / 1024) : 6);
  const [fullscreen, setFullscreen] = useState(settings?.fullscreen ?? false);
  const [closeAfterLaunch, setCloseAfterLaunch] = useState(settings?.closeOnLaunch ?? false);
  const [javaPath, setJavaPath] = useState(settings?.javaPath || 'Автоопределение (Java 17/21)');
  const [gameDir, setGameDir] = useState(settings?.gameDirectory || 'C:\\Users\\...\\.sefi-launcher');

  useEffect(() => {
    if (settings) {
      setRam(Math.round(settings.ramMax / 1024));
      setFullscreen(settings.fullscreen);
      setCloseAfterLaunch(settings.closeOnLaunch);
      if (settings.javaPath) setJavaPath(settings.javaPath);
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
    if (window.electronAPI?.selectJavaPath) {
      const selected = await window.electronAPI.selectJavaPath();
      if (selected && settings) {
        setJavaPath(selected);
        updateSettings({ ...settings, javaPath: selected });
      }
    }
  };

  const handleResetJava = () => {
    if (settings) {
      const def = 'Автоопределение (Java 17/21)';
      setJavaPath(def);
      updateSettings({ ...settings, javaPath: '' });
    }
  };

  const handleOpenGameDir = async () => {
    if (window.electronAPI?.openDirectory) {
      await window.electronAPI.openDirectory(gameDir);
    }
  };

  const handleSelectGameDir = async () => {
    if (window.electronAPI?.selectGameDirectory) {
      const selected = await window.electronAPI.selectGameDirectory();
      if (selected && settings) {
        setGameDir(selected);
        updateSettings({ ...settings, gameDirectory: selected });
      }
    }
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
                  <span className="rounded-md bg-emerald-400/[0.1] px-2 py-0.5 text-[10px] font-medium text-emerald-300 border border-emerald-400/20">
                    Java 17/21 обнаружена
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
                    title="Сбросить на автоопределение"
                    className="h-8 rounded-[8px] border border-white/[0.08] bg-white/[0.04] px-2.5 text-xs text-white/50 transition hover:bg-white/[0.08] hover:text-white cursor-pointer"
                  >
                    Авто
                  </button>
                )}
                <button
                  onClick={handleSelectJava}
                  className="h-8 rounded-[8px] border border-white/[0.08] bg-white/[0.04] px-3 text-xs text-white/80 transition hover:bg-white/[0.08] hover:text-white cursor-pointer"
                >
                  Обзор...
                </button>
              </div>
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
                  onClick={handleSelectGameDir}
                  title="Выбрать другую папку для установки игры"
                  className="h-8 rounded-[8px] border border-white/[0.08] bg-white/[0.04] px-3 text-xs text-white/80 transition hover:bg-white/[0.08] hover:text-white cursor-pointer"
                >
                  Изменить...
                </button>
                <button
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
