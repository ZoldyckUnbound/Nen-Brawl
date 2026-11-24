import { useState } from 'react';
import { CHARS } from '../game/chars';
import { ALL_KINDS, type PlayableKind } from '../game/defs';

export default function Menu({
  onPick,
  onHover,
  onSettings,
}: {
  onPick: (k: PlayableKind) => void;
  onHover: (k: PlayableKind | null) => void;
  onSettings: () => void;
}) {
  const [sel, setSel] = useState<PlayableKind>('gon');
  const d = CHARS[sel];
  return (
    <div className="absolute inset-0 flex flex-col font-sans text-white">
      <div className="pointer-events-none pt-4 text-center">
        <div className="text-xs font-bold tracking-[0.5em] text-yellow-300">NEN BRAWL</div>
        <h1 className="text-4xl font-black tracking-wider md:text-5xl [text-shadow:0_4px_0_#000,0_0_30px_rgba(255,200,60,.7)]">CHOOSE YOUR HUNTER</h1>
        <p className="mt-1 text-sm text-white/90 [text-shadow:0_1px_3px_#000]">Beat the bandits on the island, then fight a random rival in a random arena.</p>
      </div>
      <button
        onClick={onSettings}
        className="absolute right-4 top-4 rounded-lg border-2 border-white/30 bg-black/60 px-3 py-2 text-sm font-black tracking-widest text-white hover:bg-black/80"
      >
        ⚙ SETTINGS
      </button>

      <div className="flex min-h-0 flex-1 items-start px-4 pt-3">
        <div className="max-h-full w-full max-w-[430px] overflow-y-auto rounded-lg border-2 bg-black/70 p-4 backdrop-blur" style={{ borderColor: d.css }}>
          <div className="text-2xl font-black tracking-wide" style={{ color: d.css }}>{d.title}</div>
          <div className="text-xs font-bold text-white/70">{d.typ}</div>
          <div className="mt-1 text-sm text-white/85">{d.blurb}</div>
          <div className="mt-2 rounded border border-white/15 bg-white/5 p-2 text-[12px] leading-4">
            <b style={{ color: d.css }}>PASSIVE · {d.passive.name}</b>
            <div className="text-white/80">{d.passive.desc}</div>
          </div>
          <div className="mt-2 space-y-1 text-[12px]">
            {d.skills.map((s) => (
              <div key={s.key} className="flex gap-1.5">
                <span className="mt-0.5 h-4 w-4 shrink-0 rounded text-center text-[11px] font-black leading-4 text-black" style={{ background: d.css }}>{s.key}</span>
                <span>
                  <b>{s.name}</b> <span className="text-white/45">· {s.cd}s</span>
                  <span className="block leading-4 text-white/70">{s.desc}</span>
                </span>
              </div>
            ))}
          </div>
          {d.formSkills && (
            <div className="mt-2 rounded border border-white/15 bg-white/5 p-2 text-[11px] leading-4 text-white/75">
              <b style={{ color: d.css }}>TRANSFORMED:</b> {d.formSkills.map((s) => `${s.key} ${s.name}`).join(' · ')}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-2 px-3 pb-3 sm:grid-cols-4 lg:grid-cols-7">
        {ALL_KINDS.map((k) => {
          const c = CHARS[k];
          const on = sel === k;
          return (
            <button
              key={k}
              onMouseEnter={() => {
                setSel(k);
                onHover(k);
              }}
              onClick={() => onPick(k)}
              className="group cursor-pointer rounded-lg border-2 bg-black/70 px-3 py-2 text-left backdrop-blur transition hover:-translate-y-1 hover:bg-black/85"
              style={{ borderColor: on ? c.css : 'rgba(255,255,255,.2)', boxShadow: on ? `0 0 18px ${c.css}66` : 'none' }}
            >
              <div className="text-base font-black tracking-wide" style={{ color: c.css }}>{c.name.toUpperCase()}</div>
              <div className="text-[10px] font-bold leading-3 text-white/60">{c.typ}</div>
              <div className="mt-1 text-[10px] font-black text-white/40 group-hover:text-yellow-300">CLICK TO SELECT</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
