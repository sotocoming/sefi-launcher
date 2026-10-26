import type { UpdateInfo } from '../types';

export function updateProgress(value?: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value!))) : 0;
}
export function updateErrorMessage(info: UpdateInfo): string {
  const error = info.error || '';
  if (/локальн.*тест|установленном лаунчере/i.test(error)) return error;
  if (/ENOSPC|no space|disk.*full/i.test(error)) return 'Не хватает места на диске. Освободите место и повторите загрузку.';
  if (/EACCES|EPERM|permission|access.*denied/i.test(error)) return 'Нет доступа к файлам обновления. Закройте другие копии лаунчера и повторите попытку.';
  if (/checksum|sha512|sha256|integrity|signature/i.test(error)) return 'Файл обновления не прошёл проверку. Повторите загрузку.';
  if (/timeout|timed out|ETIMEDOUT/i.test(error)) return 'Сервер не ответил вовремя. Проверьте подключение и повторите попытку.';
  if (/offline|ENOTFOUND|ECONN|ERR_NETWORK|сети|подключения/i.test(error)) return 'Не удалось подключиться к серверу обновлений. Проверьте интернет и повторите попытку.';
  return info.phase === 'install'
    ? 'Не удалось запустить установку. Обновление сохранено — попробуйте перезапустить ещё раз.'
    : info.phase === 'download'
      ? 'Загрузка прервалась. Повторите попытку — текущая версия лаунчера продолжает работать.'
      : 'Не удалось проверить обновления. Текущая версия работает, повторите проверку позже.';
}
export function updateView(info: UpdateInfo | null, playing: boolean) {
  const state = info?.status || 'unverified';
  const canInstall = state === 'ready' || state === 'error' && info?.phase === 'install' && info.canInstall;
  const active = ['checking', 'available', 'downloading', 'installing'].includes(state);
  const titles: Record<string, string> = {
    unverified:'Пока не проверяли', idle:'Установлена актуальная версия', checking:'Проверяем обновления',
    available:'Обновление найдено', downloading:'Загружаем обновление', ready:'Всё готово к обновлению',
    installing:'Перезапускаем лаунчер', error:'Обновление не завершено'
  };
  const details: Record<string,string> = {
    unverified:'Можно проверить вручную или дождаться автоматической проверки.',
    idle:'Новая версия появится здесь, когда станет доступна.',
    checking:'Это займёт немного времени.',
    available:'Подготавливаем автоматическую загрузку.',
    downloading:'Можно продолжать пользоваться лаунчером.',
    ready:'Новая версия установится при перезапуске.',
    installing:'Сейчас откроется обновлённая версия.'
  };
  return {
    state, title:titles[state], detail:state==='error'?updateErrorMessage(info!):details[state],
    progress:updateProgress(info?.percent), version:info?.version?.slice(0,80),
    action:canInstall?'install' as const:active?'none' as const:'check' as const,
    actionLabel:canInstall?(state==='error'?'Повторить перезапуск':'Установить и перезапустить'):state==='error'?'Повторить проверку':'Проверить',
    disabled:playing || active,
    notice:playing?'Проверка и перезапуск доступны после выхода из Minecraft.':undefined,
    energy:state==='downloading'||state==='ready',
  };
}
export function updateBytes(info: UpdateInfo | null): string | undefined {
  if (!info || !Number.isFinite(info.total) || !Number.isFinite(info.transferred) || info.total! <= 0) return;
  const mb=(bytes:number)=>(bytes/1048576).toLocaleString('ru-RU',{maximumFractionDigits:1});
  return mb(Math.min(info.total!,Math.max(0,info.transferred!)))+' / '+mb(info.total!)+' МБ';
}
