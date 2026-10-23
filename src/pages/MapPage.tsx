import {useEffect,useState} from 'react';
import {motion} from 'framer-motion';
import {ExternalLink,RotateCw,LoaderCircle} from 'lucide-react';
export function MapPage(){
 const [key,setKey]=useState(0);const [loading,setLoading]=useState(true);const [slow,setSlow]=useState(false);
 useEffect(()=>{const timer=setTimeout(()=>{setSlow(true);setLoading(false);},15000);return()=>clearTimeout(timer);},[key]);
 const reload=()=>{setLoading(true);setSlow(false);setKey(k=>k+1);};
 return <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="workspace-page map-page"><header className="page-head"><div><h1>Карта Sweet Home</h1><p>Знакомые постройки и новые маршруты</p></div><div className="map-tools"><button className="s-button" onClick={reload}><RotateCw size={13}/>Обновить</button><button className="s-button" onClick={()=>void window.electronAPI.openExternal('https://mc.sotocoming.ru/maps')}>В браузере <ExternalLink size={13}/></button></div></header><div className="map-frame"><iframe key={key} src="https://mc.sotocoming.ru/maps" title="Карта сервера Sweet Home" onLoad={()=>{setLoading(false);setSlow(false);}} onError={()=>{setLoading(false);setSlow(true);}}/>{loading&&<div className="map-loading" role="status"><LoaderCircle size={20} className="animate-spin"/>Загружаем карту мира…</div>}</div>{slow&&<p className="map-note" role="status">Карта загружается дольше обычного. Можно обновить её или открыть в браузере.</p>}</motion.div>;
}
