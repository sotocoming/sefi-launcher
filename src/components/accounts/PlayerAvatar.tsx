import { useEffect, useRef, useState } from 'react';
import { UserRound } from 'lucide-react';
import type { Account } from '../../types';
import { useStore } from '../../store/store';

export function PlayerAvatar({ account }: { account: Account | null }) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [account?.id, account?.skinUrl]);
  const ref = useRef<HTMLCanvasElement>(null);
  const skin = useStore(state => account ? state.communitySkins[account.id] : undefined);
  const load = useStore(state => state.loadCommunitySkin);
  const official = account?.type === 'microsoft' || account?.mcType === 'microsoft' || Boolean(account?.mcVerifiedAt);
  const png = !official ? skin?.png : undefined;
  useEffect(() => {
    if (account?.communityConnected && !official) void load(account.id).catch(() => {});
  }, [account?.id, account?.communityConnected, official, load]);
  useEffect(() => {
    if (!png || !ref.current) return;
    const context = ref.current.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, 64, 64);
    let alive = true;
    const image = new Image();
    image.onload = () => {
      if (!alive) return;
      const scale = image.naturalWidth / 64;
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 8 * scale, 8 * scale, 8 * scale, 8 * scale, 0, 0, 64, 64);
      context.drawImage(image, 40 * scale, 8 * scale, 8 * scale, 8 * scale, 0, 0, 64, 64);
    };
    image.src = 'data:image/png;base64,' + png;
    return () => { alive = false; };
  }, [png, account?.id]);
  const identifier = account?.uuid || account?.username || 'Alex';
  const fallback = account?.skinUrl?.startsWith('https://mc-heads.net/') ? account.skinUrl
    : `https://mc-heads.net/avatar/${encodeURIComponent(identifier)}/64`;
  return png ? <canvas key={account?.id} ref={ref} width={64} height={64} role="img" aria-label={`Голова ${account?.username || 'игрока'} из скина`} className="size-10 shrink-0 rounded-[9px] bg-white/5 [image-rendering:pixelated]" />
    : imageFailed ? <span role="img" aria-label={`Аватар ${account?.username || 'игрока'}`} className="flex size-10 shrink-0 items-center justify-center rounded-[9px] bg-sefi-surface2 text-sefi-purple"><UserRound size={22} aria-hidden="true" /></span>
    : <img src={fallback} alt="Голова игрока" className="size-10 shrink-0 rounded-[9px] bg-white/5 object-cover [image-rendering:pixelated]"
      onError={() => setImageFailed(true)} />;
}
