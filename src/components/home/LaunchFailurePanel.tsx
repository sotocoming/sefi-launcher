import { useEffect, useState } from 'react';
import { AlertCircle, Copy, RotateCw, ArrowRight } from 'lucide-react';
import type { LaunchFailure } from '../../utils/errors';
import './LaunchFeedback.css';

export function LaunchFailurePanel({failure,onRecover,onRetry,canRetry,busy=false}:{
  failure:LaunchFailure;onRecover:()=>void;onRetry:()=>void;canRetry:boolean;busy?:boolean;
}) {
  const [copied,setCopied]=useState<'idle'|'ok'|'error'>('idle');
  useEffect(()=>setCopied('idle'),[failure.technical]);
  return <section className="launch-failure" data-launch-error={failure.kind} aria-label="Ошибка запуска Minecraft">
    <div className="launch-failure-message" role="alert">
      <AlertCircle size={17} strokeWidth={1.6} aria-hidden="true"/>
      <div><h2>{failure.title}</h2><p>{failure.description}</p></div>
    </div>
    <div className="launch-failure-actions">
      <button type="button" className="launch-recover" disabled={busy} onClick={onRecover}>
        {failure.action==='retry'?<RotateCw size={13} strokeWidth={1.6}/>:<ArrowRight size={13} strokeWidth={1.6}/>}
        {busy?'Проверяем…':failure.actionLabel}
      </button>
      {failure.action!=='retry' && failure.action!=='reload' && <button type="button" className="launch-retry" disabled={!canRetry||busy} onClick={onRetry}>Повторить запуск</button>}
      <button type="button" className="launch-report-action" onClick={()=>window.dispatchEvent(new CustomEvent('sefi-open-launch-report',{detail:{message:failure.technical}}))}>Отправить отчёт</button>
      <details className="launch-diagnostics" onToggle={event=>{const node=event.currentTarget;if(node.open)requestAnimationFrame(()=>node.scrollIntoView({block:'nearest',behavior:'instant'}));}}>
        <summary>Подробности</summary>
        <div className="launch-diagnostics-body"><pre tabIndex={0} aria-label="Технические подробности ошибки">{failure.technical}</pre>
          <button type="button" onClick={async()=>{
            try{await navigator.clipboard.writeText(failure.technical);setCopied('ok');}
            catch{setCopied('error');}
          }}><Copy size={12} strokeWidth={1.6}/>{copied==='ok'?'Скопировано':'Скопировать ошибку'}</button>
          <span role="status" aria-live="polite">{copied==='error'?'Не удалось скопировать. Можно выделить текст выше.':copied==='ok'?'Подробности скопированы.':''}</span>
        </div>
      </details>
    </div>
  </section>;
}
