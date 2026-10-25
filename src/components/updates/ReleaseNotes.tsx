import {useEffect, useRef, useState} from 'react';
import {X} from 'lucide-react';
import {version} from '../../../package.json';
import './ReleaseNotes.css';

const releases: Record<string, {title:string; text:string}[]> = {
 '1.1.0': [
  {title:'Освежили оформление',text:'Выровняли элементы и упорядочили блоки интерфейса.'},
  {title:'Доработали состояния',text:'Улучшили отображение обновлений и ошибок запуска.'},
  {title:'Подогнали экран аккаунта',text:'Содержимое помещается при стандартной высоте окна.'},
  {title:'Добавили отправку отчёта',text:'После сбоя можно выбрать диагностику и отправить её в поддержку. Только по вашему нажатию.'},
  {title:'Перевели сборку',text:'Добавили русский перевод модов, книг, заданий и подсказок. Стандартный шрифт сохранён.'},
 ]
};
export function ReleaseNotes({request=0}:{request?:number}){
 const dialog=useRef<HTMLDialogElement>(null),dismissed=useRef(false);
 const [open,setOpen]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const items=releases[version];
 useEffect(()=>{let alive=true;if(items&&window.electronAPI?.getReleaseNotesVersion)Promise.resolve(window.electronAPI.getReleaseNotesVersion()).then(seen=>{if(alive&&!dismissed.current&&typeof seen==='string'&&seen!==version)setOpen(true);}).catch(()=>{});return()=>{alive=false;};},[items]);
 useEffect(()=>{if(request>0&&items){setError('');setOpen(true);}},[request,items]);
 useEffect(()=>{const node=dialog.current;if(!node)return;if(open&&!node.open)node.showModal();else if(!open&&node.open)node.close();},[open]);
 async function close(){
  if(saving)return;setSaving(true);
  try{await window.electronAPI.acknowledgeReleaseNotes(version);dismissed.current=true;setOpen(false);}
  catch{setError('Не удалось сохранить отметку о просмотре. При следующем запуске список может появиться снова.');}
  finally{setSaving(false);}
 }
 if(!items)return null;
 return <dialog ref={dialog} className="release-notes" aria-labelledby="release-notes-title" aria-describedby="release-notes-intro" onCancel={e=>{e.preventDefault();void close();}}>
  <div className="release-notes-header"><h2 id="release-notes-title">Что нового <span>{version}</span></h2><button type="button" className="release-notes-close" aria-label="Закрыть список изменений" disabled={saving} onClick={()=>void close()}><X size={16} strokeWidth={1.5}/></button></div>
  <p id="release-notes-intro">Лаунчер стал аккуратнее и понятнее. Вот что изменилось в этой версии.</p>
  <ul className="release-notes-list">{items.map(item=><li key={item.title}><h3>{item.title}</h3><p>{item.text}</p></li>)}</ul>
  {error&&<p role="alert" className="release-notes-error">{error}</p>}
  <footer><span>Доступно в настройках → Лаунчер</span><div>{error&&<button type="button" className="s-button" onClick={()=>{dismissed.current=true;setOpen(false);}}>Пока закрыть</button>}<button autoFocus type="button" className="s-button primary" disabled={saving} onClick={()=>void close()}>{saving?'Сохраняем…':'Понятно'}</button></div></footer>
 </dialog>;
}
