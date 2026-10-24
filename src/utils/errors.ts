export function launchErrorMessage(error: unknown): string {
  let message = typeof error === 'string' ? error
    : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : '';
  for (let index = 0; index < 4; index++) {
    const cleaned = message.replace(/^Error:\s*/, '').replace(/^Error invoking remote method ['"]launch-game['"]:\s*/, '');
    if (cleaned === message) break;
    message = cleaned;
  }
  return message.trim() || 'Не удалось запустить игру. Повторите запуск.';
}

export type LaunchRecoveryTarget = 'game' | 'java' | 'pack' | 'launcher';
export interface LaunchFailure {
  kind: string;
  title: string;
  description: string;
  action: 'retry' | 'accounts' | 'settings' | 'reload' | 'server';
  actionLabel: string;
  tab?: LaunchRecoveryTarget;
  technical: string;
}
/** Keep provider diagnostics available, without exposing common credential formats. */
export function launchDiagnostics(error: unknown): string {
  return launchErrorMessage(error)
    .replace(/(Bearer\s+)[A-Za-z0-9._~-]+/gi,'$1[скрыто]')
    .replace(/((?:--)?(?:access[_-]?token|refresh[_-]?token|communityToken|clientToken|password|authorization)["']?\s*[:= ]\s*["']?)[^\s"',}]+/gi,'$1[скрыто]')
    .slice(0,8000);
}
export function launchFailure(error: unknown): LaunchFailure {
  const technical=launchDiagnostics(error);
  const make=(kind:string,title:string,description:string,action:LaunchFailure['action']='retry',actionLabel='Повторить запуск',tab?:LaunchRecoveryTarget):LaunchFailure=>
    ({kind,title,description,action,actionLabel,tab,technical});
  if(/ENOSPC|disk.{0,10}full|no space|недостаточно места|не хватает места/i.test(technical))
    return make('disk','Не хватает места на диске','Освободите место на диске с игрой. Уже скачанные файлы останутся; затем повторите запуск.','settings','Открыть папку игры','java');
  if(/OutOfMemoryError|Could not reserve enough space|Could not create the Java Virtual Machine|объём памяти|выделенн.{0,15}памят|уменьшите.{0,15}памят|Недостаточно.{0,12}памят/i.test(technical))
    return make('memory','Не удалось выделить память','Закройте лишние приложения или уменьшите объём памяти для Minecraft в настройках.','settings','Настроить память','game');
  if(/401|сессия.{0,25}(отозвана|истекла|не подтверждена)|повторите вход|войдите.{0,35}заново|нужен вход Microsoft|нужна лицензия|лицензия.{0,30}не найден|Xbox.{0,60}(семейн|ограничени)|вход в нужный аккаунт|активный аккаунт не найден|Аккаунт (удалён|изменился)|Файл аккаунтов повреждён|Не удалось прочитать аккаунты/i.test(technical))
    return make('account','Нужно проверить аккаунт','Откройте аккаунт и войдите заново в нужный профиль. Существующие миры и файлы игры сохранятся.','accounts','Открыть аккаунт');
  if(/429|rate.?limit|слишком много запросов/i.test(technical))
    return make('rate-limit','Сервис просит подождать','Слишком много запросов. Подождите немного и повторите запуск.');
  if(/ENOTFOUND|EAI_AGAIN|ECONN|ERR_NETWORK|fetch failed|offline|нет сети|проверьте (интернет|подключение)|без подключения/i.test(technical))
    return make('network','Не удалось подключиться','Проверьте интернет и повторите запуск. Удалять сборку и скачанные файлы не нужно.');
  if(/timeout|timed out|ETIMEDOUT|не ответил вовремя|истекло время|время.{0,20}(ожидания|истекло)/i.test(technical))
    return make('timeout','Сервис не ответил вовремя','Соединение заняло слишком много времени. Проверьте интернет и попробуйте ещё раз.');
  if(/HTTP 5\d\d|сервис.{0,35}(недоступен|временно)|Bad Gateway|Service Unavailable/i.test(technical))
    return make('service','Сервис временно недоступен','Текущие файлы и аккаунт сохранены. Попробуйте запустить игру чуть позже.');
  if(/SEFI Auth.*(отсутствует|не найден)|отсутствует SEFI Auth|В установке лаунчера отсутствует/i.test(technical))
    return make('launcher','Нужны файлы лаунчера','В установке не хватает обязательного компонента. Установите полную актуальную версию лаунчера.','settings','Обновления лаунчера','launcher');
  if(/EACCES|EPERM|access.{0,8}denied|permission|Windows запретила|нет (прав|доступа)|доступ к папке|закройте Minecraft|файл.{0,15}занят|заблокирован/i.test(technical))
    return make('permission','Нет доступа к файлам игры','Закройте другие копии Minecraft и проверьте доступ к папке игры. При необходимости выберите другую папку.','settings','Проверить папку игры','java');
  if(/Java.{0,60}(не найден|не прошла|нужна|21|архитектур|64-бит|не подходит)|запустить Java|подготовить Java|выберите.{0,20}Java|исполняемому файлу Java/i.test(technical))
    return make('java','Нужно проверить Java','Для сборки нужна 64-битная Java 21. В настройках можно выбрать автоматическую Java SEFI.','settings','Открыть Java и файлы','java');
  if(/диск недоступен|папк.{0,35}(не существует|недоступ|доступ)|полный путь|Недопустимый путь|символическ/i.test(technical))
    return make('directory','Папка игры недоступна','Проверьте подключение диска и выберите доступную папку игры в настройках.','settings','Выбрать папку игры','java');
  if(/контрольн.{0,15}сумм|checksum|sha256|sha512|проверка.{0,25}(не пройдена|файла)|повреждён|манифест|каталог.{0,15}(сборки|загрузок)|дублирующ|некорректн.{0,15}(архив|структур)|недопустимый.{0,15}(мод|идентификатор)|проверенным каталогом/i.test(technical))
    return make('integrity','Не удалось проверить файлы','Повторите запуск — лаунчер проверит компоненты. Если ошибка повторится, скопируйте подробности для поддержки.');
  if(/HTTP 40[34]|файл.{0,25}(недоступен|отсутствует)|не удалось (скачать|загрузить|установить файл)|загрузка.{0,20}прерва/i.test(technical))
    return make('download','Не удалось скачать компонент','Источник загрузки отклонил запрос или файл временно недоступен. Повторите запуск чуть позже.');
  if(/выбранный адрес сервера|адрес сервера.{0,25}недоступен/i.test(technical))
    return make('server','Нужно выбрать адрес сервера','Выберите другой адрес в блоке Sweet Home или отключите «Подключаться сразу».','server','Выбрать сервер');
  if(/завершился с ошибкой|Процесс Minecraft не смог стартовать|exit code|Exception|краш/i.test(technical))
    return make('crash','Minecraft не запустился','Повторите запуск. Если сбой повторится, отправьте подробности в поддержку — там сохранён код завершения и последние сообщения игры.');
  return make('unknown','Не удалось запустить игру','Попробуйте ещё раз. Если ошибка повторится, скопируйте подробности и передайте их в поддержку.');
}
