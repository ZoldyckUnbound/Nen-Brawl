import { SKILLS } from '../game/skills';
import type { PlayableKind } from '../game/Game';

const INFO: Record<PlayableKind, { name: string; type: string; blurb: string; color: string; border: string }> = {
  killua: {
    name: 'KILLUA ZOLDYCK',
    type: 'Transmutation · Lightning assassin',
    blurb: 'Blazing speed, teleport combos and thunder. Fast, fragile, deadly.',
    color: '#8fe3ff',
    border: 'rgba(143,227,255,.7)',
  },
  gon: {
    name: 'GON FREECSS',
    type: 'Enhancement · Jajanken brawler',
    blurb: 'Raw Nen power. Slower, tougher, and hits like a freight train.',
    color: '#8dff6a',
    border: 'rgba(141,255,106,.7)',
  },
};

export default function Menu({
  onPick,
  onHover,
}: {
  onPick: (k: PlayableKind) => void;
  onHover: (k: PlayableKind | null) => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col font-sans text-white">
      <div className="pointer-events-none pt-5 text-center">
        <div className="text-xs font-bold tracking-[0.5em] text-yellow-300">NEN BRAWL</div>
        <h1 className="text-4xl font-black tracking-wider md:text-6xl [text-shadow:0_4px_0_#000,0_0_30px_rgba(255,200,60,.7)]">
          CHOOSE YOUR HUNTER
        </h1>
        <p className="mt-1 text-sm text-white/90 [text-shadow:0_1px_3px_#000]">
          Beat the bandits, face a randomly chosen rival, then duel in the Heavens Arena.
        </p>
      </div>
      <div className="flex-1" />
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-4 pb-5 md:grid-cols-2">
        {(['killua', 'gon'] as PlayableKind[]).map((k) => {
          const i = INFO[k];
          return (
            <button
              key={k}
              onMouseEnter={() => onHover(k)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onPick(k)}
              className="group cursor-pointer rounded-lg border-2 bg-black/70 p-4 text-left backdrop-blur transition hover:-translate-y-1 hover:bg-black/80"
              style={{ borderColor: i.border }}
            >
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-black tracking-wide" style={{ color: i.color }}>{i.name}</div>
                <div className="rounded px-2 py-0.5 text-xs font-black text-black opacity-0 transition group-hover:opacity-100" style={{ background: i.color }}>
                  CLICK TO SELECT
                </div>
              </div>
              <div className="text-xs font-bold text-white/70">{i.type}</div>
              <div className="mt-1 text-sm text-white/85">{i.blurb}</div>
              <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-[12px] sm:grid-cols-2">
                {SKILLS[k].map((s) => (
                  <div key={s.key} className="flex gap-1.5">
                    <span className="w-4 shrink-0 rounded text-center font-black text-black" style={{ background: i.color }}>{s.key}</span>
                    <span className="font-bold">{s.name}</span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
