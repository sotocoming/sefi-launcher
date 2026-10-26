import { AccountImage } from '../components/accounts/AccountImage';
import { SkinEditor } from '../components/accounts/SkinEditor';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Box, Link2, ExternalLink } from 'lucide-react';
import { useStore } from '../store/store';

export const AccountsPage: React.FC = () => {
  const { accounts, activeAccount, setAccounts, setActiveAccount } = useStore();
  const [isLoggingInMs, setIsLoggingInMs] = useState(false);
  const [isLoggingInCommunity, setIsLoggingInCommunity] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [discordBusy, setDiscordBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);

  const handleMicrosoftLogin = async () => {
    setIsLoggingInMs(true);
    setErrorMsg('');
    try {
      if (window.electronAPI?.loginMicrosoft) {
        const newAcc = await window.electronAPI.loginMicrosoft();
        const updated = await window.electronAPI.getAccounts();
        setAccounts(updated);
        setActiveAccount(newAcc);
        if (newAcc.communityLinkError) setErrorMsg(newAcc.communityLinkError);
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
    try {
      const linked = await window.electronAPI.linkMinecraftAccount(id);
      if (linked) {
        setSuccessMsg(`Minecraft ${linked.username} успешно привязан к Twitch! Профиль активирован для игры.`);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Привязка не завершена.');
    } finally {
      try {
        const updated = await window.electronAPI.getAccounts();
        setAccounts(updated);
        setActiveAccount(updated.find(a => a.active) || null);
      } catch (err: any) {
        setErrorMsg(previous => [previous, err?.message || 'Не удалось обновить аккаунты. Повторите попытку.'].filter(Boolean).join(' '));
      } finally {
        setLinkingId(null);
      }
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
  const commAccount = accounts.find((a) => a.communityConnected || a.twitchLogin);
  // 2. Microsoft / Mojang side
  const msAccount = accounts.find((a) => a.type === 'microsoft');
  const communityId = commAccount?.id;
  useEffect(()=>{
    if(!communityId)return;
    let alive=true,working=false,last=-Infinity;
    const refresh=async()=>{
      if(working||Date.now()-last<10000)return;working=true;last=Date.now();
      try{
        const account=await window.electronAPI.refreshCommunityProfile(communityId);
        if(!alive||!account||typeof account.id!=='string')return;
        const fresh=await window.electronAPI.getAccounts();
        if(alive){setAccounts(fresh);setActiveAccount(fresh.find(a=>a.active)||null);}
      }catch{/* Cached profile remains usable when SEFI is offline. */}
      finally{working=false;}
    };
    void refresh();window.addEventListener('focus',refresh);
    return()=>{alive=false;window.removeEventListener('focus',refresh);};
  },[communityId,setAccounts,setActiveAccount]);
  const openProfile=async()=>{setProfileBusy(true);setErrorMsg('');try{await window.electronAPI.openCommunityProfile();}catch{setErrorMsg('Не удалось открыть личный кабинет. Проверьте браузер по умолчанию и повторите попытку.');}finally{setProfileBusy(false);}};
  const linkDiscord=async()=>{
    if(!commAccount||discordBusy)return;setDiscordBusy(true);setErrorMsg('');setSuccessMsg('');
    try{
      await window.electronAPI.linkDiscordAccount(commAccount.id);
      const fresh=await window.electronAPI.getAccounts();setAccounts(fresh);setActiveAccount(fresh.find(a=>a.active)||null);
    }catch(err:any){setErrorMsg((err.message||'Не удалось привязать Discord. Повторите попытку.').replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''));}
    finally{setDiscordBusy(false);}
  };
  // Check if they are unified / linked together
  const isLicenseBoundOnBackend = Boolean(commAccount?.mcVerifiedAt && commAccount.mcType === 'microsoft' && commAccount.mcUuid);
  const isLinked = Boolean(
    msAccount && isLicenseBoundOnBackend
      && msAccount.uuid.replace(/-/g, '').toLowerCase() === commAccount!.mcUuid!.replace(/-/g, '').toLowerCase()
  );

  const selectAccount=async(id:string)=>{try{await window.electronAPI.setActiveAccount(id);const fresh=await window.electronAPI.getAccounts();setAccounts(fresh);setActiveAccount(fresh.find(a=>a.active)||null);}catch(err:any){setErrorMsg(err.message||'Не удалось выбрать профиль.');}};
  const handleCommunityLogin=async()=>{setIsLoggingInCommunity(true);setErrorMsg('');try{const account=await window.electronAPI.loginCommunity();setAccounts(await window.electronAPI.getAccounts());setActiveAccount(account);if(account.communityLinkError)setErrorMsg(account.communityLinkError);}catch(err:any){setErrorMsg((err.message||'Ошибка входа SEFI Community').replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''));}finally{setIsLoggingInCommunity(false);}};
  return <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="workspace-page accounts-page">
   <header className="page-head"><div><h1>Твой профиль</h1><p>Аккаунт сообщества, Minecraft и свой стиль в игре</p></div><button className="s-button account-cabinet" disabled={profileBusy} onClick={()=>void openProfile()}><ExternalLink size={14}/>{profileBusy?'Открываем…':'Личный кабинет'}</button></header>
   {linkingId&&<p role="status" className="feedback">Подтвердите привязку в открывшемся окне и вернитесь в лаунчер.</p>}{successMsg&&<p role="status" className="feedback success">{successMsg}</p>}{errorMsg&&<p role="alert" className="feedback error">{errorMsg}</p>}
   <div className="account-workspace"><section className="identity-panel"><div className="community-identity"><span className="eyebrow">SEFI COMMUNITY</span>
    {commAccount?<><div className="identity-name"><AccountImage src={commAccount.twitchAvatar||''} alt={commAccount.twitchLogin||commAccount.username}/><div><h2>{commAccount.username}</h2><p>@{commAccount.twitchLogin||commAccount.username}</p></div></div><span className={"access-label"+(!commAccount.communityConnected?" needs-login":"")}>{!commAccount.communityConnected?'Требуется вход':commAccount.whitelistStatus==='approved'?'Доступ открыт':commAccount.whitelistStatus==='rejected'?'Доступ отклонён':'Ожидает одобрения'}</span></>:<><h2>Твой мир начинается здесь</h2><p>Войди через Twitch, чтобы получить игровой профиль и доступ к сообществу Sweet Home.</p></>}
    <div className="identity-actions">{commAccount?<><button className="s-button" onClick={()=>void(commAccount.communityConnected?selectAccount(commAccount.id):handleCommunityLogin())} disabled={isLoggingInCommunity||(commAccount.communityConnected&&activeAccount?.id===commAccount.id)}>{isLoggingInCommunity?'Подтвердите в браузере…':!commAccount.communityConnected?'Войти снова':activeAccount?.id===commAccount.id?'Профиль выбран':'Выбрать профиль'}</button>{isLoggingInCommunity?<button className="text-action" onClick={()=>void window.electronAPI.cancelCommunityLogin().catch(()=>setErrorMsg('Не удалось отменить вход. Закройте окно браузера и повторите позже.'))}>Отменить вход</button>:<button className="text-action" onClick={e=>handleRemove(commAccount.id,e)}>Сменить Twitch-аккаунт</button>}</>:<><button className="s-button primary" disabled={isLoggingInCommunity||linkingId!==null} onClick={handleCommunityLogin}>{isLoggingInCommunity?'Подтвердите в браузере…':'Войти через сайт'}</button>{isLoggingInCommunity&&<button className="text-action" onClick={()=>void window.electronAPI.cancelCommunityLogin().catch(()=>setErrorMsg('Не удалось отменить вход. Повторите попытку.'))}>Отменить вход</button>}</>}</div>
   </div>{commAccount&&<div className="account-discord"><div><h3>Discord</h3><p className={commAccount.discordConnected?'connected':''} role="status">{discordBusy?'Подтвердите привязку в окне Discord':commAccount.discordConnected?(commAccount.discordUsername||'Аккаунт привязан'):'Не привязан · по желанию'}</p></div>{discordBusy?<button className="text-action" onClick={()=>void window.electronAPI.cancelDiscordLink().catch(()=>setErrorMsg('Закройте окно Discord, чтобы отменить привязку.'))}>Отменить</button>:commAccount.discordConnected?<span className="discord-connected">Привязан</span>:<button className="s-button" aria-label="Привязать Discord" disabled={isLoggingInMs||isLoggingInCommunity||linkingId!==null} onClick={()=>void linkDiscord()}>Привязать</button>}</div>}<div className="minecraft-identity"><div className="identity-title"><Box size={20}/><div><h3>Minecraft Java</h3><p>{msAccount?'Лицензия Minecraft':isLicenseBoundOnBackend?'Нужен вход Microsoft':'Лицензия — по желанию'}</p></div></div>
    {msAccount?<><div className="identity-name compact"><AccountImage src={'https://mc-heads.net/avatar/'+encodeURIComponent(msAccount.username)+'/48'} alt={msAccount.username}/><div><strong>{msAccount.username}</strong><p>{isLinked?'Связан с Twitch':'Профиль Microsoft'}</p></div></div><div className="identity-actions"><button className="s-button" onClick={()=>void selectAccount(msAccount.id)} disabled={activeAccount?.id===msAccount.id}>{activeAccount?.id===msAccount.id?'Профиль выбран':'Выбрать профиль'}</button><button className="text-action" onClick={e=>handleRemove(msAccount.id,e)}><Trash2 size={13}/> Выйти</button></div></>:<><p>Войди в Microsoft, если играешь с лицензией. Для профиля сообщества используй вход через сайт.</p><button className="s-button" disabled={isLoggingInMs||linkingId!==null} onClick={handleMicrosoftLogin}>{isLoggingInMs?'Вход в Microsoft…':'Войти через Microsoft'}</button></>}
   </div><footer className="identity-footer">{isLinked?<span className="success">Minecraft и Twitch связаны</span>:commAccount&&msAccount?<button className="s-button" disabled={linkingId!==null} onClick={()=>handleLinkMinecraft(msAccount.id)}><Link2 size={14}/>{linkingId?'Привязываем…':'Привязать Minecraft к Twitch'}</button>:<span>Профиль сообщества и лицензия хранятся в одном месте</span>}</footer></section><SkinEditor key={activeAccount?.id||'empty'} account={activeAccount}/></div>
  </motion.div>;
};
