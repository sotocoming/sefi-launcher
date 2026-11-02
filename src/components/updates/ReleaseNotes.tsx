import {useEffect, useRef, useState} from 'react';
import {X} from 'lucide-react';
import {version} from '../../../package.json';
import './ReleaseNotes.css';

interface ReleaseInfo {
  intro: string;
  items: {title: string; text: string}[];
}

const releases: Record<string, ReleaseInfo> = {
  '1.1.1': {
    intro: 'Повышение надёжности подключения и автоматический обход сбоев DNS.',
    items: [
      {
        title: 'Отказоустойчивость при сбоях DNS',
        text: 'Лаунчер и игра теперь автоматически подключаются к серверам напрямую через резервные IP, если DNS регистратора недоступен.',
      },
      {
        title: 'Безопасное обновление адресов',
        text: 'Актуальные адреса серверов загружаются по независимому защищённому каналу с сохранением проверки SSL-сертификатов.',
      },
    ],
  },
  '1.1.0': {
    intro: 'Новый интерфейс, русский перевод сборки и помощь при проблемах с запуском.',
    items: [
      {title:'Новый интерфейс',text:'Обновили оформление. В аккаунте доступны кабинет и привязка Discord.'},
      {title:'Русский перевод сборки',text:'Перевели моды, книги, задания и подсказки. Перевод устанавливается вместе со сборкой.'},
      {title:'Понятнее обновления и ошибки',text:'Добавили заметный индикатор обновления. При проблеме с запуском покажем причину и предложим следующий шаг.'},
      {title:'Отчёт о проблеме',text:'После сбоя можно проверить логи и создать заявку или дополнить свою открытую. Отправку решаете вы.'},
      {title:'Сворачивание в трей',text:'Крестик во время игры скрывает окно, сохраняя автовход, отчёты и Discord. После выхода из игры окно возвращается.'},
    ],
  },
};

export function ReleaseNotes({request=0}:{request?:number}){
  const dialog=useRef<HTMLDialogElement>(null),dismissed=useRef(false);
  const [open,setOpen]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
  const release=releases[version];
  const items=release?.items;
  const intro=release?.intro || 'Что нового в этом обновлении.';

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
    <p id="release-notes-intro">{intro}</p>
    <ul className="release-notes-list">{items.map(item=><li key={item.title}><h3>{item.title}</h3><p>{item.text}</p></li>)}</ul>
    {error&&<p role="alert" className="release-notes-error">{error}</p>}
    <footer><span>Доступно в настройках → Лаунчер</span><div>{error&&<button type="button" className="s-button" onClick={()=>{dismissed.current=true;setOpen(false);}}>Пока закрыть</button>}<button autoFocus type="button" className="s-button primary" disabled={saving} onClick={()=>void close()}>{saving?'Сохраняем…':'Понятно'}</button></div></footer>
  </dialog>;
}
