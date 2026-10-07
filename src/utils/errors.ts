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
