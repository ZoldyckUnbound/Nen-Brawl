import { useEffect, useRef, useState } from 'react';
import { CHARS } from '../game/chars';
import { ALL_KINDS, cdScale, type PlayableKind } from '../game/defs';

const KEYCAP = ['Z', 'X', 'C', 'V', 'F'];

function Stat({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-white/60">
      <span className="w-12">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(value / max) * 100}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
      </div>
    </div>
  );
}

export default function Menu({
  onPick,
  onHover,
  onSettings,
  onPreview,
  touch = false,
}: {
  onPick: (k: PlayableKind) => void;
  onHover: (k: PlayableKind | null) => void;
  onSettings: () => void;
  onPreview: (k: PlayableKind, i: number, queue?: boolean) => void;
  touch?: boolean;
}) {
  const [sel, setSel] = useState<PlayableKind>('gon');
  const [open, setOpen] = useState<number | null>(null);
  const d = CHARS[sel];
  const dwell = useRef(0);
  useEffect(() => () => window.clearTimeout(dwell.current), []);
  /** hover preview only after a short dwell, so sweeping across skills doesn't trigger a flurry */
  const hoverPreview = (i: number) => {
    window.clearTimeout(dwell.current);
    dwell.current = window.setTimeout(() => onPreview(sel, i, true), 170);
  };

  const choose = (k: PlayableKind) => {
    setSel(k);
    setOpen(null);
    onHover(k);
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const i = ALL_KINDS.indexOf(sel);
      if (e.code === 'ArrowRight' || e.code === 'KeyD') choose(ALL_KINDS[(i + 1) % ALL_KINDS.length]);
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') choose(ALL_KINDS[(i + ALL_KINDS.length - 1) % ALL_KINDS.length]);
      else if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onPick(sel);
      } else if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].includes(e.code)) onPreview(sel, Number(e.code.slice(5)) - 1, false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col font-sans text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_45%,transparent_20%,rgba(0,0,0,.55)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent" />

      <div className="relative flex items-start justify-between px-6 pt-4">
        <div>
          <div className="text-[11px] font-black tracking-[0.55em] text-yellow-300/90">HUNTER × HUNTER · 3D ARENA</div>
          <h1 className="nb-title text-4xl font-black leading-none tracking-wider md:text-6xl">NEN BRAWL</h1>
          <p className="mt-1 hidden text-xs text-white/70 sm:block">Pick a Hunter. Clear the bandits. Beat a random rival in a random arena.</p>
        </div>
        <button
          onClick={onSettings}
          className="pointer-events-auto rounded-xl border border-white/25 bg-black/50 px-4 py-2 text-xs font-black tracking-widest text-white backdrop-blur transition hover:border-yellow-300 hover:text-yellow-200"
        >
          ⚙ SETTINGS
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-start px-6 pt-3">
        <div
          key={sel}
          className="pointer-events-auto nb-panel flex max-h-full w-full max-w-[440px] flex-col max-[900px]:max-w-[min(420px,52vw)] overflow-hidden rounded-2xl border bg-black/65 backdrop-blur-md"
          style={{ borderColor: d.css + '99', boxShadow: `0 0 40px ${d.css}33, inset 0 0 30px ${d.css}11` }}
        >
          <div className="px-4 pt-3" style={{ background: `linear-gradient(180deg, ${d.css}30, transparent)` }}>
            <div className="text-[10px] font-black tracking-[0.35em] text-white/50">{d.typ}</div>
            <div className="text-3xl font-black leading-tight tracking-wide" style={{ color: d.css, textShadow: `0 0 18px ${d.css}88` }}>{d.title}</div>
            <p className="mt-1 text-[13px] leading-[18px] text-white/80">{d.blurb}</p>
            <div className="mt-2 mb-3 space-y-1">
              <Stat label="HEALTH" value={d.hp} max={500} color="#5fe07a" />
              <Stat label="SPEED" value={d.speed} max={12.5} color="#5ac8ff" />
              <Stat label="RANGE" value={d.m1Range} max={5.2} color="#ffc95a" />
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-3 pt-1 [scrollbar-width:thin]">
            <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-[12px] leading-4">
              <b style={{ color: d.css }}>PASSIVE · {d.passive.name}</b>
              <div className="text-white/75">{d.passive.desc}</div>
            </div>
            {d.skills.map((s, i) => (
              <button
                key={s.key}
                onMouseEnter={() => {
                  setOpen(i);
                  if (!touch) hoverPreview(i);
                }}
                onMouseLeave={() => window.clearTimeout(dwell.current)}
                onClick={() => {
                  window.clearTimeout(dwell.current);
                  setOpen(i);
                  onPreview(sel, i, false);
                }}
                className="group flex w-full items-start gap-2 rounded-lg border border-white/10 bg-white/[0.04] p-2 text-left transition hover:bg-white/10"
                style={{ borderColor: open === i ? d.css + 'aa' : undefined }}
              >
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs font-black text-black" style={{ background: d.css }}>{KEYCAP[i]}</span>
                <span className="text-[12px] leading-4">
                  <b className="text-[13px]">{s.name}</b>
                  <span className="ml-1.5 text-white/40">{Math.round(s.cd * cdScale(i) * 10) / 10}s{s.cost ? ` · ${s.cost} energy` : ''}</span>
                  <span className="block text-white/70">{s.desc}</span>
                </span>
              </button>
            ))}
            {d.formSkills && (
              <div className="rounded-lg border p-2 text-[11px] leading-4 text-white/75" style={{ borderColor: d.css + '66', background: d.css + '12' }}>
                <b style={{ color: d.css }}>TRANSFORMED MOVESET</b>
                {d.formSkills.map((s) => (
                  <div key={s.key} className="mt-1">
                    <b className="text-white">{s.key} · {s.name}</b> <span className="text-white/40">{s.cd}s</span>
                    <div className="text-white/65">{s.desc}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => onPick(sel)}
            className="m-3 mt-1 rounded-xl py-3 text-base font-black tracking-[0.25em] text-black transition hover:brightness-110 active:scale-[.98] nb-cta"
            style={{ background: `linear-gradient(135deg, ${d.css}, #fff1b0)` }}
          >
            ▶ FIGHT AS {d.name.toUpperCase()}
          </button>
        </div>

        <div className="ml-auto hidden flex-col items-end gap-1 self-end pb-4 text-right text-[11px] font-bold tracking-wider text-white/60 md:flex">
          <div><b className="text-white">DRAG</b> to rotate the hero</div>
          <div><b className="text-white">CLICK</b> the hero to strike</div>
          <div><b className="text-white">HOVER</b> a skill to preview it</div>
          <div><b className="text-white">← →</b> switch hero · <b className="text-white">ENTER</b> fight</div>
        </div>
      </div>

      <div className="pointer-events-auto relative mx-auto flex w-full max-w-6xl gap-1.5 overflow-x-auto px-3 pb-3 pt-2 [scrollbar-width:none] md:grid md:grid-cols-9 md:overflow-visible">
        {ALL_KINDS.map((k) => {
          const c = CHARS[k];
          const on = sel === k;
          return (
            <button
              key={k}
              onMouseEnter={() => choose(k)}
              onClick={() => (on ? onPick(k) : choose(k))}
              className="pointer-events-auto group relative min-w-[96px] shrink-0 overflow-hidden rounded-lg border bg-black/70 px-2 py-1.5 text-left backdrop-blur transition hover:-translate-y-1 md:min-w-0"
              style={{ borderColor: on ? c.css : 'rgba(255,255,255,.18)', boxShadow: on ? `0 0 18px ${c.css}77` : 'none' }}
            >
              <div className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: c.css, opacity: on ? 1 : 0.35 }} />
              <div className="truncate text-[12px] font-black tracking-wide" style={{ color: c.css }}>{c.name.toUpperCase()}</div>
              <div className="truncate text-[9px] font-bold text-white/50">{c.typ.split(' · ')[0]}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
