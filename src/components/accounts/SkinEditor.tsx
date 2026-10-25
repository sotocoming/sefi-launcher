import { SkinPreview } from './SkinPreview';
import { useStore } from '../../store/store';
import { useEffect, useState } from 'react';
import { ExternalLink, Upload, Check, Shirt, LoaderCircle } from 'lucide-react';
import type { Account, CommunitySkin, OfficialSkin, SkinDraft } from '../../types';

const officialUrl = 'https://www.minecraft.net/en-us/msaprofile/mygames/editskin';
export function SkinEditor({ account }: { account: Account | null }) {
  const official = account?.type === 'microsoft' || account?.mcType === 'microsoft' || Boolean(account?.mcVerifiedAt);
  const eligible = Boolean(account?.communityConnected && !official);
  const [saved, setSaved] = useState<CommunitySkin | null>(null);
  const [draft, setDraft] = useState<SkinDraft | null>(null);
  const [model, setModel] = useState<'classic' | 'slim'>('classic');
  const loadSkin = useStore(state => state.loadCommunitySkin);
  const cacheSkin = useStore(state => state.setCommunitySkin);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(eligible);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [officialSkin, setOfficialSkin] = useState<OfficialSkin | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!official || !account) return;
    let alive = true;
    setOfficialSkin(null); setLoading(true); setError('');
    window.electronAPI.getOfficialSkin(account.id, refresh > 0).then(skin => {
      if (alive) setOfficialSkin(skin);
    }).catch(() => { if (alive) setError('Не удалось загрузить скин Minecraft. Проверьте подключение и попробуйте ещё раз.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [official, account?.id, refresh]);
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
  return <section className="skin-panel">
    <div className="skin-head">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Shirt size={17} className="text-sefi-purple" /> Внешний вид</h2>
      <span className="text-[11px] text-white/45">{account?.username || 'Профиль не выбран'} · {official ? 'Minecraft Java' : 'SEFI Community'}</span>
    </div>
    {official ? <div className="skin-editor-body official-skin-body">
      <div className="skin-stage">
        {officialSkin ? <SkinPreview png={officialSkin.png} slim={officialSkin.model === 'slim'} cape={officialSkin.cape}/> : <div className="official-skin-placeholder" role="status"><Shirt size={38} strokeWidth={1}/><span>{loading ? 'Загружаем скин Minecraft…' : error ? 'Скин пока недоступен' : 'В профиле нет скина'}</span></div>}
      </div>
      <div className="skin-controls official-skin">
        <div><p className="official-skin-title">Официальный скин</p><p className="official-skin-description">Внешний вид из Minecraft Java. Смена скина доступна в личном кабинете Minecraft.</p></div>
        {error && <p role="alert" className="official-skin-error">{error}</p>}
        <div className="official-skin-actions"><a href={officialUrl} onClick={e => { e.preventDefault(); void window.electronAPI.openExternal(officialUrl); }} className="s-button">Minecraft.net <ExternalLink size={13}/></a><button className="text-action" disabled={loading} onClick={() => setRefresh(n => n + 1)}>{loading ? 'Загружаем…' : 'Обновить'}</button></div>
      </div>
    </div> : <div className="skin-editor-body">
      <div className="skin-stage">
        {png ? <SkinPreview png={png} slim={model === 'slim'} /> : <div className="flex h-56 flex-col items-center justify-center gap-3 text-white/25"><Shirt size={54} strokeWidth={1} /><span className="text-xs">{loading ? 'Загружаем скин…' : 'Ваш персонаж'}</span></div>}
      </div>
      <div className="skin-controls">
        <p className="text-lg font-semibold tracking-tight text-white">Ваш стиль в общем мире</p>
        <p className="mt-2 text-xs leading-5 text-white/50">Загрузите скин, и его увидят все игроки с SEFI Launcher, включая владельцев лицензии.</p>
        {!eligible && <p className="mt-3 text-xs text-amber-200">Войдите в SEFI Community через сайт, чтобы выбрать и сохранить скин.</p>}
        <div className="mt-4 flex gap-2" role="group" aria-label="Модель персонажа">
          {(['classic', 'slim'] as const).map(value => <button key={value} aria-pressed={model === value} disabled={!eligible || busy || loading} onClick={() => setModel(value)} className={`rounded-lg border px-3 py-2 text-xs transition disabled:opacity-40 ${model === value ? 'border-sefi-purple/40 bg-sefi-purple/10 text-sefi-purple' : 'border-white/10 text-white/45 hover:text-white'}`}>{value === 'classic' ? 'Обычная · 4 px' : 'Тонкая · 3 px'}</button>)}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button disabled={!eligible || busy || loading} onClick={() => act('choose')} className="inline-flex items-center gap-2 rounded-xl bg-sefi-purple px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-sefi-purple disabled:opacity-40"><Upload size={14} /> Выбрать PNG</button>
          <button disabled={!dirty || busy || loading} onClick={() => act('save')} className="inline-flex items-center gap-2 rounded-xl border border-sefi-purple/25 px-4 py-2.5 text-xs font-semibold text-sefi-purple hover:bg-sefi-purple/10 disabled:opacity-30">{busy ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />} Сохранить</button>
          {dirty && <button disabled={busy || loading} onClick={() => { setDraft(null); setModel(saved?.model || 'classic'); setError(''); setNotice(''); }} className="px-2 py-2 text-xs text-white/50 hover:text-white disabled:opacity-30">Отменить</button>}
          {saved && <button disabled={busy || loading} onClick={() => act('reset')} className="px-2 py-2 text-xs text-white/40 hover:text-red-300 disabled:opacity-30">Сбросить</button>}
        </div>
        <p className="mt-3 truncate text-[11px] text-white/35">{draft ? draft.filename + ' · Предпросмотр, ещё не сохранён' : 'PNG 64 × 64 или 128 × 128 · до 128 КБ · два слоя'}</p>
        {error && <p role="alert" className="mt-3 text-xs leading-5 text-red-200">{error.replace(/^Error: Error invoking remote method '[^']+': Error: /, '')}</p>}
        {notice && <p role="status" className="mt-3 text-xs leading-5 text-emerald-200">{notice}</p>}
      </div>
    </div>}
  </section>;
}
