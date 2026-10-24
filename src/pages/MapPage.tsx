import {useEffect,useRef,useState} from 'react';
import {motion} from 'framer-motion';
import {ExternalLink,RotateCw,LoaderCircle} from 'lucide-react';
import {useStore} from '../store/store';

const mapBase=import.meta.env.MODE==='map-preview'?'http://127.0.0.1:43880/maps':'https://mc.sotocoming.ru/maps';
export function MapPage(){
 const name=useStore(s=>s.launcherConfig?.server?.name||'Sweet Home');
 const [key,setKey]=useState(0),[loading,setLoading]=useState(true),[slow,setSlow]=useState(false),[refreshing,setRefreshing]=useState(false);
 const frame=useRef<HTMLIFrameElement>(null),ack=useRef(false),fallback=useRef<ReturnType<typeof setTimeout>>();
 const origin=new URL(mapBase).origin;
 useEffect(()=>{
  if(!loading)return;
  const timer=setTimeout(()=>{setSlow(true);setLoading(false);setRefreshing(false);},15000);return()=>clearTimeout(timer);
 },[key,loading]);
 useEffect(()=>{
  const receive=(event:MessageEvent)=>{
   if(event.source!==frame.current?.contentWindow||event.origin!==origin||event.data?.type!=='sefi-map-state'||!['loading','ready','error'].includes(event.data.status))return;
   ack.current=true;if(fallback.current)clearTimeout(fallback.current);
   if(event.data.status!=='loading'){setLoading(false);setRefreshing(false);setSlow(false);}
  };
  window.addEventListener('message',receive);
  return()=>{window.removeEventListener('message',receive);if(fallback.current)clearTimeout(fallback.current);};
 },[origin]);
 const reload=()=>{
  if(refreshing)return;setRefreshing(true);setSlow(false);ack.current=false;
  frame.current?.contentWindow?.postMessage({type:'sefi-map-refresh'},origin);
  if(fallback.current)clearTimeout(fallback.current);
  fallback.current=setTimeout(()=>{if(!ack.current){setLoading(true);setKey(k=>k+1);}},1200);
 };
 const loaded=()=>{setLoading(false);setSlow(false);setRefreshing(false);};
 return <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="workspace-page map-page">
  <header className="page-head"><div><h1>Карта {name}</h1><p>Знакомые постройки и новые маршруты</p></div><div className="map-tools">
   <button className="s-button" onClick={reload} disabled={refreshing}><RotateCw size={13} className={refreshing?'animate-spin':''}/>{refreshing?'Обновляем…':'Обновить'}</button>
   <button className="s-button" onClick={()=>void window.electronAPI.openExternal(mapBase)}>В браузере <ExternalLink size={13}/></button>
  </div></header>
  <div className="map-frame"><iframe ref={frame} key={key} src={mapBase+'?embed=launcher'} title={'Карта сервера '+name} allow="fullscreen" onLoad={loaded} onError={()=>{setLoading(false);setRefreshing(false);setSlow(true);}}/>
   {loading&&<div className="map-loading" role="status"><LoaderCircle size={20} className="animate-spin"/>Загружаем карту мира…</div>}
  </div>
  {slow&&<p className="map-note" role="status">Карта загружается дольше обычного. Можно обновить её или открыть в браузере.</p>}
 </motion.div>;
}
