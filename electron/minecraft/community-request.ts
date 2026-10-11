import { net } from 'electron';
import { setTimeout as delay } from 'timers/promises';

const ORIGIN='https://mc.sotocoming.ru';
export class CommunitySessionError extends Error {
  constructor(message: string, public status?: number) {super(message);}
}
export async function communityRequest(route: string, token?: string, body?: object, retry=false, timeout=15000): Promise<any> {
  if(!route.startsWith('/api/public/community/') || route.includes('..'))throw new Error('Некорректный маршрут сообщества.');
  const readOnly=body===undefined;
  for(let attempt=0;attempt<2;attempt++){
    let response: Response;
    try{
      response=await net.fetch(ORIGIN+route,{method:body===undefined?'GET':'POST',redirect:'error',signal:AbortSignal.timeout(timeout),
        headers:{Accept:'application/json',...(body!==undefined?{'Content-Type':'application/json'}:{}),...(token?{'X-Community-Token':token}:{})},
        ...(body!==undefined?{body:JSON.stringify(body)}:{})});
    }catch{
      if(attempt===0 && (readOnly||retry)){await delay(500);continue;}
      throw new CommunitySessionError('Сервис SEFI временно недоступен. Аккаунт сохранён; повторите запуск позже.');
    }
    if(!response.ok){
      const status=response.status;
      if(attempt===0 && (readOnly||retry) && (status>=500||status===429)){await response.body?.cancel();await delay(700);continue;}
      if(status===401){await response.body?.cancel();throw new CommunitySessionError('Сессия SEFI отозвана. Войдите в SEFI Community заново.',401);}
      if(status>=500 || status===429){await response.body?.cancel();throw new CommunitySessionError('Сервис SEFI временно недоступен (HTTP '+status+'). Аккаунт сохранён; повторите запуск позже.',status);}
      let data:any;try{data=await response.json();}catch{}
      throw new CommunitySessionError(typeof data?.error==='string'?data.error:'Сервис SEFI отклонил запрос (HTTP '+status+').',status);
    }
    try{return await response.json();}catch{throw new CommunitySessionError('Сервис SEFI вернул некорректный ответ. Аккаунт сохранён; повторите запуск.');}
  }
  throw new CommunitySessionError('Сервис SEFI недоступен. Повторите запуск.');
}
