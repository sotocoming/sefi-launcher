import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { SkinViewer } from 'skinview3d';

export function SkinPreview({ png, slim }: { png: string; slim: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewer = useRef<SkinViewer | null>(null);
  const model = useRef(slim);
  model.current = slim;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    let instance: SkinViewer | null = null;
    setReady(false); setFailed(false);
    const image = new Image();
    image.src = 'data:image/png;base64,' + png;
    Promise.all([import('skinview3d'), image.decode()]).then(([{ SkinViewer }]) => {
      if (!alive || !canvas.current) return;
      instance = new SkinViewer({ canvas: canvas.current, width: 224, height: 260,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2), zoom: 0.82, renderPaused: true });
      viewer.current = instance;
      instance.loadSkin(image, { model: model.current ? 'slim' : 'default' });
      instance.controls.enablePan = false;
      instance.controls.enableDamping = false;
      instance.controls.minDistance = 38;
      instance.controls.maxDistance = 90;
      instance.controls.minPolarAngle = Math.PI / 6;
      instance.controls.maxPolarAngle = Math.PI * 5 / 6;
      instance.camera.position.set(16, 7, 44);
      instance.controls.update();
      instance.controls.saveState();
      const current = instance;
      instance.controls.addEventListener('change', () => { if (alive) current.render(); });
      instance.render();
      setReady(true);
    }).catch(() => { if (alive) { instance?.dispose(); viewer.current = null; setFailed(true); } });
    return () => { alive = false; viewer.current = null; instance?.dispose(); };
  }, [png]);
  useEffect(() => {
    const current = viewer.current;
    if (current) { current.playerObject.skin.modelType = slim ? 'slim' : 'default'; current.render(); }
  }, [slim]);
  function reset() { viewer.current?.controls.reset(); viewer.current?.render(); }
  return <div className="relative z-10 flex w-full flex-col items-center">
    <span className="absolute left-3 top-3 rounded-md border border-cyan-200/15 bg-cyan-200/5 px-2 py-0.5 text-[10px] font-medium text-cyan-200/60">3D</span>
    <canvas ref={canvas} tabIndex={ready ? 0 : -1} role="img" aria-label="3D-скин персонажа. Перетаскивайте для вращения, колесо для приближения."
      aria-describedby="skin-rotation-help" data-ready={ready} hidden={failed}
      className="h-[260px] w-56 touch-none cursor-grab outline-none active:cursor-grabbing focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-cyan-200/40"
      onKeyDown={event => {
        const current = viewer.current;
        if (!current || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
        event.preventDefault();
        if (event.key === 'Home') { reset(); return; }
        const position = current.camera.position;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          const angle = event.key === 'ArrowLeft' ? -0.2 : 0.2;
          const x = position.x, z = position.z;
          position.x = x * Math.cos(angle) + z * Math.sin(angle);
          position.z = z * Math.cos(angle) - x * Math.sin(angle);
        } else position.y = Math.max(-30, Math.min(30, position.y + (event.key === 'ArrowUp' ? 5 : -5)));
        current.controls.update(); current.render();
      }} />
    {failed && <div role="status" className="flex h-[260px] flex-col items-center justify-center gap-3 px-4 text-center">
      <img src={'data:image/png;base64,' + png} alt="Текстура скина" className="h-24 w-24 [image-rendering:pixelated]" />
      <p className="text-xs text-white/50">3D-просмотр недоступен на этом устройстве.</p>
    </div>}
    {!ready && !failed && <span className="absolute top-28 text-xs text-white/40">Загружаем 3D…</span>}
    <p id="skin-rotation-help" className="text-center text-[10px] leading-4 text-white/35">Тяните мышью · колесо — масштаб</p>
    <button disabled={!ready} onClick={reset} className="mb-3 mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-[11px] text-white/60 hover:bg-white/10 disabled:opacity-30"><RotateCcw size={12} /> Вернуть ракурс</button>
  </div>;
}
