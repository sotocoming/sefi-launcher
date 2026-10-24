import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, Check, CircleAlert, LoaderCircle, RefreshCw, Sparkles } from 'lucide-react';
import { useStore } from '../../store/store';
import { updateBytes, updateView } from '../../utils/updates';
import './LauncherUpdate.css';

function UpdateEnergy({ state }: {state:string}) {
  const ref=useRef<HTMLSpanElement>(null);
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    const element=ref.current;
    if(!element)return;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let intersecting=false;
    const sync=()=>setVisible(intersecting && !document.hidden && !reduced.matches);
    const observer=new IntersectionObserver(entries=>{intersecting=entries[0]?.isIntersecting||false;sync();});
    observer.observe(element);document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
    return()=>{observer.disconnect();document.removeEventListener('visibilitychange',sync);reduced.removeEventListener('change',sync);};
  },[]);
  const sparks=[
    [4,-16,22,3.4,-.4],[15,-9,34,3.8,-2.6],[28,-8,27,3.2,-1.5],
    [40,-4,38,4.2,-3.1],[52,3,24,3.5,-.9],[64,7,33,4.1,-2.1],
    [78,10,26,3.3,-1.3],[91,16,35,3.9,-3.4]
  ];
  return <span ref={ref} className="update-energy" aria-hidden="true">{visible && (state==='downloading'||state==='ready') &&
    sparks.map(([x,dx,dy,duration,delay],i)=><i key={i} className="update-particle" style={{
      '--spark-x':x+'%','--spark-dx':dx+'px','--spark-dy':dy+'px',
      '--spark-duration':duration+'s','--spark-delay':delay+'s','--spark-size':i%3===0?'3px':'2px'
    } as React.CSSProperties}/>)}</span>;
}
function UpdateSignal({ state, energy }: {state:string;energy:boolean}) {
  const Icon=state==='error'?CircleAlert:state==='idle'?Check:state==='ready'?Sparkles:state==='downloading'?ArrowDownToLine:LoaderCircle;
  return <span className={'update-signal '+(energy?'has-energy':'')}><Icon size={15} strokeWidth={1.6} aria-hidden="true"/>
    </span>;
}
export function LauncherUpdatePanel() {
  const {updateInfo,gameState,checkLauncherUpdate,installLauncherUpdate}=useStore();
  const view=updateView(updateInfo,!['idle','error'].includes(gameState.status));
  const bytes=updateBytes(updateInfo);
  return <div className={'launcher-update-panel update-state-'+view.state} data-update-state={view.state}>
    <div className="update-status-line" role={view.state==='error'?'alert':'status'} aria-live="polite">
      <UpdateSignal state={view.state} energy={view.energy}/><strong>{view.title}</strong>
      {view.version&&<span className="update-version" title={view.version}>v{view.version}</span>}
    </div>
    <p className="update-description">{view.detail}</p>
    {view.state==='downloading'&&<>
      <div className="update-progress" role="progressbar" aria-label="Загрузка обновления лаунчера" aria-valuemin={0} aria-valuemax={100} aria-valuenow={view.progress}>
        <span style={{transform:'scaleX('+view.progress/100+')'}}/>
      </div>
      <div className="update-progress-meta"><span>{view.progress}%</span>{bytes&&<span>{bytes}</span>}</div>
    </>}
    {view.notice&&<p className="update-description update-notice">{view.notice}</p>}
    {view.action!=='none'&&<div className="update-actions">
      <button type="button" className={'s-button '+(view.action==='install'?'update-install':'')}
        disabled={view.disabled} onClick={view.action==='install'?installLauncherUpdate:checkLauncherUpdate}>
        {view.action==='install'?<RefreshCw size={13} strokeWidth={1.6}/>:null}{view.actionLabel}
      </button>
    </div>}
  </div>;
}
export function LauncherUpdateIndicator({onOpen}: {onOpen:()=>void}) {
  const {updateInfo,gameState}=useStore();
  const view=updateView(updateInfo,!['idle','error'].includes(gameState.status));
  if(['unverified','idle'].includes(view.state))return null;
  const title=view.state==='downloading'?'Загрузка · '+view.progress+'%':view.state==='ready'?'Обновление готово':view.state==='error'?'Ошибка обновления':view.state==='installing'?'Перезапуск…':view.title;
  return <button type="button" className={'launcher-update-indicator update-state-'+view.state} onClick={onOpen}
    aria-label={title+'. Открыть обновления лаунчера'} title={view.notice||view.detail}>
    <UpdateSignal state={view.state} energy={view.energy}/><span className="launcher-update-label">{title}</span>{view.energy&&<UpdateEnergy state={view.state}/>}
  </button>;
}
