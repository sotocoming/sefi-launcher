import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';

export function AccountImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const className = 'size-12 shrink-0 rounded-xl border border-sefi-border bg-sefi-surface2';
  return failed
    ? <span role="img" aria-label={alt} className={className + ' flex items-center justify-center text-sefi-purple'}><UserRound size={24} aria-hidden="true" /></span>
    : <img src={src} alt={alt} width={48} height={48} className={className + ' object-cover'} onError={() => setFailed(true)} />;
}
