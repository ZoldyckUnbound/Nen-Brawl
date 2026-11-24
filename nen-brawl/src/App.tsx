import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, type HudState, type PlayableKind } from './game/Game';
import { initAudio, sfx } from './game/audio';
import Hud from './components/Hud';
import Menu from './components/Menu';

type Phase = 'menu' | 'roulette' | 'playing' | 'victory' | 'defeat';

const NAMES: Record<PlayableKind, string> = { killua: 'KILLUA', gon: 'GON' };
const COLORS: Record<PlayableKind, string> = { killua: '#8fe3ff', gon: '#8dff6a' };

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [phase, setPhase] = useState<Phase>('menu');
  const [hud, setHud] = useState<HudState | null>(null);
  const [mine, setMine] = useState<PlayableKind>('killua');
  const [rival, setRival] = useState<PlayableKind>('gon');
  const [slot, setSlot] = useState<PlayableKind>('killua');
  const [rolling, setRolling] = useState(true);

  useEffect(() => {
    const game = new Game(canvasRef.current!, overlayRef.current!, {
      onHud: (s) => setHud(s),
      onEnd: (r) => {
        if (document.pointerLockElement) document.exitPointerLock();
        setPhase(r);
      },
    });
    gameRef.current = game;
    (window as unknown as { __game?: Game }).__game = game;
    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  const pick = useCallback((k: PlayableKind) => {
    initAudio();
    sfx('ui');
    gameRef.current?.setHover(null);
    const r: PlayableKind = Math.random() < 0.5 ? 'killua' : 'gon';
    setMine(k);
    setRival(r);
    setRolling(true);
    setPhase('roulette');
  }, []);

  // computer randomizes its choice (slot-machine style), then the match starts
  useEffect(() => {
    if (phase !== 'roulette') return;
    const names: PlayableKind[] = ['killua', 'gon'];
    const total = 18;
    let i = 0;
    let delay = 70;
    let cancelled = false;
    let to = 0;
    const step = () => {
      if (cancelled) return;
      i++;
      const shown = i >= total ? rival : names[i % 2];
      setSlot(shown);
      gameRef.current?.setHover(shown);
      sfx('ui');
      if (i >= total) {
        setRolling(false);
        to = window.setTimeout(() => {
          if (cancelled) return;
          gameRef.current?.setHover(null);
          gameRef.current?.start(mine, rival);
          setPhase('playing');
        }, 2400);
        return;
      }
      delay *= 1.1;
      to = window.setTimeout(step, delay);
    };
    to = window.setTimeout(step, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(to);
    };
  }, [phase, mine, rival]);

  const again = () => {
    sfx('ui');
    gameRef.current?.showMenu();
    setHud(null);
    setPhase('menu');
  };

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden" />

      {phase === 'playing' && hud && <Hud hud={hud} />}

      {phase === 'menu' && <Menu onPick={pick} onHover={(k) => gameRef.current?.setHover(k)} />}

      {phase === 'roulette' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 font-sans text-white backdrop-blur-[2px]">
          <div className="mb-6 text-sm font-bold tracking-[0.5em] text-yellow-300">MATCHMAKING</div>
          <div className="flex items-center gap-6 md:gap-12">
            <div className="text-center">
              <div className="mb-2 text-xs font-bold tracking-widest text-white/60">YOU</div>
              <div
                className="flex h-32 w-52 items-center justify-center rounded-lg border-4 text-4xl font-black md:h-40 md:w-72 md:text-5xl"
                style={{ borderColor: COLORS[mine], color: COLORS[mine], background: 'rgba(0,0,0,.6)' }}
              >
                {NAMES[mine]}
              </div>
            </div>
            <div className="text-5xl font-black text-red-500 [text-shadow:0_0_20px_#f00]">VS</div>
            <div className="text-center">
              <div className="mb-2 text-xs font-bold tracking-widest text-white/60">COMPUTER</div>
              <div
                className="flex h-32 w-52 items-center justify-center rounded-lg border-4 text-4xl font-black md:h-40 md:w-72 md:text-5xl"
                style={{
                  borderColor: rolling ? '#888' : COLORS[slot],
                  color: COLORS[slot],
                  background: 'rgba(0,0,0,.6)',
                  boxShadow: rolling ? 'none' : `0 0 40px ${COLORS[slot]}`,
                  transform: rolling ? 'none' : 'scale(1.08)',
                  transition: 'all .25s',
                }}
              >
                {NAMES[slot]}
              </div>
            </div>
          </div>
          <div className="mt-8 h-8 text-xl font-bold text-white/90">
            {rolling ? 'The computer is choosing its fighter…' : `Your rival is ${NAMES[rival]}! Teleporting to the island…`}
          </div>
        </div>
      )}

      {(phase === 'victory' || phase === 'defeat') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 font-sans text-white">
          <div
            className="text-7xl font-black md:text-8xl"
            style={{
              color: phase === 'victory' ? '#ffd23f' : '#ff4d4d',
              textShadow: '0 5px 0 #000, 0 0 40px currentColor',
            }}
          >
            {phase === 'victory' ? 'VICTORY!' : 'DEFEATED'}
          </div>
          <div className="mt-3 text-lg text-white/80">
            {phase === 'victory'
              ? `${NAMES[mine]} conquered the Heavens Arena.`
              : `${NAMES[rival]} was too strong this time. Train harder!`}
          </div>
          <button
            onClick={again}
            className="mt-8 rounded-lg border-2 border-black bg-yellow-400 px-10 py-3 text-xl font-black text-black shadow-[0_5px_0_#000] transition hover:bg-yellow-300 active:translate-y-1 active:shadow-none"
          >
            PLAY AGAIN
          </button>
        </div>
      )}
    </div>
  );
}
