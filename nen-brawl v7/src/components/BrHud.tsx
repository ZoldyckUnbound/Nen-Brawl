import { useEffect, useMemo, useRef, useState } from 'react';
import type { Game, HudState } from '../game/Game';
import { CARDS, RANK_COLOR, RANK_NAME, POIS, DUNGEONS } from '../game/br/data';
import type { BrHudState } from '../game/br/mode';

const fmtT = (s: number) => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
const MARK: Record<string, string> = { ally: '#7dff9a', enemy: '#ff5a5a', trace: '#ff2a2a', beacon: '#ffd24a', drop: '#ffd24a', boss: '#ff6a3a', npc: '#6ad0ff', chest: '#ffd24a', loot: '#ffffff', site: '#ffb35a' };
const clampN = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** word-by-word / letter-by-letter reveal used by the cinematic subtitles */
function useTypewriter(text: string, cps = 46) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const t0 = performance.now();
    const id = window.setInterval(() => { const k = Math.floor(((performance.now() - t0) / 1000) * cps); setN(Math.min(text.length, k)); if (k >= text.length) window.clearInterval(id); }, 30);
    return () => window.clearInterval(id);
  }, [text, cps]);
  return text.slice(0, n);
}

// ------------------------------------------------------------------ map drawing shared by the minimap and the big map
function drawZone(ctx: CanvasRenderingContext2D, br: BrHudState, X: (x: number) => number, Y: (z: number) => number, k: number, S0: number, S1: number, lw: number) {
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, S0, S1);
  ctx.arc(X(0), Y(0), Math.max(0.1, br.mini.safeR * k), 0, 6.2832, true);
  ctx.fillStyle = 'rgba(120,40,200,0.4)'; ctx.fill('evenodd');
  ctx.lineWidth = lw; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.arc(X(0), Y(0), Math.max(0.1, br.mini.safeR * k), 0, 6.2832); ctx.stroke();
  if (br.mini.nextR < br.mini.safeR - 1) { ctx.setLineDash([7, 6]); ctx.strokeStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(X(0), Y(0), Math.max(0.1, br.mini.nextR * k), 0, 6.2832); ctx.stroke(); ctx.setLineDash([]); }
  ctx.restore();
}
function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, size: number) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.6; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4;
  ctx.beginPath(); ctx.moveTo(Math.sin(a) * size * 1.5, Math.cos(a) * size * 1.5); ctx.lineTo(Math.sin(a + 2.5) * size, Math.cos(a + 2.5) * size); ctx.lineTo(Math.sin(a) * size * 0.35, Math.cos(a) * size * 0.35); ctx.lineTo(Math.sin(a - 2.5) * size, Math.cos(a - 2.5) * size); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawMarks(ctx: CanvasRenderingContext2D, br: BrHudState, X: (x: number) => number, Y: (z: number) => number, S0: number, S1: number, big: boolean, zoomed: boolean) {
  for (const m of br.mini.marks) {
    const x = X(m.x), y = Y(m.z);
    if (x < -10 || y < -10 || x > S0 + 10 || y > S1 + 10) continue;
    if (m.t === 'npc' && !zoomed) continue;
    const r = m.t === 'loot' ? 2.2 : m.t === 'chest' ? 3 : m.t === 'trace' || m.t === 'boss' || m.t === 'drop' ? 6 : m.t === 'site' ? 5 : big ? 5 : 3.6;
    ctx.fillStyle = MARK[m.t] ?? '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (m.t === 'beacon' || m.t === 'drop' || m.t === 'site') { ctx.moveTo(x, y - r - 2); ctx.lineTo(x + r + 2, y); ctx.lineTo(x, y + r + 2); ctx.lineTo(x - r - 2, y); ctx.closePath(); } else ctx.arc(x, y, r, 0, 6.2832);
    ctx.fill(); if (r > 3) ctx.stroke();
    if (big && m.label && m.t !== 'npc' && m.t !== 'loot' && m.t !== 'chest' && (m.t !== 'site' || zoomed)) { ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(m.label, x, y - 11); ctx.fillText(m.label, x, y - 11); }
  }
}

/** corner minimap – tier 0: compass only · tier 1: island outline · tier 2: detailed atlas */
function MiniMap({ br, game, size }: { br: BrHudState; game: Game; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const lvl = br.mapLevel;
  useEffect(() => {
    const cv = ref.current, w = game.br?.world;
    if (!cv || !w) return;
    const ctx = cv.getContext('2d')!;
    const S = size, W = w.mapW;
    ctx.clearRect(0, 0, S, S);
    ctx.save(); ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, 6.2832); ctx.clip();
    if (lvl === 0) {
      const g = ctx.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2); g.addColorStop(0, '#1d2433'); g.addColorStop(1, '#0a0e18'); ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1; for (let r = S * 0.16; r < S / 2; r += S * 0.14) { ctx.beginPath(); ctx.arc(S / 2, S / 2, r, 0, 6.2832); ctx.stroke(); }
      ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillText('NO MAP CARD', S / 2, S / 2 + S * 0.3);
      const a = br.mini.yaw; drawArrow(ctx, S / 2, S / 2, a, 9);
      const dir = Math.atan2(-br.mini.z, -br.mini.x); // direction to the island heart
      ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(S / 2, S / 2); ctx.lineTo(S / 2 + Math.cos(dir) * S * 0.36, S / 2 + Math.sin(dir) * S * 0.36); ctx.stroke();
      ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(S / 2 + Math.cos(dir) * S * 0.36, S / 2 + Math.sin(dir) * S * 0.36, 3.5, 0, 6.2832); ctx.fill();
    } else {
      const src = lvl >= 2 ? w.mapCanvas : w.chartCanvas;
      const view = lvl >= 2 ? 2600 : W * 0.98;
      const cx = lvl >= 2 ? br.mini.x : 0, cz = lvl >= 2 ? br.mini.z : 0, k = S / view;
      const X = (x: number) => (x - cx) * k + S / 2, Y = (z: number) => (z - cz) * k + S / 2;
      ctx.fillStyle = lvl >= 2 ? '#17324a' : '#10202e'; ctx.fillRect(0, 0, S, S);
      ctx.drawImage(src, 0, 0, src.width, src.height, X(-W / 2), Y(-W / 2), W * k, W * k);
      drawZone(ctx, br, X, Y, k, S, S, 2);
      if (lvl >= 2) { ctx.font = '9px system-ui'; ctx.textAlign = 'center'; for (const p of POIS) { if (p.tier < 2 && Math.hypot(p.x - cx, p.z - cz) > 1500) continue; const x = X(p.x), y = Y(p.z); if (x < 0 || y < 0 || x > S || y > S) continue; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.arc(x, y, 7, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(p.icon, x, y + 3.2); } }
      drawMarks(ctx, br, X, Y, S, S, false, false);
      drawArrow(ctx, X(br.mini.x), Y(br.mini.z), br.mini.yaw, lvl >= 2 ? 6 : 5);
    }
    ctx.restore();
  });
  return <canvas ref={ref} width={size} height={size} className="block" style={{ width: size, height: size }} />;
}

/** the full map: pan with a drag (mouse / touch), zoom with the wheel or a pinch – no on-screen drag handle */
function MapView({ br, game }: { br: BrHudState; game: Game }) {
  const wrap = useRef<HTMLDivElement>(null);
  const cvs = useRef<HTMLCanvasElement>(null);
  const brRef = useRef(br); brRef.current = br;
  const world = game.br!.world, W = world.mapW, lvl = br.mapLevel;
  const st = useRef({ cx: br.mini.x, cz: br.mini.z, scale: 0, w: 800, h: 560, ptr: new Map<number, { x: number; y: number }>(), pd: 0, ps: 0, drag: false, hx: 0, hz: 0, hover: false });
  const [hint, setHint] = useState(true);
  useEffect(() => { const t = window.setTimeout(() => setHint(false), 6000); return () => window.clearTimeout(t); }, []);
  const minScale = (h: number, w: number) => W / Math.min(w, h) * 0.62, maxScale = 3.2;

  useEffect(() => {
    const el = wrap.current!, cv = cvs.current!;
    const s = st.current;
    const resize = () => { const r = el.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); s.w = r.width; s.h = r.height; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px'; if (!s.scale) s.scale = clampN(lvl >= 2 ? 22 : W / Math.min(r.width, r.height) * 0.92, minScale(r.height, r.width), 4000); };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(el);
    const zoomAt = (px: number, py: number, k: number) => { const ns = clampN(s.scale * k, maxScale, W / Math.min(s.w, s.h) * 1.15); s.cx += (px - s.w / 2) * (s.scale - ns); s.cz += (py - s.h / 2) * (s.scale - ns); s.scale = ns; };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(e.deltaY * 0.0016)); };
    cv.addEventListener('wheel', onWheel, { passive: false });
    const key = (e: KeyboardEvent) => {
      const step = s.scale * 40;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') s.cx -= step; else if (e.code === 'ArrowRight' || e.code === 'KeyD') s.cx += step; else if (e.code === 'ArrowUp' || e.code === 'KeyW') s.cz -= step; else if (e.code === 'ArrowDown' || e.code === 'KeyS') s.cz += step;
      else if (e.code === 'Equal' || e.code === 'NumpadAdd') zoomAt(s.w / 2, s.h / 2, 0.8); else if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoomAt(s.w / 2, s.h / 2, 1.25);
      else if (e.code === 'KeyF' || e.code === 'Home') { s.cx = brRef.current.mini.x; s.cz = brRef.current.mini.z; }
    };
    window.addEventListener('keydown', key);
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const b = brRef.current, ctx = cv.getContext('2d')!, dpr = cv.width / s.w;
      const w = s.w, h = s.h, k = 1 / s.scale;
      s.cx = clampN(s.cx, -W / 2, W / 2); s.cz = clampN(s.cz, -W / 2, W / 2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const X = (x: number) => (x - s.cx) * k + w / 2, Y = (z: number) => (z - s.cz) * k + h / 2;
      const detailed = b.mapLevel >= 2;
      ctx.fillStyle = detailed ? '#12324a' : '#0e1a26'; ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      const src = detailed ? world.mapCanvas : world.chartCanvas;
      ctx.drawImage(src, 0, 0, src.width, src.height, X(-W / 2), Y(-W / 2), W * k, W * k);
      // survey grid (1 km) + degree ticks
      ctx.strokeStyle = detailed ? 'rgba(255,255,255,.08)' : 'rgba(80,50,20,.18)'; ctx.lineWidth = 1; ctx.beginPath();
      const g0 = 1000; for (let gx = Math.ceil((s.cx - w * s.scale / 2) / g0) * g0; gx < s.cx + w * s.scale / 2; gx += g0) { ctx.moveTo(X(gx), 0); ctx.lineTo(X(gx), h); }
      for (let gz = Math.ceil((s.cz - h * s.scale / 2) / g0) * g0; gz < s.cz + h * s.scale / 2; gz += g0) { ctx.moveTo(0, Y(gz)); ctx.lineTo(w, Y(gz)); }
      ctx.stroke();
      drawZone(ctx, b, X, Y, k, w, h, 3);
      if (detailed) {
        ctx.textAlign = 'center';
        for (const d of DUNGEONS) { const x = X(d.x), y = Y(d.z); if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue; ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.2832); ctx.fill(); ctx.strokeStyle = d.color; ctx.lineWidth = 2; ctx.stroke(); ctx.font = '12px system-ui'; ctx.fillStyle = '#fff'; ctx.fillText('⛏', x, y + 4.5); if (s.scale < 90) { ctx.font = 'bold 11px system-ui'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(d.name, x, y + 24); ctx.fillStyle = d.color; ctx.fillText(d.name, x, y + 24); } }
        for (const p of POIS) {
          const x = X(p.x), y = Y(p.z);
          if (x < -40 || y < -40 || x > w + 40 || y > h + 40) continue;
          const showName = p.tier >= 2 || s.scale < 70, big = p.tier >= 2;
          const R = Math.max(big ? 11 : 8, (p.r * k) * 0.5);
          ctx.fillStyle = 'rgba(12,10,20,.62)'; ctx.beginPath(); ctx.arc(x, y, Math.min(R, 160), 0, 6.2832); ctx.fill(); ctx.strokeStyle = p.color; ctx.lineWidth = big ? 2.5 : 1.8; ctx.stroke();
          ctx.font = `${big ? 15 : 12}px system-ui`; ctx.fillStyle = '#fff'; ctx.fillText(p.icon, x, y + (big ? 5.5 : 4.4));
          if (showName) { ctx.font = `bold ${big ? 13 : 11}px system-ui`; ctx.lineWidth = 4; ctx.strokeStyle = '#000'; const ty = y + Math.min(R, 160) + 15; ctx.strokeText(p.name, x, ty); ctx.fillStyle = '#fff'; ctx.fillText(p.name, x, ty); if (s.scale < 28) { ctx.font = '10px system-ui'; ctx.fillStyle = '#d8d0b8'; ctx.lineWidth = 3; ctx.strokeText(p.sub, x, ty + 13); ctx.fillText(p.sub, x, ty + 13); } }
        }
      } else {
        ctx.font = 'italic 12px Georgia, serif'; ctx.fillStyle = 'rgba(70,45,20,.7)'; ctx.textAlign = 'center'; ctx.fillText('· uncharted ·', X(0), Y(0) + 4);
      }
      drawMarks(ctx, b, X, Y, w, h, true, s.scale < 14);
      drawArrow(ctx, X(b.mini.x), Y(b.mini.z), b.mini.yaw, 9);
      ctx.beginPath(); ctx.arc(X(b.mini.x), Y(b.mini.z), 14 + Math.sin(performance.now() / 280) * 3, 0, 6.2832); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5; ctx.stroke();
      // scale bar
      const barM = [100, 200, 500, 1000, 2000, 5000].find((m) => m * k > 70) ?? 5000, bw = barM * k;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(14, h - 34, bw + 24, 22); ctx.fillStyle = '#fff'; ctx.fillRect(26, h - 22, bw, 3); ctx.fillRect(26, h - 27, 2, 8); ctx.fillRect(26 + bw - 2, h - 27, 2, 8);
      ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'left'; ctx.fillText(barM >= 1000 ? `${barM / 1000} km` : `${barM} m`, 28, h - 28);
      // compass rose
      const cx = w - 54, cy = 62; ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.arc(0, 0, 34, 0, 6.2832); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.stroke();
      ctx.fillStyle = '#ff6a5a'; ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(6, 0); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#e8e8f0'; ctx.beginPath(); ctx.moveTo(0, 26); ctx.lineTo(6, 0); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill();
      ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText('N', 0, -29); ctx.fillText('S', 0, 37); ctx.fillText('E', 29, 4); ctx.fillText('W', -29, 4); ctx.restore();
    };
    draw();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); cv.removeEventListener('wheel', onWheel); window.removeEventListener('keydown', key); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = st.current;
  const down = (e: React.PointerEvent) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); s.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); s.drag = true; if (s.ptr.size === 2) { const [a, b] = [...s.ptr.values()]; s.pd = Math.hypot(a.x - b.x, a.y - b.y); s.ps = s.scale; } };
  const move = (e: React.PointerEvent) => {
    const p = s.ptr.get(e.pointerId); if (!p) return;
    if (s.ptr.size === 1) { s.cx -= (e.clientX - p.x) * s.scale; s.cz -= (e.clientY - p.y) * s.scale; }
    else if (s.ptr.size === 2) { s.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); const [a, b] = [...s.ptr.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (s.pd > 0) { s.scale = clampN(s.ps * (s.pd / d), maxScale, W / Math.min(s.w, s.h) * 1.15); } }
    s.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const up = (e: React.PointerEvent) => { s.ptr.delete(e.pointerId); if (!s.ptr.size) s.drag = false; };
  const zoomBtn = (k: number) => { s.scale = clampN(s.scale * k, maxScale, W / Math.min(s.w, s.h) * 1.15); };
  const dbl = (e: React.MouseEvent) => { const r = (e.target as HTMLElement).getBoundingClientRect(); const px = e.clientX - r.left, py = e.clientY - r.top; const ns = clampN(s.scale * 0.5, maxScale, 1e5); s.cx += (px - s.w / 2) * (s.scale - ns); s.cz += (py - s.h / 2) * (s.scale - ns); s.scale = ns; };

  return (
    <div ref={wrap} className="absolute inset-0 select-none touch-none">
      <canvas ref={cvs} className="block h-full w-full" style={{ cursor: s.drag ? 'grabbing' : 'grab', touchAction: 'none' }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onDoubleClick={dbl} />
      <div className="pointer-events-auto absolute bottom-3 right-3 flex flex-col gap-1.5">
        {[['+', 0.7, 'Zoom in'], ['−', 1.4, 'Zoom out']].map(([l, k, t]) => <button key={l as string} title={t as string} onClick={() => zoomBtn(k as number)} className="grid h-9 w-9 place-items-center rounded-lg border border-white/25 bg-black/65 text-lg font-black backdrop-blur transition hover:border-yellow-300 hover:text-yellow-200 active:scale-95">{l}</button>)}
        <button title="Center on you" onClick={() => { s.cx = br.mini.x; s.cz = br.mini.z; }} className="grid h-9 w-9 place-items-center rounded-lg border border-white/25 bg-black/65 text-base backdrop-blur transition hover:border-yellow-300 active:scale-95">◎</button>
      </div>
      {hint && <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/20 bg-black/65 px-3 py-1 text-[11px] font-bold tracking-wide text-white/80 backdrop-blur">Drag to explore · scroll / pinch to zoom · double-click to focus · F to recenter</div>}
      <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-white/15 bg-black/55 px-2.5 py-1.5 text-[10px] font-black leading-4 tracking-wider backdrop-blur">
        <div className="text-yellow-300">{lvl >= 2 ? 'GREED ISLAND ATLAS' : 'ISLAND CHART'}</div>
        <div className="text-white/70"><span className="text-white">▬</span> safe zone · <span className="text-yellow-300">┅</span> next · <span className="text-emerald-300">●</span> ally</div>
        {lvl >= 2 && <div className="text-white/70"><span className="text-orange-300">◆</span> rare site · <span className="text-red-300">●</span> revealed · <span className="text-yellow-300">◆</span> drop</div>}
        {lvl < 2 && <div className="text-amber-200/80">An Atlas adds biomes, towns and landmarks</div>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the Binder – a leather-bound book with numbered pockets
function CardTile({ id, n = 1, sel, onClick, empty, no, compact }: { id?: string; n?: number; sel?: boolean; onClick?: () => void; empty?: boolean; no?: number; compact?: boolean }) {
  const c = id ? CARDS[id] : null;
  if (!c || empty) return <div className="grid aspect-[5/7] place-items-center rounded-md border border-dashed border-white/12 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,.05),rgba(0,0,0,.25))] text-[10px] font-black tracking-widest text-white/20">{String(no ?? 0).padStart(3, '0')}</div>;
  const col = RANK_COLOR[c.rank];
  return (
    <button onClick={onClick} className="nb-card group relative aspect-[5/7] overflow-hidden rounded-md border-2 text-center transition duration-150 hover:-translate-y-1 hover:scale-[1.04]" style={{ borderColor: col, background: `radial-gradient(circle at 50% 36%, ${col}77, #120d1e 70%)`, boxShadow: sel ? `0 0 18px ${col}, inset 0 0 12px ${col}66` : `0 2px 6px #0008, 0 0 6px ${col}44` }}>
      <div className="nb-holo absolute inset-0" />
      <div className="absolute left-0.5 top-0.5 z-10 rounded-sm px-1 text-[8px] font-black leading-3 text-black" style={{ background: col }}>{c.rank}</div>
      {n > 1 && <div className="absolute right-0.5 top-0.5 z-10 rounded-sm bg-black/75 px-1 text-[8px] font-black leading-3">×{n}</div>}
      <div className={`relative pt-3 ${compact ? 'text-[20px] leading-6' : 'text-[26px] leading-8'} drop-shadow-[0_2px_4px_rgba(0,0,0,.7)]`}>{c.icon}</div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-black/10 px-0.5 pb-0.5 pt-2 text-[8px] font-extrabold leading-[9px] text-white/95 sm:text-[9px] sm:leading-[10px]">{c.name}</div>
    </button>
  );
}

function Binder({ game, br }: { game: Game; br: BrHudState }) {
  const [tab, setTab] = useState<'spell' | 'spec' | 'info'>('spec');
  const [sel, setSel] = useState<string | null>(null);
  const [tgt, setTgt] = useState('');
  const [page, setPage] = useState(0);
  const [flip, setFlip] = useState(0);
  const card = sel ? CARDS[sel] : null;
  const owned = sel ? (sel[0] === 'p' ? br.spells.find((s) => s.id === sel)?.n : br.spec[sel]) ?? 0 : 0;
  const choose = (id: string) => { setSel(id); setTgt(''); };
  const need = card?.tgt ?? 'none';
  const targets = need === 'met' ? br.met.map((m) => ({ id: m.id, label: m.label, sub: m.sub })) : need === 'town' ? [...(card?.fx?.sp === 'accompany' && br.hasFriends ? [{ id: 'ally', label: 'Teammate', sub: 'fly to your squad' }] : []), ...br.towns.map((t) => ({ id: t.id, label: t.label, sub: 'visited town' }))] : [];
  const canUse = !!card && owned > 0 && card.type !== 'passive' && card.type !== 'collect' && (need === 'none' || need === 'enemy' || tgt !== '' || card.fx?.sp === 'accompany');
  const specIds = useMemo(() => Object.keys(CARDS).filter((k) => k[0] === 's').sort(), []);
  const PER = 20, pages = Math.ceil(specIds.length / PER);
  const goPage = (p: number) => { setPage(clampN(p, 0, pages - 1)); setFlip((f) => f + 1); };
  const close = () => game.toggleBinder();
  const pct = Math.round((br.specCount / specIds.length) * 100);
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 grid place-items-center bg-black/60 p-1 backdrop-blur-[3px] sm:p-3" onClick={close} onContextMenu={(e) => e.preventDefault()}>
      <div className="nb-book relative flex h-[min(700px,96vh)] w-[min(1060px,99vw)] flex-col rounded-[20px] p-2 sm:p-3" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-xl border border-black/60 shadow-[inset_0_0_40px_rgba(0,0,0,.65)] md:flex-row flex-col" style={{ background: 'linear-gradient(90deg,#171024,#1d1530 48%,#0e0a18 50%,#1d1530 52%,#171024)' }}>
          {/* left page: collection + selected card */}
          <section className="relative flex min-h-0 flex-col gap-2 overflow-y-auto border-b border-white/10 p-3 md:w-[42%] md:border-b-0 md:border-r md:border-black/60 md:p-5 [scrollbar-width:thin]">
            <div className="flex items-center gap-3">
              <div className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#ffd23f ${pct * 3.6}deg, rgba(255,255,255,.1) 0)` }}><div className="grid h-[46px] w-[46px] place-items-center rounded-full bg-[#171024] text-[13px] font-black text-yellow-200">{pct}%</div></div>
              <div className="min-w-0">
                <div className="text-[9px] font-black tracking-[0.4em] text-yellow-300">GREED ISLAND</div>
                <div className="text-xl font-black leading-6 tracking-widest sm:text-2xl">CARD BINDER</div>
                <div className="text-[11px] font-bold text-white/55">{br.specCount}/{specIds.length} slots · {br.spellCount}/18 free · luck +{Math.round(br.luck * 100)}%</div>
              </div>
              <div className="ml-auto text-right"><div className="text-lg font-black text-yellow-300">{br.jenny.toLocaleString()}</div><div className="text-[9px] font-black tracking-widest text-white/45">JENNY</div></div>
            </div>
            {card ? (
              <div className="flex gap-3 rounded-xl border p-3" style={{ borderColor: RANK_COLOR[card.rank] + 'aa', background: `linear-gradient(160deg, ${RANK_COLOR[card.rank]}22, transparent)` }}>
                <div className="w-[104px] shrink-0 sm:w-[132px]"><CardTile id={card.id} n={owned} sel /></div>
                <div className="min-w-0 flex-1 text-[12px] leading-[17px]">
                  <b className="block text-[15px] leading-5">{card.name}</b>
                  <span className="inline-block rounded px-1 text-[9px] font-black text-black" style={{ background: RANK_COLOR[card.rank] }}>{card.rank} · {RANK_NAME[card.rank]}</span>
                  <div className="mt-0.5 text-[10px] text-white/45">No.{String(card.no).padStart(card.kind === 'spell' ? 4 : 3, '0')} · limit {card.limit} · {card.kind === 'spell' ? 'SPELL CARD' : card.type === 'passive' ? 'PASSIVE' : card.type === 'creature' ? 'CREATURE' : card.type === 'consume' ? 'CONSUMABLE' : 'COLLECTIBLE'}</div>
                  <div className="mt-1 text-white/80">{card.desc}</div>
                </div>
              </div>
            ) : (
              <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-white/15 p-6 text-center text-[12px] leading-5 text-white/50">Pick a card from the pockets.<br />Say <b className="text-yellow-300">“GAIN”</b> to turn it into its item, or cast spells by name.</div>
            )}
            {card && targets.length > 0 && (
              <div className="flex max-h-[96px] flex-col gap-0.5 overflow-y-auto">
                {targets.map((t) => <button key={t.id} onClick={() => setTgt(t.id)} className="rounded border px-1.5 py-0.5 text-left text-[11px]" style={{ borderColor: tgt === t.id ? '#ffd23f' : 'rgba(255,255,255,.15)', background: tgt === t.id ? 'rgba(255,210,63,.2)' : 'transparent' }}>{t.label} <span className="text-white/40">{t.sub}</span></button>)}
              </div>
            )}
            {card && need === 'met' && !targets.length && <div className="text-[11px] text-red-300">You haven't met anyone yet – get within 45m of other players.</div>}
            {card && need === 'town' && !targets.length && <div className="text-[11px] text-red-300">No visited towns yet.</div>}
            {card && <button disabled={!canUse} onClick={() => game.br?.useCard(card.id, tgt || undefined)} className="rounded-lg py-2 text-[12px] font-black tracking-[0.25em] text-black transition enabled:hover:brightness-110 enabled:active:scale-[.98] disabled:opacity-30" style={{ background: `linear-gradient(135deg, ${RANK_COLOR[card.rank]}, #fff1b0)` }}>{card.type === 'passive' ? 'PASSIVE · ALWAYS ACTIVE' : card.type === 'collect' ? 'COLLECTIBLE · SELL AT A SHOP' : owned <= 0 ? 'NOT OWNED' : card.kind === 'spell' ? 'CAST SPELL' : 'GAIN CARD'}</button>}
            <div className="mt-auto text-[10px] leading-4 text-white/35">You cannot attack while the binder is open. Close it with <b>B</b>. Nothing on this island lies around for free – earn cards from missions, monsters, sealed vaults and rivals.</div>
          </section>
          {/* right page: pockets */}
          <section className="relative flex min-h-0 flex-1 flex-col p-3 md:p-5">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-black tracking-widest">
              {([['spec', '🃏 SPECIFIED'], ['spell', `🔮 FREE ${br.spellCount}/18`], ['info', '📜 MISSIONS']] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className="rounded-t-lg border border-b-0 px-3 py-1.5 transition" style={{ borderColor: tab === k ? '#ffd23f' : 'rgba(255,255,255,.14)', background: tab === k ? 'rgba(255,210,63,.16)' : 'rgba(255,255,255,.03)', color: tab === k ? '#ffe9a0' : undefined }}>{l}</button>)}
              <button onClick={close} className="ml-auto grid h-8 w-8 place-items-center rounded-full border border-white/25 text-sm font-black transition hover:bg-white/10">✕</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/10 bg-black/25 p-2 [scrollbar-width:thin]">
              {tab === 'spec' && (
                <div key={flip} className="nb-flip">
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
                    {specIds.slice(page * PER, page * PER + PER).map((id) => <CardTile key={id} id={id} n={br.spec[id] ?? 0} empty={!br.spec[id]} no={CARDS[id].no} sel={sel === id} onClick={() => choose(id)} compact />)}
                  </div>
                </div>
              )}
              {tab === 'spell' && (br.spells.length ? <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">{br.spells.map((s) => <CardTile key={s.id} id={s.id} n={s.n} sel={sel === s.id} onClick={() => choose(s.id)} compact />)}</div> : <div className="p-6 text-center text-sm text-white/50">No spell cards. Buy a pack in Masadora's Spell Card Shop (10,000 J), win them from NPC missions, or take them from rivals.</div>)}
              {tab === 'info' && (
                <div className="space-y-2 p-1 text-[12px]">
                  {br.quests.length === 0 && <div className="text-white/55">No active missions. Talk to Eta, the Contest Master and Bounty Board in Antokiba, couriers, rangers and elders – cards are the reward for hard tasks.</div>}
                  {br.quests.map((q) => <div key={q.id} className="rounded-lg border border-yellow-300/40 bg-yellow-300/10 p-2"><b className="text-yellow-200">{q.title}</b><div className="text-white/75">{q.desc}</div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full bg-yellow-300" style={{ width: `${(q.prog / q.goal) * 100}%` }} /></div><div className="text-[10px] text-white/50">{q.prog}/{q.goal} · reward: {q.reward}</div></div>)}
                  <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-[11px] leading-4 text-white/70"><b className="text-white">Card ranks:</b> G basic · F/E common · D/C uncommon · B rare · A epic · S legendary · SS mythic. Specified-slot cards are items, creatures and passives; spell cards are single-use tactics. <b className="text-yellow-300">Map cards</b> (Island Chart, Atlas) unlock your map – buy them, loot them, or take them from a rival.</div>
                </div>
              )}
            </div>
            {tab === 'spec' && (
              <div className="mt-2 flex items-center justify-between text-[11px] font-black tracking-widest text-white/60">
                <button onClick={() => goPage(page - 1)} disabled={page === 0} className="rounded-lg border border-white/20 px-3 py-1 transition enabled:hover:bg-white/10 disabled:opacity-30">◀ PREV</button>
                <span>PAGE {page + 1} / {pages} · No.{String(page * PER).padStart(3, '0')}–{String(Math.min(specIds.length - 1, page * PER + PER - 1)).padStart(3, '0')}</span>
                <button onClick={() => goPage(page + 1)} disabled={page >= pages - 1} className="rounded-lg border border-white/20 px-3 py-1 transition enabled:hover:bg-white/10 disabled:opacity-30">NEXT ▶</button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function DialogView({ game, br }: { game: Game; br: BrHudState }) {
  const d = br.dialog!;
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 grid place-items-center overflow-y-auto bg-black/55 p-3 backdrop-blur-[2px]" onClick={() => game.br?.closeDialog()}>
      <div className="nb-panel w-[min(560px,96vw)] rounded-2xl border border-yellow-300/60 bg-[#14101f]/95 p-4 shadow-[0_0_40px_rgba(255,200,60,.2)]" onClick={(e) => e.stopPropagation()}>
        <div className="text-[10px] font-black tracking-[0.4em] text-yellow-300">{d.npc.toUpperCase()}</div>
        <div className="text-xl font-black tracking-wide">{d.title}</div>
        <p className="mt-1 text-[13px] leading-5 text-white/80">{d.text}</p>
        {d.reels && <div className="my-2 flex justify-center gap-2">{d.reels.map((r, i) => <div key={i} className="grid h-16 w-16 place-items-center rounded-xl border-2 border-yellow-300 bg-black text-3xl font-black text-red-400 shadow-[0_0_16px_rgba(255,210,63,.5)]">{r}</div>)}</div>}
        {d.hand && (
          <div className="my-2 space-y-1 text-center text-lg font-black">
            {(['you', 'king'] as const).map((k) => <div key={k}><span className="mr-2 text-[10px] tracking-widest text-white/50">{k.toUpperCase()}</span>{d.hand![k].map((c, i) => <span key={i} className="mx-0.5 rounded bg-white px-1 text-black" style={{ color: /[♥♦]/.test(c) ? '#d02030' : '#111' }}>{c.replace('11', 'J').replace('12', 'Q').replace('13', 'K').replace('14', 'A')}</span>)}</div>)}
          </div>
        )}
        <div className="mt-2 flex max-h-[46vh] flex-col gap-1.5 overflow-y-auto">
          {d.opts.map((o) => <button key={o.id} disabled={o.disabled} onClick={() => game.br?.choose(o.id)} className="rounded-xl border border-white/20 bg-white/[0.05] px-3 py-2 text-left transition hover:border-yellow-300 hover:bg-yellow-300/10 disabled:opacity-35"><div className="text-[13px] font-black">{o.label}</div>{o.sub && <div className="text-[11px] text-white/55">{o.sub}</div>}</button>)}
        </div>
        <button onClick={() => game.br?.closeDialog()} className="mt-2 w-full rounded-lg border border-white/20 py-1 text-[11px] font-black tracking-widest text-white/60 hover:bg-white/10">CLOSE</button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ cinematic overlay (2011-anime style letterbox, location card, speaker plate)
function Cinematic({ br }: { br: BrHudState }) {
  const c = br.cut!;
  const last = c.lines[c.lines.length - 1];
  const typed = useTypewriter(last?.text ?? '', 52);
  const bars = Math.min(1, c.t / 1.2) * Math.min(1, (c.len - c.t) / 1.2);
  const showTitle = last?.title && (last as { t?: number }).t !== undefined ? c.t - ((last as { t?: number }).t ?? 0) < 4 : !!last?.title;
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden font-sans text-white">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.55) 100%)' }} />
      <div className="absolute inset-x-0 top-0 bg-black" style={{ height: `${13 * bars}vh` }} />
      <div className="absolute inset-x-0 bottom-0 bg-black" style={{ height: `${25 * bars}vh` }} />
      {c.scene && <div key={c.scene} className="nb-fade absolute left-[4vw] top-[14.4vh] flex items-center gap-2"><span className="h-6 w-1 bg-yellow-300" /><div><div className="text-[9px] font-black tracking-[0.5em] text-yellow-300/90">HUNTER × HUNTER</div><div className="text-sm font-black tracking-wider sm:text-lg">{c.scene}</div></div></div>}
      {showTitle && last?.title && <div key={last.title} className="nb-title-card absolute inset-x-0 top-[34%] text-center"><div className="nb-title text-5xl font-black tracking-[0.3em] sm:text-7xl">{last.title}</div><div className="mx-auto mt-2 h-px w-[min(520px,70vw)] bg-gradient-to-r from-transparent via-yellow-300 to-transparent" /></div>}
      <div className="absolute inset-x-0 bottom-[3.6vh] mx-auto w-[min(860px,92vw)]">
        {last?.who && <div className="mb-1 inline-flex items-center gap-2 rounded-t-md bg-yellow-300 px-3 py-0.5 text-[11px] font-black tracking-[0.35em] text-black">{last.who.toUpperCase()}</div>}
        <div className="min-h-[3.4em] rounded-md rounded-tl-none border border-white/15 bg-black/70 px-4 py-2.5 text-[13px] font-semibold leading-[1.55] text-white/95 shadow-[0_0_30px_rgba(0,0,0,.6)] backdrop-blur-sm sm:text-[17px]">{typed}<span className="ml-0.5 inline-block w-2 animate-pulse bg-yellow-300">&nbsp;</span></div>
      </div>
      <div className="absolute inset-x-8 bottom-[1.3vh] h-[3px] overflow-hidden rounded-full bg-white/15"><div className="h-full bg-yellow-300" style={{ width: `${(c.t / c.len) * 100}%` }} /></div>
      <div className="absolute bottom-[1vh] right-8 text-[9px] font-black tracking-[0.4em] text-white/40">GAME MASTER BROADCAST</div>
      <div className="absolute inset-0 bg-white" style={{ opacity: c.flash }} />
    </div>
  );
}

export default function BrHud({ game, hud }: { game: Game; hud: HudState }) {
  const br = hud.br!;
  const touch = hud.touch;
  const [hint, setHint] = useState(true);
  useEffect(() => { const t = window.setTimeout(() => setHint(false), 26000); return () => window.clearTimeout(t); }, []);
  const mm = touch ? 112 : 168;
  const z = br.zone;
  if (br.cut) return <Cinematic br={br} />;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 font-sans text-white">
      {!touch && hint && !br.binderOpen && <div className="absolute bottom-[112px] left-1/2 -translate-x-1/2 rounded-lg border border-white/15 bg-black/55 px-3 py-1 text-[11px] font-bold tracking-wide text-white/80 backdrop-blur"><b className="text-yellow-300">B</b> binder · <b className="text-yellow-300">E</b> interact · <b className="text-yellow-300">R</b> heal · <b className="text-yellow-300">M</b> map · <b className="text-yellow-300">Q</b> dash · <b className="text-yellow-300">I / O</b> zoom</div>}
      {br.outside && (
        <>
          <div className="absolute inset-0 animate-pulse" style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(130,40,220,.45) 100%)' }} />
          <div className="absolute left-1/2 top-[13%] -translate-x-1/2 rounded-full border border-fuchsia-300/70 bg-black/70 px-4 py-1 text-center text-[11px] font-black tracking-widest text-fuchsia-200 sm:text-xs">☠ NEN BARRIER · {z.dps.toFixed(1)}% HP/s · RUN TO THE SAFE ZONE ({Math.max(0, Math.round(-br.edge))}m)</div>
        </>
      )}
      {br.warn && <div className="absolute left-1/2 top-[19%] max-w-[90vw] -translate-x-1/2 animate-pulse rounded-lg border border-red-400 bg-red-950/85 px-4 py-1.5 text-center text-xs font-black tracking-wider text-red-200 sm:text-sm">⚠ {br.warn}</div>}

      {/* top-right: stats + minimap */}
      <div className={`absolute flex flex-col items-end gap-1.5 ${touch ? 'right-2 top-[54px]' : 'right-3 top-3'}`}>
        <div className="flex gap-1 text-[11px] font-black sm:text-sm">
          <div className="rounded-lg border border-white/20 bg-black/65 px-2 py-0.5 backdrop-blur">⏱ {fmtT(br.time)}</div>
          <div className="rounded-lg border border-white/20 bg-black/65 px-2 py-0.5 backdrop-blur">👥 <span className="text-yellow-300">{br.format === 'solo' ? br.alive : br.teams}</span><span className="text-[9px] text-white/40">{br.format === 'solo' ? '' : ' teams'}</span></div>
          <div className="rounded-lg border border-white/20 bg-black/65 px-2 py-0.5 backdrop-blur">☠ <span className="text-red-300">{br.kills}</span></div>
        </div>
        <button className="nb-bezel pointer-events-auto relative overflow-hidden rounded-full" onClick={() => game.br?.toggleMap()} style={{ width: mm, height: mm }} title={br.mapLevel ? 'Open map (M)' : 'No map card'}>
          <MiniMap br={br} game={game} size={mm} />
          <span className="pointer-events-none absolute left-1/2 top-0.5 -translate-x-1/2 text-[9px] font-black text-white/80 [text-shadow:0_1px_2px_#000]">N</span>
          {br.mapLevel > 0 && <span className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/55 px-1 text-[8px] font-black tracking-widest text-yellow-200">{br.mapLevel >= 2 ? 'ATLAS' : 'CHART'}</span>}
        </button>
        <div className="max-w-[210px] rounded-lg border border-fuchsia-300/40 bg-black/65 px-2 py-1 text-right text-[10px] font-black leading-3 tracking-wider text-fuchsia-100 backdrop-blur sm:text-[11px]">
          {!z.started ? <>BARRIER RISES IN {fmtT(1200 - br.time)}</> : z.closing ? <>BARRIER CLOSING · {fmtT(z.tNext)}<div className="text-fuchsia-300/70">→ {Math.round(z.nextR)}m</div></> : <>NEXT SHRINK {fmtT(z.tNext)}<div className="text-fuchsia-300/70">→ {Math.round(z.nextR)}m</div></>}
        </div>
      </div>

      {/* left: feed + allies + toasts */}
      <div className={`absolute flex w-[min(280px,44vw)] flex-col gap-0.5 ${touch ? 'left-2 top-[150px] origin-top-left scale-[0.8]' : 'left-3 top-3'}`}>
        {br.allies.length > 0 && <div className="mb-1 space-y-0.5">{br.allies.map((a) => <div key={a.name} className="flex items-center gap-1.5 rounded-md border border-emerald-300/30 bg-black/55 px-1.5 py-0.5 text-[10px] font-black backdrop-blur"><span className="w-20 truncate text-emerald-200">{a.name}</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15"><div className="h-full bg-emerald-400" style={{ width: `${a.alive ? (a.hp / a.maxHp) * 100 : 0}%` }} /></div>{!a.alive && <span className="text-red-300">☠</span>}</div>)}</div>}
        {br.feed.map((f, i) => <div key={i + f.text} className="w-fit max-w-full truncate rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-bold backdrop-blur sm:text-[11px]" style={{ color: f.color }}>{f.text}</div>)}
      </div>
      <div className={`absolute flex flex-col gap-1 ${touch ? 'left-2 top-[46%]' : 'left-3 top-[34%]'}`}>
        {br.toasts.map((t, i) => <div key={i + t.text} className="w-fit max-w-[70vw] animate-[pop_.3s_ease-out] rounded-lg border bg-black/70 px-2.5 py-1 text-[11px] font-black backdrop-blur sm:text-xs" style={{ borderColor: t.color + '99', color: t.color }}>{t.text}</div>)}
      </div>

      {br.boss && (
        <div className="absolute left-1/2 top-[8%] w-[min(520px,56vw)] -translate-x-1/2">
          <div className="mb-0.5 flex justify-between px-1 text-xs font-black tracking-widest text-orange-200 [text-shadow:0_2px_3px_#000]"><span>☠ {br.boss.name.toUpperCase()}</span><span className="text-white/70">{Math.ceil(br.boss.hp)}/{br.boss.maxHp}</span></div>
          <div className="h-3.5 overflow-hidden rounded-md border border-white/30 bg-black/60"><div className="h-full" style={{ width: `${(br.boss.hp / br.boss.maxHp) * 100}%`, background: 'linear-gradient(180deg,#ffa05a,#c2410c)', boxShadow: '0 0 12px rgba(255,120,40,.7)' }} /></div>
        </div>
      )}
      {br.dodge && <div className="absolute left-1/2 top-[8%] -translate-x-1/2 rounded-xl border border-red-300 bg-black/70 px-4 py-1 text-center text-sm font-black tracking-widest text-red-200">🏐 DODGEBALL · {Math.max(0, 40 - br.dodge.t).toFixed(0)}s · {'♥'.repeat(br.dodge.lives)}{'♡'.repeat(3 - br.dodge.lives)}</div>}
      {br.casting && <div className="absolute left-1/2 top-[56%] w-52 -translate-x-1/2 text-center"><div className="text-xs font-black tracking-widest [text-shadow:0_2px_3px_#000]">{br.casting.name.toUpperCase()}</div><div className="mt-0.5 h-2 overflow-hidden rounded-full border border-white/40 bg-black/60"><div className="h-full bg-fuchsia-300" style={{ width: `${Math.min(100, (br.casting.t / br.casting.max) * 100)}%` }} /></div></div>}
      {br.prompt && <div className="absolute left-1/2 top-[66%] -translate-x-1/2 animate-pulse rounded-xl border border-yellow-300/70 bg-black/70 px-4 py-1.5 text-sm font-black tracking-wide backdrop-blur">{touch ? '👆 Tap INTERACT' : <span className="mr-1.5 rounded bg-yellow-300 px-1.5 text-black">{br.prompt.key}</span>} {br.prompt.text}</div>}
      {br.effects.length > 0 && <div className={`absolute flex max-w-[60vw] flex-wrap gap-1 ${touch ? 'left-2 top-[110px]' : 'bottom-[218px] left-4'}`}>{br.effects.map((e) => <div key={e.name} className="relative overflow-hidden rounded-md border border-white/20 bg-black/65 px-1.5 py-0.5 text-[10px] font-black backdrop-blur" style={{ color: e.color }}><div className="absolute inset-y-0 left-0 opacity-25" style={{ width: `${Math.min(100, (e.t / e.max) * 100)}%`, background: e.color }} /><span className="relative">{e.name} {Math.ceil(e.t)}s</span></div>)}</div>}
      {br.trade && (
        <div className="pointer-events-auto absolute bottom-[34%] left-2 w-[min(300px,70vw)] rounded-xl border border-emerald-300/70 bg-black/80 p-2.5 text-xs backdrop-blur sm:left-4">
          <div className="font-black text-emerald-300">🤝 TRADE OFFER · {br.trade.name}</div>
          <div className="mt-0.5 text-white/80">Gives <b style={{ color: RANK_COLOR[CARDS[br.trade.give].rank] }}>{CARDS[br.trade.give].name}</b> for your <b style={{ color: RANK_COLOR[CARDS[br.trade.want].rank] }}>{CARDS[br.trade.want].name}</b></div>
          <div className="mt-1.5 flex gap-1.5"><button onClick={() => game.br?.acceptTrade()} className="flex-1 rounded-lg bg-emerald-400 py-1 font-black text-black">ACCEPT</button><button onClick={() => game.br?.declineTrade()} className="flex-1 rounded-lg border border-white/30 py-1 font-black">DECLINE</button></div>
        </div>
      )}
      {br.esp.map((e, i) => <div key={i} className="absolute -translate-x-1/2 -translate-y-full text-center text-[10px] font-black [text-shadow:0_1px_2px_#000]" style={{ left: `${e.x * 100}%`, top: `${e.y * 100}%`, color: e.color }}>▼<div>{e.name} · {Math.round(e.dist)}m</div></div>)}

      {br.binderOpen && <Binder game={game} br={br} />}
      {br.dialog && <DialogView game={game} br={br} />}
      {br.mapOpen && br.mapLevel > 0 && (
        <div className="pointer-events-auto absolute inset-0 z-40 grid place-items-center bg-black/70 p-2 backdrop-blur-sm sm:p-5" onClick={() => game.br?.toggleMap()}>
          <div className="nb-mapframe relative h-[min(780px,92vh)] w-[min(1180px,97vw)] overflow-hidden rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <MapView br={br} game={game} />
            <button onClick={() => game.br?.toggleMap()} className="pointer-events-auto absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full border border-white/40 bg-black/70 text-sm font-black transition hover:bg-white/15" style={{ right: 100 }}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function BrResults({ hud, onAgain }: { hud: HudState | null; onAgain: () => void }) {
  const r = hud?.br?.result;
  if (!r) return null;
  const rows: [string, string][] = [['Placement', r.victory ? '#1' : `#${r.placement}`], ['Eliminations', String(r.kills)], ['Survived', fmtT(r.time)], ['Cards earned', String(r.cards)], ['Monsters slain', String(r.monsters)], ['Jenny earned', r.jenny.toLocaleString()]];
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-3 font-sans text-white backdrop-blur-sm">
      <div className="nb-panel w-[min(520px,96vw)] rounded-3xl border p-5 text-center" style={{ borderColor: r.victory ? '#ffd23f' : '#ff4d4d', background: 'rgba(12,8,22,.92)', boxShadow: `0 0 60px ${r.victory ? 'rgba(255,210,63,.45)' : 'rgba(255,60,60,.35)'}` }}>
        <div className="text-[10px] font-black tracking-[0.5em] text-white/50">GREED ISLAND · LAST SURVIVOR</div>
        <div className="text-5xl font-black sm:text-6xl" style={{ color: r.victory ? '#ffd23f' : '#ff4d4d', textShadow: '0 4px 0 #000, 0 0 40px currentColor' }}>{r.victory ? 'LAST SURVIVOR' : 'ELIMINATED'}</div>
        <div className="mt-1 text-sm text-white/70">{r.victory ? "You outlasted every hunter on the island – Ruler's Blessing is yours." : `You placed #${r.placement}. Read the island better and try again.`}</div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-left sm:grid-cols-3">{rows.map(([k, v]) => <div key={k} className="rounded-xl border border-white/15 bg-white/5 px-3 py-2"><div className="text-[9px] font-black tracking-widest text-white/45">{k.toUpperCase()}</div><div className="text-lg font-black">{v}</div></div>)}</div>
        <button onClick={onAgain} className="mt-5 rounded-xl border-2 border-black bg-yellow-400 px-10 py-3 text-lg font-black text-black shadow-[0_5px_0_#000] transition hover:bg-yellow-300 active:translate-y-1 active:shadow-none">BACK TO LOBBY</button>
      </div>
    </div>
  );
}
