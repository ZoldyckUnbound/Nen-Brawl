import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, type HudState } from './game/Game';
import { ALL_KINDS, type PlayableKind } from './game/defs';
import { CHARS } from './game/chars';
import { initAudio, sfx } from './game/audio';
import Hud from './components/Hud';
import Menu from './components/Menu';
import Settings from './components/Settings';

type Phase = 'menu' | 'roulette' | 'playing' | 'victory' | 'defeat';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [phase, setPhase] = useState<Phase>('menu');
  const [hud, setHud] = useState<HudState | null>(null);
  const [mine, setMine] = useState<PlayableKind>('gon');
  const [rival, setRival] = useState<PlayableKind>('killua');
  const [slot, setSlot] = useState<PlayableKind>('gon');
  const [rolling, setRolling] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

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
    const pool = ALL_KINDS.filter((x) => x !== k);
    const r = pool[Math.floor(Math.random() * pool.length)];
    setMine(k);
    setRival(r);
    setRolling(true);
    setPhase('roulette');
  }, []);

  // computer randomizes its choice (slot-machine style), then the match starts
  useEffect(() => {
    if (phase !== 'roulette') return;
    const total = 20;
    let i = 0;
    let delay = 65;
    let cancelled = false;
    let to = 0;
    const step = () => {
      if (cancelled) return;
      i++;
      const shown = i >= total ? rival : ALL_KINDS[i % ALL_KINDS.length];
      setSlot(shown);
      sfx('ui');
      if (i >= total) {
        setRolling(false);
        to = window.setTimeout(() => {
          if (cancelled) return;
          gameRef.current?.start(mine, rival);
          setPhase('playing');
        }, 2000);
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

  const sens = { get: () => gameRef.current?.getSens() ?? 1, set: (v: number) => gameRef.current?.setSens(v) };

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden" />

      {phase === 'playing' && hud && <Hud hud={hud} />}
      {phase === 'playing' && hud?.fade && <div className="absolute inset-0 bg-black transition-opacity duration-700" />}

      {phase === 'menu' && (
        <Menu onPick={pick} onHover={(k) => gameRef.current?.setHover(k)} onSettings={() => setShowSettings(true)} onPreview={(k, i) => gameRef.current?.previewSkill(k, i)} />
      )}

      {phase === 'menu' && showSettings && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 font-sans text-white" onClick={() => setShowSettings(false)}>
          <div className="w-[min(420px,90vw)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 text-center text-2xl font-black tracking-widest text-yellow-300">SETTINGS</div>
            <Settings {...sens} />
            <button onClick={() => setShowSettings(false)} className="mt-3 w-full rounded-lg border-2 border-black bg-yellow-400 py-2 text-lg font-black text-black shadow-[0_4px_0_#000] hover:bg-yellow-300">
              DONE
            </button>
          </div>
        </div>
      )}

      {phase === 'roulette' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 font-sans text-white backdrop-blur-[2px]">
          <div className="mb-6 text-sm font-bold tracking-[0.5em] text-yellow-300">MATCHMAKING</div>
          <div className="flex items-center gap-6 md:gap-12">
            <div className="text-center">
              <div className="mb-2 text-xs font-bold tracking-widest text-white/60">YOU</div>
              <div className="flex h-32 w-52 items-center justify-center rounded-lg border-4 text-3xl font-black md:h-40 md:w-72 md:text-5xl" style={{ borderColor: CHARS[mine].css, color: CHARS[mine].css, background: 'rgba(0,0,0,.6)' }}>
                {CHARS[mine].name.toUpperCase()}
              </div>
            </div>
            <div className="text-5xl font-black text-red-500 [text-shadow:0_0_20px_#f00]">VS</div>
            <div className="text-center">
              <div className="mb-2 text-xs font-bold tracking-widest text-white/60">COMPUTER</div>
              <div
                className="flex h-32 w-52 items-center justify-center rounded-lg border-4 text-3xl font-black md:h-40 md:w-72 md:text-5xl"
                style={{
                  borderColor: rolling ? '#888' : CHARS[slot].css, color: CHARS[slot].css, background: 'rgba(0,0,0,.6)',
                  boxShadow: rolling ? 'none' : `0 0 40px ${CHARS[slot].css}`, transform: rolling ? 'none' : 'scale(1.08)', transition: 'all .25s',
                }}
              >
                {CHARS[slot].name.toUpperCase()}
              </div>
            </div>
          </div>
          <div className="mt-8 h-8 text-xl font-bold text-white/90">
            {rolling ? 'The computer is choosing its fighter…' : `Your rival is ${CHARS[rival].name.toUpperCase()}! Heading to Bandit Island…`}
          </div>
        </div>
      )}

      {phase === 'playing' && hud?.paused && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 font-sans text-white backdrop-blur-[2px]">
          <div className="w-[min(560px,92vw)] text-center">
            {hud.needLock ? (
              <>
                <div className="text-sm font-bold tracking-[0.5em] text-yellow-300">BANDIT ISLAND</div>
                <h2 className="mt-1 text-4xl font-black [text-shadow:0_4px_0_#000]">CLICK TO ENTER</h2>
                <p className="mt-2 text-sm text-white/80">
                  Your mouse will be locked inside the game and replaced by an in-game cursor. Moves go to the cursor; your character turns toward it when you attack.
                  Hold <b>Right-Click</b> and move to rotate the camera, or press <b>Shift</b> for shift-lock (cursor locked to the centre). <b>Esc</b> frees your mouse.
                </p>
              </>
            ) : (
              <h2 className="text-4xl font-black [text-shadow:0_4px_0_#000]">PAUSED</h2>
            )}
            <div className="mx-auto mt-4 max-w-[420px]">
              <Settings {...sens} />
            </div>
            <div className="mt-4 flex justify-center gap-3">
              <button onClick={() => gameRef.current?.resume()} className="rounded-lg border-2 border-black bg-yellow-400 px-10 py-3 text-xl font-black text-black shadow-[0_5px_0_#000] transition hover:bg-yellow-300 active:translate-y-1 active:shadow-none">
                {hud.needLock ? 'START' : 'RESUME'}
              </button>
              {!hud.needLock && (
                <button onClick={again} className="rounded-lg border-2 border-black bg-white/80 px-6 py-3 text-xl font-black text-black shadow-[0_5px_0_#000] transition hover:bg-white active:translate-y-1 active:shadow-none">
                  QUIT
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {(phase === 'victory' || phase === 'defeat') && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/70 font-sans text-white">
          <div className="text-7xl font-black md:text-8xl" style={{ color: phase === 'victory' ? '#ffd23f' : '#ff4d4d', textShadow: '0 5px 0 #000, 0 0 40px currentColor' }}>
            {phase === 'victory' ? 'VICTORY!' : 'DEFEATED'}
          </div>
          <div className="mt-3 text-lg text-white/80">
            {phase === 'victory' ? `${CHARS[mine].name} conquered the arena.` : `${CHARS[rival].name} was too strong this time. Train harder!`}
          </div>
          <button onClick={again} className="mt-8 rounded-lg border-2 border-black bg-yellow-400 px-10 py-3 text-xl font-black text-black shadow-[0_5px_0_#000] transition hover:bg-yellow-300 active:translate-y-1 active:shadow-none">
            PLAY AGAIN
          </button>
        </div>
      )}
    </div>
  );
}
