import { useRef, useState, type ReactNode, type PointerEvent as RPE } from 'react';
import type { Game, HudState } from '../game/Game';
import { CHARS } from '../game/chars';

/**
 * Touch layout:
 *  – left thumb: floating joystick
 *  – right thumb: drag anywhere free to rotate the camera
 *  – bottom-right: big attack button, jump and dash
 *  – bottom row: the five skill buttons (hold to charge) with cooldown dials
 *  – the crosshair sits mid-screen and attacks auto-aim at the nearest enemy
 */

function Btn({ onDown, onUp, className = '', style, children }: { onDown?: () => void; onUp?: () => void; className?: string; style?: React.CSSProperties; children: ReactNode }) {
  const [on, setOn] = useState(false);
  return (
    <div
      className={`pointer-events-auto absolute touch-none select-none ${className}`}
      style={{ ...style, transform: on ? 'scale(0.92)' : undefined, transition: 'transform .06s' }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setOn(true);
        onDown?.();
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        setOn(false);
        onUp?.();
      }}
      onPointerCancel={() => {
        setOn(false);
        onUp?.();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
}

export default function MobileControls({ game, hud }: { game: Game; hud: HudState }) {
  const accent = CHARS[hud.kind].css;
  const [stick, setStick] = useState<{ ox: number; oy: number; x: number; y: number } | null>(null);
  const stickId = useRef<number | null>(null);
  const lookId = useRef<number | null>(null);
  const lookPos = useRef({ x: 0, y: 0 });
  const R = 54;

  const stickDown = (e: RPE) => {
    if (stickId.current !== null) return;
    e.preventDefault();
    stickId.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const b = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setStick({ ox: e.clientX - b.left, oy: e.clientY - b.top, x: 0, y: 0 });
  };
  const stickMove = (e: RPE) => {
    if (e.pointerId !== stickId.current || !stick) return;
    const b = (e.currentTarget as HTMLElement).getBoundingClientRect();
    let dx = e.clientX - b.left - stick.ox;
    let dy = e.clientY - b.top - stick.oy;
    const l = Math.hypot(dx, dy);
    if (l > R) {
      dx = (dx / l) * R;
      dy = (dy / l) * R;
    }
    setStick({ ...stick, x: dx, y: dy });
    const nx = dx / R;
    const ny = -dy / R;
    game.touchMoveSet(Math.hypot(nx, ny) < 0.16 ? 0 : nx, Math.hypot(nx, ny) < 0.16 ? 0 : ny);
  };
  const stickUp = (e: RPE) => {
    if (e.pointerId !== stickId.current) return;
    stickId.current = null;
    setStick(null);
    game.touchMoveSet(0, 0);
  };

  const lookDown = (e: RPE) => {
    if (lookId.current !== null) return;
    lookId.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    lookPos.current = { x: e.clientX, y: e.clientY };
  };
  const lookMove = (e: RPE) => {
    if (e.pointerId !== lookId.current) return;
    game.touchLookBy(e.clientX - lookPos.current.x, e.clientY - lookPos.current.y);
    lookPos.current = { x: e.clientX, y: e.clientY };
  };
  const lookUp = (e: RPE) => {
    if (e.pointerId === lookId.current) lookId.current = null;
  };

  return (
    <div className="absolute inset-0 z-40 touch-none select-none" style={{ touchAction: 'none' }} onContextMenu={(e) => e.preventDefault()}>
      {/* movement stick — the whole left third, drawn FIRST so it is above the look layer */}
      <div className="pointer-events-auto absolute bottom-0 left-0 z-10 h-[72%] w-[38%] touch-none" onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp}>
        {!stick && (
          <div className="pointer-events-none absolute bottom-6 left-6 h-[116px] w-[116px] rounded-full border-2 border-white/25 bg-white/5">
            <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-white/15" />
          </div>
        )}
        {stick && (
          <>
            <div className="pointer-events-none absolute h-[116px] w-[116px] rounded-full border-2 border-white/35 bg-white/10" style={{ left: stick.ox - 58, top: stick.oy - 58 }} />
            <div className="pointer-events-none absolute h-14 w-14 rounded-full border-2 border-white/60 bg-white/30 shadow-lg" style={{ left: stick.ox + stick.x - 28, top: stick.oy + stick.y - 28, boxShadow: `0 0 16px ${accent}88` }} />
          </>
        )}
      </div>

      {/* camera look: everything the stick and the button cluster do not own */}
      <div className="pointer-events-auto absolute inset-0 touch-none" onPointerDown={lookDown} onPointerMove={lookMove} onPointerUp={lookUp} onPointerCancel={lookUp} />

      {/* top-right utilities */}
      <div className="pointer-events-none absolute right-3 top-3 flex gap-2">
        {[
          { l: '+', f: () => game.touchZoom(0.82) },
          { l: '−', f: () => game.touchZoom(1.22) },
          { l: 'II', f: () => game.pause() },
        ].map((b) => (
          <button key={b.l} onPointerDown={(e) => { e.stopPropagation(); b.f(); }} className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-black/55 text-sm font-black text-white backdrop-blur active:scale-90">
            {b.l}
          </button>
        ))}
      </div>

      {/* right-hand action cluster */}
      <Btn
        onDown={() => game.touchAttack(true)}
        onUp={() => game.touchAttack(false)}
        className="grid place-items-center rounded-full border-[3px] text-xs font-black tracking-widest text-white"
        style={{ right: 14, bottom: 14, width: 82, height: 82, borderColor: accent, background: `radial-gradient(circle at 35% 30%, ${accent}aa, ${accent}33 70%)`, boxShadow: `0 0 18px ${accent}77` }}
      >
        <span className="[text-shadow:0_2px_3px_#000]">ATTACK</span>
      </Btn>
      <Btn
        onDown={() => game.touchJump(true)}
        onUp={() => game.touchJump(false)}
        className="grid place-items-center rounded-full border-2 border-white/60 bg-black/45 text-[11px] font-black text-white backdrop-blur"
        style={{ right: 106, bottom: 26, width: 60, height: 60 }}
      >
        JUMP
      </Btn>
      <Btn onDown={() => game.touchDash()} className="grid place-items-center rounded-full border-2 border-cyan-200/70 bg-cyan-900/40 text-[10px] font-black text-white backdrop-blur" style={{ right: 28, bottom: 106, width: 54, height: 54 }}>
        <span>DASH</span>
        {hud.dashCd > 0 && (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-black/65 text-sm">{hud.dashCd.toFixed(1)}</span>
        )}
      </Btn>

      {/* heal / binder / interact */}
      <Btn onDown={() => game.touchHeal(true)} onUp={() => game.touchHeal(false)} className="grid place-items-center rounded-full border-2 border-emerald-300/70 bg-emerald-900/45 text-[10px] font-black text-white backdrop-blur" style={{ right: 92, bottom: 98, width: 50, height: 50, boxShadow: hud.heal.active ? '0 0 16px #7dffa0' : undefined }}>
        <span>♥ HEAL</span>
        {hud.heal.cd > 0 && !hud.heal.active && <span className="absolute inset-0 grid place-items-center rounded-full bg-black/65 text-xs">{hud.heal.cd.toFixed(0)}</span>}
      </Btn>
      {hud.br && (
        <Btn onDown={() => game.touchBinder()} className="grid place-items-center rounded-full border-2 border-yellow-300/80 bg-yellow-900/45 text-[10px] font-black text-white backdrop-blur" style={{ right: 148, bottom: 98, width: 50, height: 50, boxShadow: hud.br.binderOpen ? '0 0 16px #ffd23f' : undefined }}>
          <span>📖<br />BINDER</span>
        </Btn>
      )}
      {hud.br?.prompt && (
        <Btn onDown={() => game.touchInteract()} className="z-20 grid animate-pulse place-items-center rounded-full border-[3px] border-yellow-300 bg-yellow-500/55 text-[11px] font-black text-white shadow-[0_0_22px_rgba(255,210,60,.75)] backdrop-blur" style={{ left: 'calc(50% - 38px)', bottom: 118, width: 76, height: 76 }}>
          <span>INTERACT</span>
        </Btn>
      )}

      {/* skills */}
      {hud.skills.map((s, i) => {
        const ready = s.cd <= 0;
        const afford = hud.energy >= s.cost;
        const frac = Math.min(1, s.cd / Math.max(0.01, s.cdMax));
        return (
          <Btn
            key={s.key + s.name}
            onDown={() => game.touchSkill(i, true)}
            onUp={() => game.touchSkill(i, false)}
            className="overflow-hidden rounded-xl border-2 bg-black/60 text-center backdrop-blur"
            style={{
              right: 186 + (4 - i) * 58, bottom: 10, width: 54, height: 62,
              borderColor: s.charging ? '#fff' : ready && afford ? accent : 'rgba(255,255,255,.22)',
              boxShadow: ready && afford ? `0 0 10px ${accent}66` : 'none',
            }}
          >
            <div className="absolute left-1 top-0.5 text-[11px] font-black" style={{ color: ready && afford ? accent : '#888' }}>{s.key}</div>
            {!!s.cost && <div className="absolute right-1 top-0.5 text-[9px] font-black text-cyan-300">{s.cost}</div>}
            <div className="absolute inset-x-0 bottom-0.5 px-0.5 text-[8px] font-extrabold leading-[9px] text-white/90">{s.name.replace('Jajanken: ', '')}</div>
            {!ready && (
              <>
                <div className="absolute inset-0" style={{ background: `conic-gradient(rgba(0,0,0,0.72) ${frac * 360}deg, transparent 0)` }} />
                <div className="absolute inset-0 grid place-items-center text-base font-black [text-shadow:0_2px_4px_#000]">{s.cd < 10 ? s.cd.toFixed(1) : Math.ceil(s.cd)}</div>
              </>
            )}
            {ready && !afford && <div className="absolute inset-0 bg-blue-950/60" />}
          </Btn>
        );
      })}
    </div>
  );
}
