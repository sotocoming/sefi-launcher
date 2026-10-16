import type { Account } from '../types';

export function serverAccessWarning(account: Account | null): string | null {
  if (!account) return null;
  if (!account.communityConnected || !account.twitchLogin) {
    return 'Вы не вошли в Twitch. Для доступа к серверу войдите через Twitch в разделе «Аккаунты». Minecraft можно запустить сейчас, но сервер не пустит без привязки Twitch.';
  }
  if (account.type === 'microsoft' && (!account.mcVerifiedAt || account.mcType !== 'microsoft'
      || account.mcUuid?.replace(/-/g, '').toLowerCase() !== account.uuid.replace(/-/g, '').toLowerCase())) {
    return 'Вы вошли в Microsoft, но ещё не связали аккаунт Minecraft с Twitch. Откройте «Аккаунты» и нажмите «Привязать к Twitch». Без этого Minecraft запустится, но зайти на сервер не получится.';
  }
  return null;
}
