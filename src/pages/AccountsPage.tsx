import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CircleUserRound, Plus, Trash2, Check, ShieldCheck, Box, Sparkles, UserCheck, AlertCircle, X } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { useStore } from '../store/store';
import { Account } from '../types';

interface ConfirmModalState {
  accountId: string;
  accountName: string;
}

export const AccountsPage: React.FC = () => {
  const { accounts, activeAccount, setAccounts, setActiveAccount } = useStore();
  const [offlineName, setOfflineName] = useState('');
  const [isLoggingInMs, setIsLoggingInMs] = useState(false);
  const [isLoggingInCommunity, setIsLoggingInCommunity] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);

  // If a licensed account exists with Twitch linked, or with matching UUID, hide redundant offline profile
  const displayedAccounts = accounts.filter((acc) => {
    if (acc.type === 'offline' && acc.communityToken) {
      const hasLicensed = accounts.some(
        (other) => other.type === 'microsoft' && (other.twitchLogin === acc.twitchLogin || other.uuid === acc.uuid)
      );
      if (hasLicensed) return false;
    }
    return true;
  });

  const handleMicrosoftLogin = async () => {
    setIsLoggingInMs(true);
    setErrorMsg('');
    try {
      if (window.electronAPI?.loginMicrosoft) {
        const newAcc = await window.electronAPI.loginMicrosoft();
        const updated = await window.electronAPI.getAccounts();
        setAccounts(updated);
        setActiveAccount(newAcc);
      }
    } catch (err: any) {
      let raw = err?.message || String(err);
      if (raw.includes('Error invoking remote method') || raw.includes('login-microsoft')) {
        raw = raw.replace(/^Error:\s*Error invoking remote method 'login-microsoft':\s*/, '').replace(/^Error:\s*/, '');
      }

      if (raw.includes('404') || raw.includes('error.auth.minecraft.profile')) {
        setErrorMsg('Лицензия Minecraft не найдена на этом аккаунте Microsoft (404 Not Found). Убедитесь, что вошли под верной почтой, где куплена игра, либо используйте SEFI Community с игровым паролем.');
      } else if (raw.includes('User closed the window') || raw.includes('closed') || raw.includes('canceled')) {
        setErrorMsg('Вход отменён: окно авторизации Microsoft было закрыто.');
      } else {
        setErrorMsg('Ошибка входа Microsoft: ' + raw);
      }
    } finally {
      setIsLoggingInMs(false);
    }
  };

  const handleLinkMinecraft = async (id: string) => {
    if (!window.electronAPI?.linkMinecraftAccount) {
      setErrorMsg('Привязка доступна в обновлённом приложении SEFI Launcher.');
      return;
    }
    setLinkingId(id);
    setErrorMsg('');
    setSuccessMsg('');
    setConfirmModal(null);
    try {
      const linked = await window.electronAPI.linkMinecraftAccount(id);
      if (linked) {
        setSuccessMsg(`Minecraft ${linked.username} успешно привязан к Twitch! Профиль активирован для игры.`);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Привязка не завершена.');
    } finally {
      const updated = await window.electronAPI.getAccounts();
      setAccounts(updated);
      setActiveAccount(updated.find(a => a.active) || null);
      setLinkingId(null);
    }
  };

  const handleSelect = async (account: Account) => {
    try {
      if (window.electronAPI?.setActiveAccount) {
        await window.electronAPI.setActiveAccount(account.id);
        const updated = await window.electronAPI.getAccounts();
        setAccounts(updated);
      }
      setActiveAccount(account);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (window.electronAPI?.removeAccount) {
        await window.electronAPI.removeAccount(id);
        const updated = await window.electronAPI.getAccounts();
        setAccounts(updated);
        if (activeAccount?.id === id) {
          setActiveAccount(updated[0] || null);
        }
      } else {
        const updated = accounts.filter((a) => a.id !== id);
        setAccounts(updated);
        if (activeAccount?.id === id) {
          setActiveAccount(updated[0] || null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Identify the accounts:
  // 1. Community (Twitch) side
  const commAccount = accounts.find((a) => a.communityToken || a.twitchLogin);
  // 2. Microsoft / Mojang side
  const msAccount = accounts.find((a) => a.type === 'microsoft');
  // Check if they are unified / linked together
  const isLinked = Boolean(
    msAccount && (
      msAccount.twitchLogin ||
      msAccount.communityToken ||
      (commAccount?.mcUuid && msAccount.uuid.replace(/-/g, '').toLowerCase() === commAccount.mcUuid.replace(/-/g, '').toLowerCase())
    )
  );

  const isLicenseBoundOnBackend = commAccount?.mcType === 'microsoft';

  return (
    <motion.div
      key="accounts"
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      className="h-full overflow-y-auto px-8 pb-10 pt-6 select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span>Профиль игрока</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full border border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-300 font-medium">
              Minecraft 1.20.1
            </span>
          </h1>
          <p className="mt-1 text-sm text-white/45">
            Связь аккаунта сообщества Twitch и игрового клиента Minecraft
          </p>
        </div>
      </div>

      {successMsg && (
        <div role="status" className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3.5 text-xs text-emerald-200">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 p-3.5 text-xs text-red-200 flex items-center gap-2 shadow-lg backdrop-blur-sm">
          <span className="size-2 rounded-full bg-red-400 animate-ping" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Two-Card Tandem with Chain in the Middle */}
      <div className="mt-8 relative grid grid-cols-[1fr,auto,1fr] items-center gap-4">
        {/* Left Card: Twitch / SEFI Community */}
        <div className={`relative rounded-2xl border p-6 backdrop-blur-md transition-all duration-300 flex flex-col justify-between min-h-[260px] ${
          commAccount
            ? 'border-purple-500/40 bg-[#160c24]/90 shadow-[0_4px_30px_rgba(168,85,247,0.12)]'
            : 'border-white/[0.08] bg-[#0e111a]/70 hover:border-purple-500/30'
        }`}>
          <div>
            <div className="flex items-center justify-between">
              <div className="flex size-11 items-center justify-center rounded-xl bg-purple-500/15 border border-purple-400/25 text-purple-300">
                <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
                </svg>
              </div>
              <span className="rounded-full border border-purple-400/30 bg-purple-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-purple-300">
                Twitch Community
              </span>
            </div>

            {commAccount ? (
              <div className="mt-5">
                <div className="flex items-center gap-3">
                  <img
                    src={commAccount.twitchAvatar || `https://mc-heads.net/avatar/${commAccount.username}/48`}
                    alt={commAccount.twitchLogin || 'Twitch'}
                    className="size-12 rounded-xl object-cover border border-purple-400/40 bg-purple-950/40 shadow-md"
                  />
                  <div>
                    <div className="text-base font-bold text-white tracking-tight">
                      @{commAccount.twitchLogin || commAccount.username}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-white/40">
                      ID: #{commAccount.id.replace('comm_', '').slice(0, 10)}…
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                    commAccount.whitelistStatus === 'approved'
                      ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                      : commAccount.whitelistStatus === 'rejected'
                      ? 'border-rose-500/30 bg-rose-500/15 text-rose-300'
                      : 'border-amber-500/30 bg-amber-500/15 text-amber-300'
                  }`}>
                    <span className={`size-1.5 rounded-full ${
                      commAccount.whitelistStatus === 'approved'
                        ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                        : commAccount.whitelistStatus === 'rejected'
                        ? 'bg-rose-400 shadow-[0_0_6px_#f43f5e]'
                        : 'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
                    }`} />
                    <span>
                      {commAccount.whitelistStatus === 'approved'
                        ? 'Доступ открыт'
                        : commAccount.whitelistStatus === 'rejected'
                        ? 'Доступ отклонён'
                        : 'Ожидает одобрения'}
                    </span>
                  </span>

                  {isLicenseBoundOnBackend && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/15 px-2.5 py-0.5 text-[11px] font-medium text-blue-300">
                      <Box size={12} />
                      Лицензия привязана
                    </span>
                  )}
                </div>

              </div>
            ) : (
              <div className="mt-5">
                <h3 className="text-base font-semibold text-white tracking-tight">Вход не выполнен</h3>
                <p className="mt-1.5 text-xs leading-5 text-white/45">
                  Войдите под своей учетной записью Twitch, чтобы получить игровой ник и доступ на сервер.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6">
            {commAccount ? (
              <button
                onClick={(e) => handleRemove(commAccount.id, e)}
                className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-xs font-medium text-white/50 hover:bg-red-500/15 hover:text-red-300 hover:border-red-500/30 transition cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Сменить Twitch-аккаунт</span>
              </button>
            ) : (
              <button
                disabled={isLoggingInCommunity || linkingId !== null}
                onClick={async () => {
                  setIsLoggingInCommunity(true);
                  setErrorMsg('');
                  try {
                    if (window.electronAPI?.loginCommunity) {
                      const newAcc = await window.electronAPI.loginCommunity();
                      const updated = await window.electronAPI.getAccounts();
                      setAccounts(updated);
                      setActiveAccount(newAcc);
                    }
                  } catch (err: any) {
                    setErrorMsg(err.message || 'Ошибка входа SEFI Community');
                  } finally { setIsLoggingInCommunity(false); }
                }}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 text-xs font-semibold text-white transition hover:bg-purple-500 active:scale-[0.98] cursor-pointer shadow-lg shadow-purple-600/25"
              >
                <span>{isLoggingInCommunity ? 'Подтвердите в браузере…' : 'Войти через сайт'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Center: Interactive Chain / Connector */}
        <div className="flex flex-col items-center justify-center z-10 px-1">
          {isLinked ? (
            <div className="group relative flex flex-col items-center">
              <div className="flex size-12 items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-500/20 text-emerald-300 shadow-[0_0_25px_rgba(52,211,153,0.3)] backdrop-blur-md">
                <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </div>
              <span className="mt-2 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                Связано
              </span>
            </div>
          ) : commAccount && msAccount ? (
            <button
              onClick={() => handleLinkMinecraft(msAccount.id)}
              disabled={linkingId !== null}
              className="group relative flex flex-col items-center cursor-pointer active:scale-95 transition"
              title="Нажмите, чтобы связать аккаунты"
            >
              <div className="flex size-12 items-center justify-center rounded-2xl border border-fuchsia-400/40 bg-fuchsia-500/20 text-fuchsia-300 shadow-[0_0_20px_rgba(217,70,239,0.3)] animate-pulse hover:bg-fuchsia-500/30">
                <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </div>
              <span className="mt-2 text-[10px] font-bold uppercase tracking-wider text-fuchsia-300 bg-fuchsia-500/15 px-2 py-0.5 rounded-full border border-fuchsia-400/25">
                {linkingId ? 'Связка…' : 'Связать 🔗'}
              </span>
            </button>
          ) : (
            <div className="flex flex-col items-center opacity-30">
              <div className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/50">
                <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Right Card: Minecraft Java Game Profile */}
        <div className={`relative rounded-2xl border p-6 backdrop-blur-md transition-all duration-300 flex flex-col justify-between min-h-[260px] ${
          msAccount
            ? 'border-blue-500/40 bg-[#0c1424]/90 shadow-[0_4px_30px_rgba(59,130,246,0.12)]'
            : isLicenseBoundOnBackend
            ? 'border-amber-500/40 bg-[#1f170c]/90 shadow-[0_4px_30px_rgba(245,158,11,0.12)]'
            : commAccount
            ? 'border-white/[0.1] bg-[#12141c]/80'
            : 'border-white/[0.08] bg-[#0e111a]/70 hover:border-blue-400/30'
        }`}>
          <div>
            <div className="flex items-center justify-between">
              <div className="flex size-11 items-center justify-center rounded-xl bg-blue-500/15 border border-blue-400/25 text-blue-300">
                <Box size={22} />
              </div>
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                msAccount
                  ? 'border-blue-400/30 bg-blue-500/15 text-blue-300'
                  : isLicenseBoundOnBackend
                  ? 'border-amber-400/30 bg-amber-500/15 text-amber-300'
                  : 'border-white/10 bg-white/[0.05] text-white/50'
              }`}>
                {msAccount ? 'Minecraft Java Лицензия' : isLicenseBoundOnBackend ? 'Требуется вход Microsoft' : 'Игровой профиль'}
              </span>
            </div>


            {msAccount ? (
              <div className="mt-5">
                <div className="flex items-center gap-3">
                  <img
                    src={`https://mc-heads.net/avatar/${encodeURIComponent(msAccount.username)}/48`}
                    alt={msAccount.username}
                    className="size-12 rounded-xl object-cover border border-blue-400/40 bg-black/40 shadow-md"
                  />
                  <div>
                    <div className="text-base font-bold text-white tracking-tight">
                      {msAccount.username}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-white/40">
                      UUID: {msAccount.uuid.slice(0, 12)}…
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-400/30 bg-blue-500/15 px-2.5 py-0.5 text-[11px] font-medium text-blue-300">
                    <Check size={11} strokeWidth={3} />
                    Лицензия подтверждена
                  </span>
                </div>
              </div>
            ) : isLicenseBoundOnBackend && commAccount ? (
              <div className="mt-5">
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5 text-amber-300">
                    <AlertCircle size={14} />
                    <span>Привязана лицензия Mojang</span>
                  </div>
                  <p className="text-[11px] text-amber-200/80 leading-4">
                    Ваш аккаунт зарегистрирован под лицензией <strong className="text-white">{commAccount.username}</strong>. Войдите через Microsoft для игры.
                  </p>
                </div>
              </div>
            ) : commAccount ? (
              <div className="mt-5">
                <div className="flex items-center gap-3">
                  <img
                    src={`https://mc-heads.net/avatar/${encodeURIComponent(commAccount.username)}/48`}
                    alt={commAccount.username}
                    className="size-12 rounded-xl object-cover border border-white/15 bg-black/40 shadow-md"
                  />
                  <div>
                    <div className="text-base font-bold text-white tracking-tight">
                      {commAccount.username}
                    </div>
                    <div className="mt-0.5 text-xs text-white/50">
                      Стандартный доступ (серверный ник)
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-[11px] font-medium text-white/60">
                    Готов к игре
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-5">
                <h3 className="text-base font-semibold text-white tracking-tight">Minecraft не подключён</h3>
                <p className="mt-1.5 text-xs leading-5 text-white/45">
                  Войдите через Microsoft для игры с официальной лицензией Java.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6">
            {msAccount ? (
              <button
                onClick={(e) => handleRemove(msAccount.id, e)}
                className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-xs font-medium text-white/50 hover:bg-red-500/15 hover:text-red-300 hover:border-red-500/30 transition cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Выйти из Microsoft</span>
              </button>
            ) : (
              <button
                onClick={handleMicrosoftLogin}
                disabled={isLoggingInMs}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-lg"
              >
                {isLoggingInMs ? (
                  <>
                    <span className="size-3.5 rounded-full border-2 border-zinc-950 border-t-transparent animate-spin" />
                    <span>Ожидание браузера...</span>
                  </>
                ) : (
                  <>
                    <svg className="size-4" viewBox="0 0 21 21">
                      <path fill="#f25022" d="M1 1h9v9H1z"/>
                      <path fill="#00a4ef" d="M1 11h9v9H1z"/>
                      <path fill="#7fba00" d="M1 1h9v9h-9z"/>
                      <path fill="#ffb900" d="M1 11h9v9h-9z"/>
                    </svg>
                    <span>{isLicenseBoundOnBackend ? 'Войти в Microsoft для игры' : 'Войти через Microsoft'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
