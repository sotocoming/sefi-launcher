import {useEffect,useState} from 'react';
export function ClockWarning(){
 const [clock,setClock]=useState<{warning:boolean;driftSeconds:number}|null>(null);
 useEffect(()=>{let alive=true;const update=()=>Promise.resolve(window.electronAPI?.getClockStatus?.()).then(value=>{if(alive&&typeof value?.warning==='boolean')setClock(value);}).catch(()=>{});void update();const timer=setInterval(()=>void update(),15000);return()=>{alive=false;clearInterval(timer);};},[]);
 if(!clock?.warning)return null;
 return <div className="clock-warning" role="status"><div><strong>Проверьте время на компьютере</strong><p>Часы отличаются от SEFI примерно на {Math.abs(clock.driftSeconds)} сек. Включите автоматическую синхронизацию времени в Windows. Для автовхода лаунчер использует время сервера.</p></div><button className="s-button" onClick={()=>void window.electronAPI.openTimeSettings()}>Настройки времени</button></div>;
}
