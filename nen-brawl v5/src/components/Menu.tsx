import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CHARS } from '../game/chars';
import { ALL_KINDS, cdScale, type PlayableKind } from '../game/defs';
import { REWORKS } from '../game/balance';
import { getProfile } from '../game/profile';
import type { Format } from '../game/br/mode';

const KEYCAP = ['Z', 'X', 'C', 'V', 'F'];
const TYPE_ICON: Record<string, string> = { Enhancement: '💪', Emission: '📡', Transmutation: '⚡', Conjuration: '🔗', Manipulation: '🧵', Specialist: '🌀' };
const iconOf = (typ: string) => TYPE_ICON[typ.split(' · ')[0]] ?? '✦';

function Stat({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-white/60">
      <span className="w-12">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: `linear-gradient(90deg, ${color}88, ${color})`, boxShadow: `0 0 8px ${color}` }} />
      </div>
    </div>
  );
}

const FORMATS: { id: Format; name: string; sub: string; n: string; icon: string }[] = [
  { id: 'solo', name: 'SOLO', sub: 'Every hunter for themselves', n: '100 players', icon: '👤' },
  { id: 'duos', name: 'DUOS', sub: 'You + 1 AI partner', n: '50 teams of 2', icon: '👥' },
  { id: 'squads', name: 'SQUADS', sub: 'You + 3 AI teammates', n: '25 teams of 4', icon: '🛡️' },
];

export default function Menu({
  onPick, onBR, onHover, onSettings, onPreview, onInset, touch = false,
}: {
  onPick: (k: PlayableKind) => void;
  onBR: (k: PlayableKind, f: Format) => void;
  onHover: (k: PlayableKind | null) => void;
  onSettings: () => void;
  onPreview: (k: PlayableKind, i: number, queue?: boolean) => void;
  onInset: (x: number, y: number) => void;
  touch?: boolean;
}) {
  const [sel, setSel] = useState<PlayableKind>('gon');
  const [open, setOpen] = useState<number | null>(null);
  const [brOpen, setBrOpen] = useState(false);
  const [fmt, setFmt] = useState<Format>('solo');
  const d = CHARS[sel];
  const rw = REWORKS[sel];
  const dwell = useRef(0);
  const panel = useRef<HTMLDivElement>(null);
  const prof = getProfile();
  useEffect(() => () => window.clearTimeout(dwell.current), []);

  const measure = () => {
    const el = panel.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width > window.innerWidth * 0.72) onInset(0, r.height + 56);
    else onInset(r.right + 10, 0);
  };
  useLayoutEffect(() => {
    measure();
    const el = panel.current;
    const ro = el ? new ResizeObserver(measure) : null;
    if (el) ro?.observe(el);
    window.addEventListener('resize', measure);
    const t = window.setTimeout(measure, 120);
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure); window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, open]);
  useEffect(() => () => onInset(0, 0), []);// eslint-disable-line react-hooks/exhaustive-deps

  const hoverPreview = (i: number) => {
    window.clearTimeout(dwell.current);
    dwell.current = window.setTimeout(() => onPreview(sel, i, true), 170);
  };
  const choose = (k: PlayableKind) => { setSel(k); setOpen(null); onHover(k); };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (brOpen) { if (e.code === 'Escape') setBrOpen(false); return; }
      const i = ALL_KINDS.indexOf(sel);
      if (e.code === 'ArrowRight' || e.code === 'KeyD') choose(ALL_KINDS[(i + 1) % ALL_KINDS.length]);
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') choose(ALL_KINDS[(i + ALL_KINDS.length - 1) % ALL_KINDS.length]);
      else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); onPick(sel); }
      else if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].includes(e.code)) onPreview(sel, Number(e.code.slice(5)) - 1, false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col font-sans text-white" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_72%_50%,transparent_18%,rgba(4,4,14,.7)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/85 to-transparent" />
      {Array.from({ length: 14 }).map((_, i) => (
        <span key={i} className="nb-ember" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 0.9) % 7}s`, animationDuration: `${7 + (i % 5)}s`, background: i % 3 ? d.css : '#ffe9a0' }} />
      ))}

      {/* top bar */}
      <header className="relative flex items-start justify-between gap-3 px-3 pt-2 sm:px-6 sm:pt-4">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 48 48" className="h-10 w-10 shrink-0 drop-shadow-[0_0_12px_rgba(255,200,60,.8)] sm:h-14 sm:w-14">
            <polygon points="24,2 44,13 44,35 24,46 4,35 4,13" fill="#12121e" stroke="#ffd23f" strokeWidth="2.5" />
            <path d="M14 34 V14 L34 34 V14" fill="none" stroke="#ffd23f" strokeWidth="4.5" strokeLinejoin="round" />
          </svg>
          <div>
            <div className="text-[9px] font-black tracking-[0.5em] text-yellow-300/90 sm:text-[11px]">HUNTER × HUNTER · 3D ARENA · V5</div>
            <h1 className="nb-title text-3xl font-black leading-none tracking-wider sm:text-5xl md:text-6xl">NEN BRAWL</h1>
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="hidden items-center gap-3 rounded-xl border border-white/15 bg-black/55 px-3 py-1.5 text-[10px] font-black tracking-widest text-white/70 backdrop-blur md:flex">
            <span>🏆 <b className="text-yellow-300">{prof.wins + prof.brWins}</b> WINS</span>
            <span>☠ <b className="text-red-300">{prof.kills + prof.brKills}</b> KOs</span>
            <span>👑 BEST <b className="text-fuchsia-300">{prof.brBest ? '#' + prof.brBest : '—'}</b></span>
          </div>
          <button onClick={onSettings} className="rounded-xl border border-white/25 bg-black/55 px-3 py-2 text-[11px] font-black tracking-widest backdrop-blur transition hover:border-yellow-300 hover:text-yellow-200 sm:px-4">⚙ SETTINGS</button>
        </div>
      </header>

      {/* middle */}
      <main className="relative flex min-h-0 flex-1 items-stretch gap-3 px-3 pb-1 pt-2 sm:px-6 portrait:flex-col portrait:justify-end">
        <section
          ref={panel}
          key={sel}
          className="pointer-events-auto nb-panel flex min-h-0 w-[min(430px,46vw)] max-[900px]:landscape:w-[min(400px,50vw)] flex-col overflow-hidden rounded-2xl border bg-black/60 backdrop-blur-md portrait:max-h-[46vh] portrait:w-full"
          style={{ borderColor: d.css + '99', boxShadow: `0 0 40px ${d.css}33, inset 0 0 30px ${d.css}11` }}
        >
          <div className="px-4 pt-3" style={{ background: `linear-gradient(180deg, ${d.css}30, transparent)` }}>
            <div className="flex items-center gap-2">
              <span className="rounded-md px-1.5 py-0.5 text-[10px] font-black tracking-[0.2em] text-black" style={{ background: d.css }}>{iconOf(d.typ)} {d.typ.split(' · ')[0].toUpperCase()}</span>
              {rw && <span className="rounded-md border border-yellow-300/70 bg-yellow-300/15 px-1.5 py-0.5 text-[10px] font-black tracking-widest text-yellow-200">⚡ REWORKED</span>}
            </div>
            <div className="mt-1 text-[10px] font-black tracking-[0.3em] text-white/45">{d.typ.split(' · ')[1]?.toUpperCase()}</div>
            <div className="text-2xl font-black leading-tight tracking-wide sm:text-3xl" style={{ color: d.css, textShadow: `0 0 18px ${d.css}88` }}>{d.title}</div>
            <p className="mt-1 text-[12px] leading-[17px] text-white/80 sm:text-[13px] sm:leading-[18px]">{d.blurb}</p>
            <div className="mb-3 mt-2 space-y-1">
              <Stat label="HEALTH" value={d.hp} max={560} color="#5fe07a" />
              <Stat label="SPEED" value={d.speed} max={12.8} color="#5ac8ff" />
              <Stat label="RANGE" value={d.m1Range} max={5.2} color="#ffc95a" />
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-3 pt-1 [scrollbar-width:thin]">
            <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-[12px] leading-4">
              <b style={{ color: d.css }}>PASSIVE · {d.passive.name}</b>
              <div className="text-white/75">{d.passive.desc}</div>
            </div>
            <div className="rounded-lg border border-emerald-300/30 bg-emerald-400/10 p-2 text-[11px] leading-4 text-emerald-100/90">
              <b className="text-emerald-300">♥ REGENERATION (all hunters)</b> · <b>{touch ? 'HEAL button' : 'Hold R'}</b>: Blox-style heal-over-time (5.4% HP/s, drains energy). Plus a trickle of regen in fights and <b>Last Resort</b> once below 22% HP.
            </div>
            {rw && (
              <div className="rounded-lg border border-yellow-300/40 bg-yellow-300/10 p-2 text-[11px] leading-4 text-yellow-50/90">
                <b className="text-yellow-300">⚡ REWORK</b>
                {rw.notes.map((n) => <div key={n}>• {n}</div>)}
              </div>
            )}
            {d.skills.map((s, i) => (
              <button
                key={s.key}
                onMouseEnter={() => { setOpen(i); if (!touch) hoverPreview(i); }}
                onMouseLeave={() => window.clearTimeout(dwell.current)}
                onClick={() => { window.clearTimeout(dwell.current); setOpen(i); onPreview(sel, i, false); }}
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
        </section>

        {/* mode cards */}
        <aside className="pointer-events-auto ml-auto flex w-[min(350px,36vw)] flex-col justify-end gap-2 self-end pb-1 portrait:w-full portrait:flex-row portrait:self-auto">
          <div className="mb-1 hidden text-right text-[10px] font-bold leading-4 tracking-wider text-white/55 md:block portrait:hidden">
            <div><b className="text-white">DRAG</b> to rotate · <b className="text-white">CLICK</b> hero to strike</div>
            <div><b className="text-white">← →</b> switch hero · <b className="text-white">ENTER</b> fight</div>
          </div>
          <button onClick={() => onPick(sel)} className="nb-mode group relative overflow-hidden rounded-2xl border bg-black/65 p-3 [@media(max-height:520px)]:p-2 text-left backdrop-blur-md transition hover:-translate-y-0.5 portrait:flex-1" style={{ borderColor: d.css + 'aa', boxShadow: `0 0 24px ${d.css}33` }}>
            <div className="absolute inset-0 opacity-30 transition group-hover:opacity-50" style={{ background: `linear-gradient(120deg, ${d.css}, transparent 70%)` }} />
            <div className="relative flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xl" style={{ background: d.css + '33', border: `1px solid ${d.css}` }}>⚔️</div>
              <div className="min-w-0">
                <div className="text-lg font-black leading-5 tracking-wider">BRAWL <span className="text-[10px] tracking-[0.3em] text-white/50">CLASSIC</span></div>
                <div className="text-[11px] leading-[14px] text-white/70 [@media(max-height:520px)]:hidden">Clear Bandit Island, then duel a random rival in a random arena.</div>
              </div>
            </div>
            <div className="relative mt-2 rounded-lg py-2 text-center text-sm font-black tracking-[0.25em] text-black [@media(max-height:520px)]:mt-1 [@media(max-height:520px)]:py-1 [@media(max-height:520px)]:text-[11px]" style={{ background: `linear-gradient(135deg, ${d.css}, #fff1b0)` }}>▶ FIGHT AS {d.name.toUpperCase()}</div>
          </button>
          <button onClick={() => setBrOpen(true)} className="nb-mode nb-br group relative overflow-hidden rounded-2xl border border-fuchsia-300/80 bg-black/65 p-3 [@media(max-height:520px)]:p-2 text-left backdrop-blur-md transition hover:-translate-y-0.5 portrait:flex-1">
            <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(176,108,255,.55),rgba(255,210,63,.18)_55%,transparent)] opacity-60 transition group-hover:opacity-90" />
            <div className="relative flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-fuchsia-300 bg-fuchsia-400/25 text-2xl">🏝️</div>
              <div className="min-w-0">
                <div className="text-lg font-black leading-5 tracking-wider">GREED ISLAND <span className="rounded bg-yellow-300 px-1 text-[9px] tracking-widest text-black">BETA</span></div>
                <div className="text-[11px] leading-[14px] text-white/75 [@media(max-height:520px)]:hidden">Free-for-all battle royale · 100 hunters · Nen Barrier · card binder · monsters.</div>
              </div>
            </div>
            <div className="relative mt-2 rounded-lg bg-gradient-to-r from-fuchsia-400 to-yellow-200 py-2 text-center text-sm font-black tracking-[0.25em] text-black [@media(max-height:520px)]:mt-1 [@media(max-height:520px)]:py-1 [@media(max-height:520px)]:text-[11px]">🎴 BATTLE ROYALE</div>
          </button>
        </aside>
      </main>

      {/* roster */}
      <footer className="pointer-events-auto relative mx-auto flex w-full max-w-6xl gap-1.5 overflow-x-auto px-3 pb-2 pt-1 [scrollbar-width:none] md:grid md:grid-cols-9 md:overflow-visible">
        {ALL_KINDS.map((k) => {
          const c = CHARS[k];
          const on = sel === k;
          return (
            <button
              key={k}
              onMouseEnter={() => choose(k)}
              onClick={() => (on ? onPick(k) : choose(k))}
              className="group relative min-w-[92px] shrink-0 overflow-hidden rounded-lg border bg-black/70 px-2 py-1.5 text-left backdrop-blur transition hover:-translate-y-1 md:min-w-0"
              style={{ borderColor: on ? c.css : 'rgba(255,255,255,.18)', boxShadow: on ? `0 0 18px ${c.css}77` : 'none', transform: on ? 'translateY(-4px)' : undefined }}
            >
              <div className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: c.css, opacity: on ? 1 : 0.35 }} />
              <div className="flex items-center gap-1.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[13px]" style={{ background: c.css + '33', border: `1px solid ${c.css}88` }}>{iconOf(c.typ)}</span>
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-black leading-3 tracking-wide" style={{ color: c.css }}>{c.name.toUpperCase()}{REWORKS[k] ? ' ⚡' : ''}</div>
                  <div className="truncate text-[9px] font-bold text-white/50">{c.typ.split(' · ')[0]}</div>
                </div>
              </div>
            </button>
          );
        })}
      </footer>

      {/* battle royale lobby */}
      {brOpen && (
        <div className="pointer-events-auto absolute inset-0 z-30 overflow-y-auto bg-black/75 backdrop-blur-sm" onClick={() => setBrOpen(false)}>
          <div className="mx-auto flex min-h-full max-w-3xl items-center p-3">
            <div className="nb-panel relative w-full overflow-hidden rounded-3xl border border-fuchsia-300/70 bg-[#0b0818]/95 p-4 shadow-[0_0_60px_rgba(176,108,255,.45)] sm:p-6" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setBrOpen(false)} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-white/25 text-sm font-black hover:bg-white/10">✕</button>
              <div className="text-[10px] font-black tracking-[0.5em] text-fuchsia-300">GAME MASTERS PRESENT</div>
              <h2 className="nb-title text-3xl font-black tracking-wider sm:text-5xl">GREED ISLAND <span className="align-middle text-sm tracking-widest text-yellow-300">BETA</span></h2>
              <p className="mt-2 text-[13px] leading-5 text-white/75">
                Ging's masterpiece, sealed with Nen. Be teleported by Razor's magic circle to an evenly-spaced spawn on a giant island of towns, monsters and treasure. The <b className="text-fuchsia-300">Game Master's Nen Barrier</b> rises after 1:00 and closes to the Colosseum by 25:00. Loot <b className="text-yellow-300">Specified Slot</b> and <b className="text-yellow-300">Spell</b> cards, open your binder mid-fight, hunt monsters, gamble in Dorias, dodge Razor's balls — and be the last hunter standing.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {FORMATS.map((f) => (
                  <button key={f.id} onClick={() => setFmt(f.id)} className="rounded-xl border p-2 text-center transition sm:p-3" style={{ borderColor: fmt === f.id ? '#ffd23f' : 'rgba(255,255,255,.2)', background: fmt === f.id ? 'linear-gradient(160deg,rgba(255,210,63,.25),rgba(176,108,255,.2))' : 'rgba(255,255,255,.04)', boxShadow: fmt === f.id ? '0 0 20px rgba(255,210,63,.4)' : 'none' }}>
                    <div className="text-2xl">{f.icon}</div>
                    <div className="text-sm font-black tracking-widest">{f.name}</div>
                    <div className="text-[10px] font-bold text-yellow-200">{f.n}</div>
                    <div className="hidden text-[10px] leading-3 text-white/55 sm:block">{f.sub}</div>
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-white/65 sm:grid-cols-4">
                <div><b className="text-white">B</b> binder</div><div><b className="text-white">E</b> interact</div><div><b className="text-white">R</b> heal</div><div><b className="text-white">M</b> map</div>
                <div><b className="text-white">I / O</b> zoom</div><div><b className="text-white">Z X C V F</b> skills</div><div><b className="text-white">Q</b> dash</div><div><b className="text-white">Space</b> jump</div>
              </div>
              <button onClick={() => { setBrOpen(false); onBR(sel, fmt); }} className="nb-cta mt-4 w-full rounded-xl py-3 text-base font-black tracking-[0.25em] text-black transition hover:brightness-110 active:scale-[.98]" style={{ background: `linear-gradient(135deg, ${d.css}, #ffe9a0)` }}>
                🎴 DROP IN AS {d.name.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
