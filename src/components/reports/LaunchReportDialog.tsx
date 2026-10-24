import {useEffect,useRef,useState} from 'react';
import {X,FileText,CheckCircle2,LoaderCircle} from 'lucide-react';
import type {LaunchReportDraft,LaunchReportPreview,LaunchReportResult,ReportAttachmentId} from '../../types';
import './LaunchReportDialog.css';

function reportMessage(error:any){return String(error?.message||'Не удалось выполнить действие. Повторите попытку.').replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '').slice(0,600);}

export function LaunchReportDialog({request,onOpenAccounts}:{request:{sequence:number;message:string}|null;onOpenAccounts:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [open,setOpen]=useState(false),[draft,setDraft]=useState<LaunchReportDraft|null>(null);
 const [attachments,setAttachments]=useState<ReportAttachmentId[]>([]),[comment,setComment]=useState(''),[discord,setDiscord]=useState(true);
 const [preview,setPreview]=useState<LaunchReportPreview|null>(null),[busy,setBusy]=useState<'prepare'|'preview'|'send'|'export'|null>(null);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[result,setResult]=useState<LaunchReportResult|null>(null);
 const working=busy==='send'||busy==='export';
 useEffect(()=>{
  if(!request)return;let alive=true;
  setOpen(true);setDraft(null);setPreview(null);setResult(null);setError('');setNotice('');setComment('');setDiscord(true);setBusy('prepare');
  Promise.resolve().then(()=>window.electronAPI.prepareLaunchReport(request.message)).then(value=>{
   if(!alive)return;setDraft(value);setAttachments(value.attachments.filter(a=>a.available&&(a.id==='build'||a.id==='launch')).map(a=>a.id));
  }).catch(e=>{if(alive)setError(reportMessage(e));}).finally(()=>{if(alive)setBusy(null);});
  return()=>{alive=false;};
 },[request]);
 useEffect(()=>{
  const node=dialog.current;if(!node)return;
  if(open&&!node.open)node.showModal();else if(!open&&node.open)node.close();
 },[open]);
 useEffect(()=>{
  if(!draft||result||!open)return;let alive=true;setPreview(null);setBusy('preview');
  const timer=setTimeout(()=>{window.electronAPI.previewLaunchReport(draft.id,{attachments,comment,discord}).then(value=>{if(alive){setPreview(value);setError('');}}).catch(e=>{if(alive)setError(reportMessage(e));}).finally(()=>{if(alive)setBusy(null);});},180);
  return()=>{alive=false;clearTimeout(timer);};
 },[draft,attachments,comment,discord,open,result]);
 function close(){if(!working)setOpen(false);}
 async function send(){
  if(!draft||!preview||preview.canSend===false||working||!draft.author)return;
  setBusy('send');setError('');setNotice('');
  try{setResult(await window.electronAPI.sendLaunchReport(draft.id,preview.token));}
  catch(e:any){setError(reportMessage(e));}
  finally{setBusy(null);}
 }
 async function save(){
  if(!draft||!preview||working)return;setBusy('export');setError('');setNotice('');
  try{const value=await window.electronAPI.exportLaunchReport(draft.id,preview.token);if(!value.cancelled)setNotice('Копия сохранена на компьютере.');}
  catch(e:any){setError('Не удалось сохранить копию. Выберите другую папку и попробуйте ещё раз.');}
  finally{setBusy(null);}
 }
 return <dialog ref={dialog} className="launch-report-dialog" aria-labelledby="launch-report-title" aria-describedby="launch-report-intro" onCancel={e=>{e.preventDefault();close();}}>
  <header className="report-header"><div><h2 id="launch-report-title">Отчёт о проблеме</h2><p id="launch-report-intro">Выберите, что приложить, и проверьте данные перед отправкой.</p></div><button className="report-close" type="button" aria-label="Закрыть отчёт" disabled={working} onClick={close}><X size={16} strokeWidth={1.5}/></button></header>
  {result?<div className="report-success" role="status"><CheckCircle2 size={24} strokeWidth={1.5}/><h3>Отчёт сохранён на сайте</h3><p>{result.ticketId?'Создан тикет поддержки #'+result.ticketId+'.':'Спасибо, команда SEFI сможет посмотреть подробности.'}</p>{result.warning&&<p className="report-warning">{result.warning}</p>}<p className="report-receipt">Номер отчёта: {result.id}</p></div>:
  <div className="report-body">
   <div className="report-compose">
    <label className="report-comment-label" htmlFor="report-comment">Что произошло? <span>{draft?.hasFailure||attachments.some(key=>key==='game'||key==='crash')?'Необязательно':'От 10 символов'}</span></label>
    <textarea id="report-comment" maxLength={2000} rows={3} disabled={!draft||working} value={comment} onChange={e=>{setPreview(null);setComment(e.target.value);}} placeholder="Например: игра закрылась после входа на сервер"/>
    <fieldset className="report-attachments" disabled={!draft||working}><legend>Приложения</legend>
     {draft?.attachments.map(item=><label key={item.id}><input type="checkbox" checked={attachments.includes(item.id)} disabled={!item.available} onChange={e=>{setPreview(null);setAttachments(current=>e.target.checked?[...current,item.id]:current.filter(id=>id!==item.id));}}/><span><strong>{item.label}</strong><small>{item.detail}</small></span></label>)}
    </fieldset>
    <p className="report-privacy">Прикладываются только выбранные данные. Фильтруем строки чата, известные токены и личные пути скрываем. Перед отправкой проверьте предпросмотр.</p>
   </div>
   <div className="report-review"><div className="report-review-heading"><h3>Что отправится</h3><span>{preview?Math.max(1,Math.ceil(preview.bytes/1024))+' КБ':''}</span></div>
    <pre tabIndex={0} aria-label="Предпросмотр отправляемого отчёта">{preview?.text||(busy==='prepare'?'Собираем доступные данные…':busy==='preview'?'Обновляем предпросмотр…':'Данные пока не подготовлены.')}</pre>
    <label className="report-discord"><input type="checkbox" checked={discord} disabled={!draft||working} onChange={e=>{setPreview(null);setDiscord(e.target.checked);}}/><span>Создать тикет в Discord</span></label>
    <p className="report-author">{draft?.author?'От имени '+draft.author+'. Отчёт получит команда поддержки SEFI.':'Для отправки нужен вход в SEFI Community. Можно сохранить копию без входа.'}</p>
    {draft&&!draft.author&&<button type="button" className="text-action" disabled={working} onClick={()=>{close();onOpenAccounts();}}>Открыть аккаунт</button>}
   </div>
  </div>}
  {error&&<p className="report-error" role="alert">{error}</p>}
  <footer className="report-footer"><p role="status" className={notice?'report-notice':undefined}>{notice|| (result?'Отчёт доступен команде поддержки SEFI.':'Ничего не отправляется автоматически.')}</p><div>{result?<button type="button" className="s-button primary" onClick={close}>Готово</button>:<><button type="button" className="s-button" disabled={!preview||working} onClick={()=>void save()}><FileText size={14}/>{busy==='export'?'Сохраняем…':'Сохранить копию'}</button><button type="button" className="s-button primary" disabled={!preview||preview.canSend===false||!draft?.author||working} onClick={()=>void send()}>{busy==='send'&&<LoaderCircle size={14} className="animate-spin"/>}{busy==='send'?'Отправляем…':'Отправить на сайт'}</button></>}</div></footer>
 </dialog>;
}
