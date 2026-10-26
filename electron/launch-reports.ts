import {app,dialog,BrowserWindow} from 'electron';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {randomUUID,createHash} from 'crypto';
import {getAccounts} from './minecraft/accounts';
import {getSettings} from './config';
import {communityRequest,CommunitySessionError} from './minecraft/community-request';
import {launchDiagnostics} from './minecraft/launch-diagnostics';
import {redactReportText,reportLines} from './report-redaction';
import type {ReportAttachmentId,LaunchReportDraft,LaunchReportPreview,LaunchReportResult} from '../src/types';

type Source={label:string;detail:string;data:unknown;available:boolean};
type Draft={created:number;actorId?:string;title:string;summary:string;sources:Record<ReportAttachmentId,Source>;requests:Map<string,string>;hasFailure:boolean;meaningful?:boolean;payload?:any;preview?:string;submitted?:string;busy?:boolean;result?:LaunchReportResult;secrets:string[];paths:string[]};
const drafts=new Map<string,Draft>();
const ticketChoices=new Map<string,Set<number>>();
export async function getReportTickets(id:unknown):Promise<import('../src/types').ReportTicket[]>{
 const d=get(id),actor=(await getAccounts()).find(a=>a.id===d.actorId);
 if(!actor?.communityToken)throw new Error('Войдите в SEFI Community, чтобы увидеть свои заявки.');
 const value=await communityRequest('/api/public/community/client-report/tickets',actor.communityToken);
 if(!Array.isArray(value?.tickets)||value.tickets.length>30)throw new Error('Некорректный список заявок.');
 const tickets=value.tickets.map((t:any)=>{if(!Number.isSafeInteger(t.id)||t.id<=0||typeof t.title!=='string'||t.title.length>80||typeof t.status!=='string'||typeof t.status_label!=='string')throw new Error('Некорректная заявка.');return {id:t.id,title:t.title,status:t.status,statusLabel:t.status_label.slice(0,100)};});
 if(ticketChoices.size>=5)ticketChoices.delete(ticketChoices.keys().next().value!);
 ticketChoices.set(String(id),new Set(tickets.map((t:any)=>t.id)));return tickets;
}
function get(id:unknown):Draft{
 if(typeof id!=='string')throw new Error('Некорректный отчёт.');
 const draft=drafts.get(id);if(!draft||Date.now()-draft.created>15*60*1000)throw new Error('Данные отчёта устарели. Закройте окно и соберите отчёт заново.');
 return draft;
}
function compactError(e:unknown){return e instanceof Error?e.message:'Не удалось подготовить отчёт.';}
async function readBounded(root:string,relative:string,since:number,tail=true):Promise<{text:string;truncated:boolean;modified:number}|null>{
 try{
  const base=await fs.realpath(root),file=path.join(base,relative),stat=await fs.lstat(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.mtimeMs<since)return null;
  const real=await fs.realpath(file);if(!real.startsWith(base+path.sep))return null;
  const h=await fs.open(real,'r');try{
   const size=(await h.stat()).size,len=Math.min(size,64*1024),buffer=Buffer.alloc(len);
   const {bytesRead}=await h.read(buffer,0,len,tail?Math.max(0,size-len):0);
   return {text:buffer.subarray(0,bytesRead).toString('utf8'),truncated:size>len,modified:stat.mtimeMs};
  }finally{await h.close();}
 }catch{return null;}
}
async function latestCrash(root:string,since:number):Promise<{name:string;text:string;truncated:boolean;modified:number}|null>{
 try{
  const base=await fs.realpath(root),folder=path.join(base,'crash-reports'),real=await fs.realpath(folder);
  if(!real.startsWith(base+path.sep))return null;
  const entries=(await fs.readdir(real,{withFileTypes:true})).filter(item=>item.isFile()&&!item.isSymbolicLink()&&/^crash-[\w.-]+\.txt$/.test(item.name)).sort((a,b)=>b.name.localeCompare(a.name));let latest:{name:string;mtime:number}|undefined;
  for(const item of entries.slice(0,500)){
   if(!item.isFile()||item.isSymbolicLink()||!/^crash-[\w.-]+\.txt$/.test(item.name))continue;
   const stat=await fs.lstat(path.join(real,item.name));if(stat.mtimeMs>=since&&(!latest||stat.mtimeMs>latest.mtime))latest={name:item.name,mtime:stat.mtimeMs};
  }
  if(!latest)return null;const content=await readBounded(base,path.join('crash-reports',latest.name),since,false);
  return content?{name:latest.name,...content}:null;
 }catch{return null;}
}
export async function prepareLaunchReport(message:unknown=''):Promise<LaunchReportDraft>{
 if(typeof message!=='string'||message.length>16000)throw new Error('Некорректные подробности ошибки.');
 const attempt=launchDiagnostics(),accounts=await getAccounts().catch(()=>[]);
 const savedSettings=!attempt?await getSettings().catch(()=>null):null;
 const directory=attempt?.directory||savedSettings?.gameDirectory;
 const since=attempt?.started||Date.now()-24*60*60*1000;
 const memory=attempt?.ramMax||savedSettings?.ramMax;
 const actor=accounts.find(a=>a.active&&a.communityToken)||accounts.find(a=>a.communityToken);
 const secrets=[...(attempt?.credentials||[]),...accounts.flatMap(a=>[a.accessToken,a.clientToken,a.communityToken,a.msRefreshToken]).filter((s):s is string=>typeof s==='string')];
 const paths=[app.getPath('home'),app.getPath('userData'),directory||''];
 const clean=(s:string)=>redactReportText(s,secrets,paths),summary=clean(attempt?.error||message||'Проблема при запуске или работе Minecraft.').slice(0,1200);
 const startup=reportLines(clean([summary,...(attempt?.launch||[])].join('\n')));
 let logModified:number|undefined;
 let errors=reportLines(clean((attempt?.game||[]).join('\n'))),crash:null|{name:string;text:string;truncated:boolean;modified:number}=null;
 if(directory){
  const log=await readBounded(directory,path.join('logs','latest.log'),since);
  logModified=log?.modified;
  if(log)errors=[...new Set([...errors,...reportLines(clean(log.text)).filter(line=>/\b(?:ERROR|WARN|FATAL|Exception|Caused by:)|^\s+at\s/.test(line))])].slice(-150);
  crash=await latestCrash(directory,since);
 }
 const sources:Record<ReportAttachmentId,Source>={
  build:{label:'Версии и система',detail:'Лаунчер, ОС, разрядность и выделенная память.',available:true,data:{source:'launcher',launcher_version:app.getVersion(),os:os.platform()+' '+os.release(),arch:os.arch(),...(Number.isSafeInteger(memory)?{memory_mb:memory}:{})}},
  launch:{label:'Лог запуска',detail:attempt?'Ошибка и последние сообщения запуска.':'Подробности ошибки; записей запуска нет.',available:!!(attempt?.error||message||attempt?.launch.length),data:startup},
  game:{label:'Ошибки игры',detail:errors.length?(attempt?'Предупреждения и ошибки этого запуска.':'Прошлая сессия · '+new Date(logModified||Date.now()).toLocaleString('ru-RU')):'Записей ошибок за доступный период не найдено.',available:errors.length>0,data:errors},
  crash:{label:'Краш-отчёт',detail:crash?(attempt?'':'Прошлая сессия · ')+crash.name+' · до 300 строк':(attempt?'Краш-отчёт этого запуска не найден.':'За последние сутки краш-отчёта не найдено.'),available:!!crash,data:crash?{file:crash.name,modified:new Date(crash.modified).toISOString(),lines:reportLines(clean(crash.text),true),truncated:crash.truncated}:null}
 };
 for(const [id,draft] of drafts)if(Date.now()-draft.created>15*60*1000)drafts.delete(id);
 if(drafts.size>=5)drafts.delete(drafts.keys().next().value!);
 const id=randomUUID(),title=attempt?.ran&&attempt.error?'Игра неожиданно закрылась':'Проблема с запуском или игрой';
 drafts.set(id,{created:Date.now(),actorId:actor?.id,title,summary,sources,requests:new Map(),hasFailure:!!(attempt?.error||message),secrets,paths});
 return {id,title,summary,hasFailure:!!(attempt?.error||message),author:actor?(actor.twitchLogin?'@'+actor.twitchLogin:actor.username):null,attachments:(Object.keys(sources) as ReportAttachmentId[]).map(key=>({id:key,label:sources[key].label,detail:sources[key].detail,available:sources[key].available}))};
}
export function previewLaunchReport(id:unknown,options:unknown):LaunchReportPreview{
 const d=get(id);if(!options||typeof options!=='object'||Array.isArray(options))throw new Error('Некорректный выбор приложений.');
 const o=options as {attachments:ReportAttachmentId[];comment:string;discord:boolean;ticketId?:number};
 if(Object.keys(o).some(k=>!['attachments','comment','discord','ticketId'].includes(k))||!Array.isArray(o.attachments)||o.attachments.length>4||new Set(o.attachments).size!==o.attachments.length||o.attachments.some(k=>typeof k!=='string'||!Object.hasOwn(d.sources,k)||!d.sources[k].available)||typeof o.comment!=='string'||o.comment.length>2000||typeof o.discord!=='boolean')throw new Error('Проверьте комментарий и выбор приложений.');
 if(o.ticketId!==undefined&&(!Number.isSafeInteger(o.ticketId)||!o.discord||!ticketChoices.get(String(id))?.has(o.ticketId)))throw new Error('Выберите свою открытую заявку из списка.');
 if(d.busy||d.result)throw new Error('Отчёт уже отправляется или отправлен.');
 const diagnostics:any={},errors:any={};if(o.attachments.includes('build'))diagnostics.build=d.sources.build.data;
 for(const key of (Object.keys(d.sources) as ReportAttachmentId[]).filter(k=>o.attachments.includes(k)))if(key!=='build')errors[key]=d.sources[key].data;
 if(Object.keys(errors).length)diagnostics.errors=errors;
 const description=redactReportText(d.summary.split('\n')[0].slice(0,240)+'\n\nКомментарий:\n'+(o.comment.trim()||'Без дополнительного комментария.'),d.secrets,d.paths);
 const body={id:'',title:'[Лаунчер '+app.getVersion()+'] '+d.title,description,steps:'',sections:Object.keys(diagnostics),diagnostics,discord:o.discord,...(o.ticketId?{ticket_id:o.ticketId}:{})};
 let hash=createHash('sha256').update(JSON.stringify({...body,id:''})).digest('hex');
 body.id=d.requests.get(hash)||(d.preview===hash&&d.payload?d.payload.id:randomUUID());
 const text=JSON.stringify(body,null,2),bytes=Buffer.byteLength(text);
 if(bytes>256*1024)throw new Error('Выбранные данные слишком большие. Уберите одно из приложений.');
 d.meaningful=d.hasFailure||o.comment.trim().length>=10||o.attachments.some(key=>key==='game'||key==='crash');
 d.payload=body;d.preview=hash;return {token:hash,text,bytes,canSend:d.meaningful};
}
function reviewed(id:unknown,token:unknown){const d=get(id);if(typeof token!=='string'||token!==d.preview||!d.payload)throw new Error('Состав отчёта изменился. Дождитесь предпросмотра и повторите действие.');return d;}
export async function sendLaunchReport(id:unknown,token:unknown):Promise<LaunchReportResult>{
 const d=reviewed(id,token);if(d.result)return d.result;if(d.busy)throw new Error('Дождитесь отправки отчёта.');
 if(!d.meaningful)throw new Error('Опишите проблему хотя бы в 10 символах или приложите ошибки игры либо краш.');
 d.busy=true;try{
  const actor=(await getAccounts()).find(a=>a.id===d.actorId);
  if(!actor?.communityToken)throw new Error('Для отправки войдите в SEFI Community. Пока можно сохранить отчёт на компьютере.');
  if(d.requests.size>=64&&!d.requests.has(d.preview!))throw new Error('Слишком много попыток отправки. Сохраните копию и попробуйте позже.');
  d.submitted=d.preview;d.requests.set(d.preview!,d.payload.id);
  const response=await communityRequest('/api/public/community/client-report',actor.communityToken,d.payload,false,20000);
  if(response?.ok!==true||response.id!==d.payload.id)throw new Error('Сайт не подтвердил приём отчёта. Повторите отправку; номер отчёта сохранён.');
  const ticketId=Number.isSafeInteger(response.ticket_id)&&response.ticket_id>0?response.ticket_id:undefined;
  const warning=typeof response.ticket_error==='string'&&response.ticket_error?redactReportText(response.ticket_error).slice(0,500):d.payload.discord&&!ticketId?'Сайт принял отчёт, но создание Discord-тикета пока не подтверждено.':undefined;
  d.result={id:response.id,...(ticketId?{ticketId}:{}),...(warning?{warning}:{}),...(d.payload.ticket_id&&ticketId?{appended:true}:{})};return d.result;
 }catch(error){
  if(error instanceof CommunitySessionError){
   if(error.status===429)throw new Error('Лимит отправок временно исчерпан. Попробуйте позже или сохраните копию на компьютере.');
   if(error.status===413)throw new Error('Отчёт слишком большой. Уберите часть приложений или сохраните копию на компьютере.');
   if(error.status===503)throw new Error('Приём отчётов временно недоступен. Сохраните копию на компьютере и попробуйте позже.');
   if(error.status===401)throw new Error('Сессия SEFI истекла. Войдите заново. Подготовленный отчёт остаётся в этом окне.');
   if(!error.status||error.status>=500)throw new Error('Сайт сейчас недоступен. Повторите отправку позже или сохраните копию. Автоматически ничего не отправится.');
  }
  throw new Error(redactReportText(compactError(error),d.secrets,d.paths).slice(0,600));
 }finally{d.busy=false;}
}
export async function exportLaunchReport(window:BrowserWindow,id:unknown,token:unknown):Promise<{cancelled:boolean}>{
 const d=reviewed(id,token),content=JSON.stringify(d.payload,null,2);const choice=await dialog.showSaveDialog(window,{title:'Сохранить диагностический отчёт SEFI',defaultPath:path.join(app.getPath('downloads'),'SEFI-report-'+d.payload.id+'.json'),filters:[{name:'Диагностический отчёт JSON',extensions:['json']}]});
 if(choice.canceled||!choice.filePath)return {cancelled:true};
 await fs.writeFile(choice.filePath,content,{encoding:'utf8',mode:0o600});return {cancelled:false};
}
