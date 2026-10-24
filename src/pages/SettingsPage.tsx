import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen } from 'lucide-react';
import { SettingRow, SwitchSetting } from '../components/settings/SettingRow';
import { LauncherUpdatePanel } from '../components/updates/LauncherUpdate';
import { useStore } from '../store/store';
import type { LaunchRecoveryTarget } from '../utils/errors';
import type { JavaStatus } from '../types';

export const SettingsPage: React.FC<{ updatesRequest?: number;initialTab?:LaunchRecoveryTarget }> = ({ updatesRequest = 0,initialTab='game' }) => {
  const { settings, updateSettings, gameState } = useStore();

  const playing = !['idle', 'error'].includes(gameState.status);
  const [repairingControls, setRepairingControls] = useState(false);
  const [controlsMessage, setControlsMessage] = useState('');
  const [controlsError, setControlsError] = useState(false);
  const handleRepairControls = async () => {
    if (playing || repairingControls || !settings) return;
    setRepairingControls(true); setControlsMessage(''); setControlsError(false);
    try {
      const result = await window.electronAPI.repairClickBindings();
      setControlsMessage(result.changed ? 'Готово. Конфликтующие сочетания JEI отключены, резервная копия сохранена. Можно запускать Minecraft.' : 'Исправление уже применено: конфликтующих назначений на ЛКМ нет.');
    } catch (error) {
      setControlsError(true);
      setControlsMessage((error instanceof Error ? error.message : 'Не удалось исправить управление.').replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ''));
    } finally { setRepairingControls(false); }
  };
  const handleRepairResources = async () => {
    if (playing || repairingControls || !settings) return;
    setRepairingControls(true); setControlsMessage(''); setControlsError(false);
    try {
      const result = await window.electronAPI.repairResourcePacks();
      setControlsMessage(result.changed ? 'Интерфейс Homestead включён. Другие ресурс-паки сохранены, резервная копия создана.' : 'Интерфейс Homestead уже включён.');
    } catch (error) { setControlsError(true); setControlsMessage((error instanceof Error ? error.message : 'Не удалось восстановить интерфейс.').replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')); }
    finally { setRepairingControls(false); }
  };
  useEffect(() => { setControlsMessage(''); setControlsError(false); }, [settings?.gameDirectory]);
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
      setFullscreen(settings.fullscreen ?? false);
      setCloseAfterLaunch(settings.closeOnLaunch ?? false);
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

  const [activeTab,setActiveTab]=useState<string>(initialTab);
  useEffect(()=>{if(updatesRequest>0)setActiveTab('launcher');},[updatesRequest]);
  const sections = [['game','Игра'],['java','Java и файлы'],['pack','Сборка'],['launcher','Лаунчер']];

  return <motion.div key="settings" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="workspace-page settings-page">
    <header className="page-head"><h1>Настройки</h1><p>Игра, файлы и поведение лаунчера</p></header>
    <div className="settings-layout">
      <nav className="settings-menu" aria-label="Разделы настроек">{sections.map(([id,label]) =>
        <button key={id} aria-pressed={activeTab===id} onClick={()=>setActiveTab(id)}>{label}</button>)}</nav>
      <div className="settings-sections" data-tab={activeTab} key={activeTab}>
        <section data-setting="game" className="settings-tab">
          <SettingRow title="Память" description="Для Homestead Cozy рекомендуем 4–8 ГБ оперативной памяти."
            className="setting-memory" control={<output className="memory-value" htmlFor="game-memory">{ram} ГБ</output>}>
            <input id="game-memory" aria-label="Выделенная оперативная память" aria-valuetext={ram+' ГБ'}
              type="range" style={{'--memory-fill': ((ram-2)/14*100)+'%'} as React.CSSProperties}
              min={2} max={16} step={1} value={ram} disabled={!settings} onChange={e=>handleRamChange(Number(e.target.value))}/>
            <div className="memory-scale"><span>2 ГБ</span><span>16 ГБ</span></div>
          </SettingRow>
          <SwitchSetting title="Полноэкранный режим" description="Открывать Minecraft на весь экран."
            accessibleName="Полноэкранный режим по умолчанию" checked={fullscreen} disabled={!settings} onToggle={handleToggleFullscreen}/>
        </section>
        <section data-setting="java" className="settings-tab">
          <SettingRow title="Java для игры"
            description={settings?.javaPath?'Используем выбранную вами Java. Версию и разрядность проверяем перед запуском.':'Java 21 устанавливается автоматически при первом запуске игры.'}
            control={<span className={'setting-status '+(javaStatus?.status==='ready'?'is-ready':'')}>
              {javaBusy?'Подготовка…':!javaStatus?'Проверяем…':javaStatus.status==='ready'?'Java '+javaStatus.version+' · 64 бит':javaStatus.status==='missing'?'Установится при запуске':'Нужна проверка'}
            </span>}>
            <div className="setting-path">{javaStatus?.path || javaPath}</div>
            <div className="setting-actions">
              <button className="s-button" disabled={playing||javaBusy||!settings} onClick={handleSelectJava}>Выбрать свою Java</button>
              {settings?.javaPath?<button className="s-button" disabled={playing||javaBusy||!settings} onClick={handleResetJava}>Использовать Java SEFI</button>:
                <button className="s-button" disabled={playing||javaBusy||!settings} onClick={handlePrepareJava}>{javaBusy?'Подготовка Java…':javaStatus?.status==='ready'?'Проверить Java SEFI':'Скачать Java SEFI'}</button>}
            </div>
            {(javaTask||javaStatus?.message)&&<p className="setting-row-note" role="status">{javaTask||javaStatus?.message}</p>}
            {javaError&&<p className="setting-feedback" role="alert">{javaError}</p>}
          </SettingRow>
          <SettingRow title="Папка игры" description="Здесь хранятся сборка, миры и скриншоты.">
            <div className="setting-path">{gameDir}</div>
            <div className="setting-actions">
              <button className="s-button" disabled={playing||javaBusy||!settings} onClick={handleSelectGameDir}>Изменить папку</button>
              <button className="s-button" disabled={!settings} onClick={handleOpenGameDir}><FolderOpen size={14} strokeWidth={1.5}/>Открыть папку</button>
            </div>
            <p className="setting-row-note">При выборе диска создадим на нём папку SEFI Minecraft.</p>
            {directoryError&&<p className="setting-feedback" role="alert">{directoryError}</p>}
          </SettingRow>
        </section>
        <section data-setting="pack" className="settings-tab">
          <SettingRow title="Установка сборки"
            description="Моды и настройки загружаются автоматически при запуске. Уже скачанный официальный ZIP Homestead 1.3.7 можно импортировать."
            control={<button className="s-button" disabled={importing||playing||!settings} onClick={handleImport}>{importing?'Проверяем архив…':'Импортировать ZIP'}</button>}>
            <p className="setting-row-note">Проверим версию и состав архива. Недостающие моды скачаем отдельно.</p>
            {importMessage&&<p role={importError?'alert':'status'} className="setting-feedback">{importMessage}</p>}
          </SettingRow>
          <div className="setting-recovery">
            <h2 className="setting-group-title">Восстановление</h2>
            <p className="setting-row-description">Перед применением закройте Minecraft. Создадим резервную копию и сохраним остальные настройки.</p>
            <SettingRow headingLevel="h3" title="Сочетания Shift / Ctrl + ЛКМ" description="Отключить конфликтующие назначения JEI."
              control={<button className="s-button" disabled={playing||repairingControls||!settings} onClick={handleRepairControls}>{repairingControls?'Исправляем…':'Исправить управление'}</button>}/>
            <SettingRow headingLevel="h3" title="Интерфейс Homestead" description="Включить ресурс-пак сборки."
              control={<button className="s-button" disabled={playing||repairingControls||!settings} onClick={handleRepairResources}>Вернуть интерфейс сборки</button>}/>
            {controlsMessage&&<p role={controlsError?'alert':'status'} className="setting-feedback">{controlsMessage}</p>}
          </div>
        </section>
        <section data-setting="launcher" className="settings-tab">
          <SwitchSetting title="Скрывать лаунчер во время игры" description="Окно вернётся после выхода из Minecraft."
            accessibleName="Скрывать лаунчер на время игры" checked={closeAfterLaunch} disabled={!settings} onToggle={handleToggleClose}/>
          <SwitchSetting title="Статус в Discord" description="Показывать Sweet Home и время игры в профиле."
            note="Нужен запущенный Discord с разрешённой игровой активностью."
            accessibleName="Показывать игру в Discord" checked={settings?.discordPresence!==false} disabled={!settings}
            onToggle={()=>{if(settings)void updateSettings({...settings,discordPresence:settings.discordPresence===false});}}/>
          <SettingRow title="Обновления лаунчера"><LauncherUpdatePanel/></SettingRow>
        </section>
      </div>
    </div>
  </motion.div>;
};
