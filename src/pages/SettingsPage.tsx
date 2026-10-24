import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen } from 'lucide-react';
import './SettingsPage.css';
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

  const [activeTab,setActiveTab]=useState('game');
  const sections = [['game','Игра'],['java','Java и файлы'],['pack','Сборка'],['launcher','Лаунчер']];
  const toggle = (label: string, checked: boolean, onClick: () => void, description?: string, visibleLabel = label) => (
    <button type="button" className="setting-switch-row" role="switch" aria-label={label}
      aria-checked={checked} disabled={!settings} onClick={onClick}>
      <span>{visibleLabel}{description && <small>{description}</small>}</span><span className="setting-switch" aria-hidden="true"><i /></span>
    </button>
  );
  return <motion.div key="settings" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="workspace-page settings-page">
    <header className="page-head"><h1>Настройки</h1><p>Игра, файлы и поведение лаунчера</p></header>
    <div className="settings-layout">
      <nav className="settings-menu" aria-label="Разделы настроек">{sections.map(([id,label]) =>
        <button key={id} aria-pressed={activeTab===id} onClick={()=>setActiveTab(id)}>{label}</button>)}</nav>
      <div className="settings-sections" data-tab={activeTab} key={activeTab}>
        <section data-setting="game" className="setting-group setting-memory">
          <h2>Память</h2><p>Для Homestead Cozy рекомендуем 4–8 ГБ оперативной памяти.</p>
          <div className="memory-control"><label htmlFor="game-memory">Выделено для Minecraft</label><output htmlFor="game-memory">{ram} ГБ</output></div>
          <input id="game-memory" aria-label="Выделенная оперативная память" aria-valuetext={ram+' ГБ'} type="range" style={{'--memory-fill': ((ram-2)/14*100)+'%'} as React.CSSProperties} min={2} max={16} step={1} value={ram} disabled={!settings}
            onChange={e=>handleRamChange(Number(e.target.value))}/>
          <div className="memory-scale"><span>2 ГБ</span><span>16 ГБ</span></div>
        </section>
        <section data-setting="game" className="setting-group setting-display">
          {toggle('Полноэкранный режим по умолчанию',fullscreen,handleToggleFullscreen,'Открывать Minecraft на весь экран','Полноэкранный режим')}
        </section>
        <section data-setting="java" className="setting-group">
          <div className="setting-heading"><h2>Java</h2><span className={'setting-status '+(javaStatus?.status==='ready'?'is-ready':'')}>
            {javaBusy?'Подготовка…':!javaStatus?'Проверяем…':javaStatus.status==='ready'?'Java '+javaStatus.version+' · 64 бит':javaStatus.status==='missing'?'Установится при запуске':'Нужна проверка'}</span></div>
          <p>{settings?.javaPath?'Используем выбранную вами Java. Версию и разрядность проверяем перед запуском.':'Java 21 устанавливается автоматически при первом запуске игры.'}</p>
          <div className="setting-path">{javaPath}</div>
          <div className="setting-actions">
            <button className="s-button" disabled={playing||javaBusy||!settings} onClick={handleSelectJava}>Выбрать свою Java</button>
            {settings?.javaPath?<button className="s-button" disabled={playing||javaBusy||!settings} onClick={handleResetJava}>Использовать Java SEFI</button>:
            <button className="s-button" disabled={playing||javaBusy||!settings} onClick={handlePrepareJava}>{javaBusy?'Подготовка Java…':javaStatus?.status==='ready'?'Проверить Java SEFI':'Скачать Java SEFI'}</button>}
          </div>
          {javaStatus?.path&&<p className="setting-detail setting-path">{javaStatus.path}</p>}
          {(javaTask||javaStatus?.message)&&<p className="setting-detail" role="status">{javaTask||javaStatus?.message}</p>}
          {javaError&&<p className="setting-feedback" role="alert">{javaError}</p>}
        </section>
        <section data-setting="java" className="setting-group">
          <h2>Папка игры</h2><p>Здесь хранятся сборка, миры и скриншоты.</p>
          <div className="setting-path">{gameDir}</div>
          <div className="setting-actions">
            <button className="s-button" disabled={playing||javaBusy||!settings} onClick={handleSelectGameDir}>Изменить папку</button>
            <button className="s-button" disabled={!settings} onClick={handleOpenGameDir}><FolderOpen size={14} strokeWidth={1.5}/>Открыть папку</button>
          </div>
          <p className="setting-detail">При выборе диска создадим на нём папку SEFI Minecraft.</p>
          {directoryError&&<p className="setting-feedback" role="alert">{directoryError}</p>}
        </section>
        <section data-setting="pack" className="setting-group">
          <h2>Установка сборки</h2><p>Моды и настройки загружаются автоматически при запуске. Если официальный ZIP Homestead 1.3.7 уже скачан, можно импортировать его.</p>
          <div className="setting-actions"><button className="s-button" disabled={importing||playing||!settings} onClick={handleImport}>{importing?'Проверяем архив…':'Импортировать ZIP сборки'}</button></div>
          <p className="setting-detail">Проверим версию и состав архива. Недостающие моды скачаем отдельно.</p>
          {importMessage&&<p role={importError?'alert':'status'} className="setting-feedback">{importMessage}</p>}
        </section>
        <section data-setting="pack" className="setting-group">
          <h2>Восстановление</h2><p>Исправления сохраняют остальные настройки и создают резервную копию. Перед применением закройте Minecraft.</p>
          <div className="setting-repair-row"><div><h3>Сочетания Shift / Ctrl + ЛКМ</h3><p>Отключить конфликтующие назначения JEI.</p></div>
            <button className="s-button" disabled={playing||repairingControls||!settings} onClick={handleRepairControls}>{repairingControls?'Исправляем…':'Исправить управление'}</button></div>
          <div className="setting-repair-row"><div><h3>Интерфейс Homestead</h3><p>Включить ресурс-пак сборки.</p></div><button className="s-button" disabled={playing||repairingControls||!settings} onClick={handleRepairResources}>Вернуть интерфейс сборки</button></div>
          {controlsMessage&&<p role={controlsError?'alert':'status'} className="setting-feedback">{controlsMessage}</p>}
        </section>
        <section data-setting="launcher" className="setting-group">
          <h2>Во время игры</h2>{toggle('Скрывать лаунчер на время игры',closeAfterLaunch,handleToggleClose)}
        </section>
        <section data-setting="launcher" className="setting-group setting-discord">
          <div className="setting-heading setting-toggle-heading">
            <h2>Discord</h2>
            <button type="button" className="setting-inline-switch" role="switch" aria-label="Показывать игру в Discord"
              aria-checked={settings?.discordPresence!==false} disabled={!settings}
              onClick={()=>{if(settings)void updateSettings({...settings,discordPresence:settings.discordPresence===false});}}>
              <span className="setting-switch" aria-hidden="true"><i /></span>
            </button>
          </div>
          <p>Показывать Sweet Home и время игры в профиле.</p>
          <p className="setting-detail">Нужен запущенный Discord с разрешённой игровой активностью.</p>
        </section>
        <section data-setting="launcher" className="setting-group">
          <h2>Обновления</h2><p>Проверяем автоматически раз в 2 часа и приостанавливаем на время игры.</p>
          <p className="setting-detail" role="status">{updateText}</p>
          <div className="setting-actions"><button className="s-button" onClick={checkUpdates} disabled={playing||checkingUpdate||['checking','available','downloading'].includes(updateInfo?.status||'')}>{checkingUpdate?'Проверяем…':'Проверить обновления'}</button>
            {updateInfo?.status==='ready'&&<button className="s-button" onClick={installLauncherUpdate} disabled={playing}>Установить и перезапустить</button>}</div>
        </section>
      </div>
    </div>
  </motion.div>;
};
