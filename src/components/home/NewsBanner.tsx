import React, {useState} from 'react';
import {ExternalLink} from 'lucide-react';
import {useStore} from '../../store/store';
export const NewsBanner:React.FC<{onOpenNews:()=>void}>=({onOpenNews})=>{
 const news=useStore(s=>s.news); const [index,setIndex]=useState(0);
 const items=(news||[]).filter(n=>(n.status==='published'||(!n.status&&!n.archived))&&!n.archived&&n.status!=='scheduled');
 const item=items[index%Math.max(1,items.length)]; const image=item?.image_launcher||item?.image;
 return <section className="news-panel" aria-label="Новости проекта">{image&&<img className="news-background" src={image} alt="" aria-hidden="true"/>}<div className="news-heading"><h2>Новости</h2><button className="all-news" onClick={onOpenNews}>Все новости <ExternalLink size={11}/></button></div><button className="news-story" onClick={onOpenNews}><span><strong>{item?.title||'Пока нет опубликованных новостей'}</strong>{item&&<time>{item.date}</time>}</span></button><div className="news-paging">{[true,false].map(prev=><button key={String(prev)} disabled={items.length<2} aria-label={prev?'Предыдущая новость':'Следующая новость'} onClick={()=>setIndex(i=>(i+(prev?-1:1)+items.length)%items.length)}><svg viewBox="0 0 16 16" aria-hidden="true"><path transform={prev?'translate(16 0) scale(-1 1)':undefined} d="M6 3 5 4 9 8 5 12 6 13 11 8Z"/></svg></button>)}</div></section>;
};
