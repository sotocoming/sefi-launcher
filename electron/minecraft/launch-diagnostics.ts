import {randomUUID} from 'crypto';
import type {GameState,Settings} from '../../src/types';
import {redactReportText,reportLines} from '../report-redaction';

export interface LaunchDiagnostics {
 id:string; started:number; ended?:number; directory?:string; ramMax?:number;
 error:string; ran:boolean; launch:string[]; game:string[]; credentials:string[];
}
let latest:LaunchDiagnostics|null=null;
export function beginLaunchDiagnostics():LaunchDiagnostics {
 latest={id:randomUUID(),started:Date.now(),error:'',ran:false,launch:[],game:[],credentials:[]};return latest;
}
export function launchDiagnostics():LaunchDiagnostics|null {
 return latest?{...latest,launch:[...latest.launch],game:[...latest.game],credentials:[...latest.credentials]}:null;
}
export function setDiagnosticCredentials(attempt:LaunchDiagnostics,accounts:{accessToken?:string;clientToken?:string;communityToken?:string;msRefreshToken?:string}[]){
 attempt.credentials=[...new Set([...attempt.credentials,...accounts.flatMap(a=>[a.accessToken,a.clientToken,a.communityToken,a.msRefreshToken]).filter((s):s is string=>typeof s==='string')])];
}
export function setDiagnosticEnvironment(attempt:LaunchDiagnostics,settings:Settings){
 attempt.directory=settings.gameDirectory;attempt.ramMax=settings.ramMax;
}
export function recordDiagnosticState(attempt:LaunchDiagnostics,state:GameState){
 if(state.status==='running')attempt.ran=true;
 if(state.status==='error'){attempt.error=redactReportText(state.message||'Ошибка запуска',attempt.credentials,[attempt.directory||'']).slice(0,16000);attempt.ended=Date.now();}
 if(state.status==='idle')attempt.ended=Date.now();
}
export function recordDiagnosticLines(attempt:LaunchDiagnostics,source:'launch'|'game',message:string){
 const lines=reportLines(redactReportText(String(message).slice(-32000),attempt.credentials,[attempt.directory||'']));
 const safe=source==='game'?lines.filter(line=>/\b(?:ERROR|WARN|FATAL|Exception|Caused by:)|^\s+at\s/.test(line)):lines;
 attempt[source].push(...safe);attempt[source]=attempt[source].slice(-150);
}
