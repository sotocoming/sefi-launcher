import { app } from 'electron';
import { createServer } from 'http';
import { randomBytes, timingSafeEqual } from 'crypto';
import { communityRequest } from './community-request';
import type { Account } from '../../src/types';

const brokers = new Set<() => void>();
app.on('before-quit', () => { for (const close of brokers) close(); });
export async function startReportBroker(account: Account): Promise<{port:number; key:string; close:()=>void}> {
 const key = randomBytes(32).toString('hex');
 let busy = false;
 const server = createServer(async(req,res) => {
  const reply=(status:number,body:object)=>{ if(!res.destroyed){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));} };
  const port=(server.address() as {port:number}).port;
  const supplied=req.headers['x-sefi-report-key'];
  if(req.method!=='POST' || req.url!=='/sefi/report' || req.socket.remoteAddress!=='127.0.0.1' || req.headers.host!== '127.0.0.1:'+port
   || req.headers.origin!==undefined || req.headers['content-type']?.split(';')[0].trim()!=='application/json'
   || typeof supplied!=='string' || !/^[0-9a-f]{64}$/.test(supplied) || !timingSafeEqual(Buffer.from(supplied),Buffer.from(key))) return reply(403,{error:'Недоступный запрос.'});
  if(busy) return reply(429,{error:'Дождитесь отправки предыдущего отчёта.'});
  if(!account.communityToken) return reply(401,{error:'Для отправки войдите в SEFI Community в лаунчере. Локальную копию отчёта можно сохранить.'});
  busy=true;
  try {
   const chunks:Buffer[]=[];let length=0;
   for await(const chunk of req){length+=chunk.length;if(length>768*1024){reply(413,{error:'Отчёт слишком большой.'});req.destroy();return;}chunks.push(chunk);}
   const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(!body || typeof body!=='object' || typeof body.id!=='string' || !/^[0-9a-f-]{36}$/.test(body.id) || typeof body.title!=='string' || typeof body.description!=='string'
    || !Array.isArray(body.sections) || body.sections.some((s:unknown)=>!['build','settings','errors','input'].includes(String(s))) || typeof body.diagnostics!=='object') return reply(400,{error:'Некорректный отчёт.'});
   const result=await communityRequest('/api/public/community/client-report',account.communityToken,body,false,20000);
   reply(200,{ok:result.ok===true,id:result.id,ticket_id:result.ticket_id,ticket_error:result.ticket_error});
  } catch { reply(503,{error:'Не удалось отправить отчёт. Локальная копия сохранена; повторите отправку позже.'}); }
  finally {busy=false;}
 });
 server.requestTimeout=10000;server.headersTimeout=10000;server.setTimeout(25000);
 await new Promise<void>((resolve,reject)=>{server.once('error',()=>reject(new Error('Не удалось подготовить отправку отчётов.')));server.listen(0,'127.0.0.1',resolve);});
 const close=()=>{server.close();server.closeAllConnections();brokers.delete(close);};brokers.add(close);
 return {port:(server.address() as {port:number}).port,key,close};
}
