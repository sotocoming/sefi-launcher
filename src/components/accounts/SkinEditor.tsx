import { SkinPreview } from './SkinPreview';
import { useStore } from '../../store/store';
import { useEffect, useState } from 'react';
import { ExternalLink, Upload, Check, Shirt, LoaderCircle } from 'lucide-react';
import type { Account, CommunitySkin, SkinDraft } from '../../types';

const officialUrl = 'https://www.minecraft.net/en-us/msaprofile/mygames/editskin';
export function SkinEditor({ account }: { account: Account | null }) {
  const official = account?.type === 'microsoft' || account?.mcType === 'microsoft' || Boolean(account?.mcVerifiedAt);
  const eligible = Boolean(account?.communityToken && !official);
  const [saved, setSaved] = useState<CommunitySkin | null>(null);
  const [draft, setDraft] = useState<SkinDraft | null>(null);
  const [model, setModel] = useState<'classic' | 'slim'>('classic');
  const loadSkin = useStore(state => state.loadCommunitySkin);
  const cacheSkin = useStore(state => state.setCommunitySkin);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(eligible);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!eligible || !account) return;
    let alive = true;
    loadSkin(account.id).then(skin => {
      if (alive) { setSaved(skin); setModel(skin?.model || 'classic'); }
    }).catch(err => { if (alive) setError(err.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [account?.id, eligible, loadSkin]);
  async function act(action: 'choose' | 'save' | 'reset') {
    if (!account) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (action === 'choose') {
        const file = await window.electronAPI.chooseSkin();
        if (file) setDraft(file);
      } else {
        const skin = action === 'reset' ? await window.electronAPI.resetCommunitySkin(account.id)
          : await window.electronAPI.saveCommunitySkin(account.id, (draft || saved)!.png, model);
        cacheSkin(account.id, skin);
        setSaved(skin); setDraft(null); setModel(skin?.model || 'classic');
        setNotice(action === 'reset' ? 'Скин сброшен. В игре обновится в течение минуты.' : 'Скин сохранён. Игроки SEFI увидят его в течение минуты.');
      }
    } catch (err: any) { setError(err.message || 'Не удалось обновить скин. Попробуйте ещё раз.'); }
    finally { setBusy(false); }
  }
  const png = draft?.png || saved?.png;
  const dirty = Boolean(draft || (saved && saved.model !== model));
  return <section className="mt-7 overflow-hidden rounded-2xl border border-cyan-300/15 bg-gradient-to-br from-[#10232b] via-[#10151f] to-[#19142a]">
    <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Shirt size={17} className="text-cyan-300" /> Внешний вид</h2>
      <span className="text-[11px] text-white/45">{account?.username || 'Профиль не выбран'} · {official ? 'Minecraft Java' : 'SEFI Community'}</span>
    </div>
    {official ? <div className="flex items-center justify-between gap-5 p-6">
      <div><p className="text-sm font-medium text-white">Ваш официальный скин</p><p className="mt-2 max-w-md text-xs leading-5 text-white/50">Скин и плащ загружаются из Minecraft. Измените скин в личном кабинете — он будет виден и игрокам SEFI.</p></div>
      <a href={officialUrl} onClick={e => { e.preventDefault(); void window.electronAPI.openExternal(officialUrl); }} className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-xs font-semibold text-cyan-200 hover:bg-cyan-300/20">Изменить на Minecraft.net <ExternalLink size={14} /></a>
    </div> : <div className="grid grid-cols-[230px,1fr] gap-6 p-6">
      <div className="relative flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-white/5 bg-black/20">
        <div className="absolute bottom-12 h-4 w-28 rounded-[50%] bg-cyan-400/10 blur-md" />
        {png ? <SkinPreview png={png} slim={model === 'slim'} /> : <div className="flex h-56 flex-col items-center justify-center gap-3 text-white/25"><Shirt size={54} strokeWidth={1} /><span className="text-xs">{loading ? 'Загружаем скин…' : 'Ваш персонаж'}</span></div>}
      </div>
      <div className="flex flex-col justify-center">
        <p className="text-lg font-semibold tracking-tight text-white">Ваш стиль в общем мире</p>
        <p className="mt-2 text-xs leading-5 text-white/50">Загрузите скин, и его увидят все игроки с SEFI Launcher, включая владельцев лицензии.</p>
        {!eligible && <p className="mt-3 text-xs text-amber-200">Войдите в SEFI Community через сайт, чтобы выбрать и сохранить скин.</p>}
        <div className="mt-4 flex gap-2" role="group" aria-label="Модель персонажа">
          {(['classic', 'slim'] as const).map(value => <button key={value} aria-pressed={model === value} disabled={!eligible || busy || loading} onClick={() => setModel(value)} className={`rounded-lg border px-3 py-2 text-xs transition disabled:opacity-40 ${model === value ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-200' : 'border-white/10 text-white/45 hover:text-white'}`}>{value === 'classic' ? 'Обычная · 4 px' : 'Тонкая · 3 px'}</button>)}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button disabled={!eligible || busy || loading} onClick={() => act('choose')} className="inline-flex items-center gap-2 rounded-xl bg-cyan-200 px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-cyan-100 disabled:opacity-40"><Upload size={14} /> Выбрать PNG</button>
          <button disabled={!dirty || busy || loading} onClick={() => act('save')} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 px-4 py-2.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-300/10 disabled:opacity-30">{busy ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />} Сохранить</button>
          {dirty && <button disabled={busy || loading} onClick={() => { setDraft(null); setModel(saved?.model || 'classic'); setError(''); setNotice(''); }} className="px-2 py-2 text-xs text-white/50 hover:text-white disabled:opacity-30">Отменить</button>}
          {saved && <button disabled={busy || loading} onClick={() => act('reset')} className="px-2 py-2 text-xs text-white/40 hover:text-red-300 disabled:opacity-30">Сбросить</button>}
        </div>
        <p className="mt-3 truncate text-[11px] text-white/35">{draft ? draft.filename + ' · Предпросмотр, ещё не сохранён' : 'PNG 64 × 64 · до 64 КБ · два слоя'}</p>
        {error && <p role="alert" className="mt-3 text-xs leading-5 text-red-200">{error.replace(/^Error: Error invoking remote method '[^']+': Error: /, '')}</p>}
        {notice && <p role="status" className="mt-3 text-xs leading-5 text-emerald-200">{notice}</p>}
      </div>
    </div>}
  </section>;
}
