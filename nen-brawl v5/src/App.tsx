import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, type HudState } from './game/Game';
import { ALL_KINDS, type PlayableKind } from './game/defs';
import { CHARS } from './game/chars';
import { initAudio, sfx } from './game/audio';
import { applyBalance } from './game/balance';
import { resolvePlatform, type Platform } from './game/platform';
import { saveProfile } from './game/profile';
import type { Format } from './game/br/mode';
import Hud from './components/Hud';
import BrHud, { BrResults } from './components/BrHud';
import Menu from './components/Menu';
import Settings from './components/Settings';
import MobileControls from './components/MobileControls';

applyBalance();

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
  const [loading, setLoading] = useState(false);
  const [plat, setPlat] = useState<Platform>(() => resolvePlatform());
  const touch = plat === 'mobile';
  const [portrait, setPortrait] = useState(false);
  useEffect(() => {
    const f = () => setPortrait(window.innerHeight > window.innerWidth * 1.05);
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);

  useEffect(() => {
    const game = new Game(canvasRef.current!, overlayRef.current!, {
      onHud: (s) => setHud(s),
      onEnd: (r) => {
        if (document.pointerLockElement) document.exitPointerLock();
        const br = game.br?.result;
        if (game.mode === 'br' && br) {
          saveProfile((p) => { p.brMatches++; p.brKills += br.kills; if (br.victory) p.brWins++; if (!p.brBest || br.placement < p.brBest) p.brBest = br.placement; });
        } else saveProfile((p) => { p.matches++; if (r === 'victory') p.wins++; });
        setPhase(r);
      },
    });
    gameRef.current = game;
    game.setTouch(resolvePlatform() === 'mobile');
    (window as unknown as { __game?: Game }).__game = game;
    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, []);
  useEffect(() => { gameRef.current?.setTouch(touch); }, [touch]);

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

  const pickBR = useCallback((k: PlayableKind, f: Format) => {
    initAudio();
    sfx('ui');
    gameRef.current?.setHover(null);
    gameRef.current?.setMenuInset(0, 0);
    setMine(k);
    setHud(null);
    setLoading(true);
    // let the loading screen paint, then build the island (takes a moment)
    window.setTimeout(() => {
      gameRef.current?.startBR(k, f);
      setPhase('playing');
      setLoading(false);
    }, 90);
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
  const isBR = !!hud?.br;
  const settingsPanel = <Settings {...sens} onPlatform={() => setPlat(resolvePlatform())} />;

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden" />

      {phase === 'playing' && hud && <Hud hud={hud} />}
      {phase === 'playing' && hud && isBR && gameRef.current && <BrHud game={gameRef.current} hud={hud} />}
      {phase === 'playing' && hud && touch && !hud.paused && !hud.br?.cut && gameRef.current && <MobileControls game={gameRef.current} hud={hud} />}
      {phase === 'playing' && hud?.fade && <div className="absolute inset-0 bg-black transition-opacity duration-700" />}

      {phase === 'menu' && (
        <Menu
          onPick={pick}
          onBR={pickBR}
          onHover={(k) => gameRef.current?.setHover(k)}
          onSettings={() => setShowSettings(true)}
          onPreview={(k, i, q) => gameRef.current?.previewSkill(k, i, q)}
          onInset={(x, y) => gameRef.current?.setMenuInset(x, y)}
          touch={touch}
        />
      )}

      {phase === 'menu' && showSettings && (
        <div className="absolute inset-0 z-40 overflow-y-auto bg-black/60 font-sans text-white" onClick={() => setShowSettings(false)}>
          <div className="mx-auto flex min-h-full w-[min(440px,92vw)] items-center py-3">
            <div className="w-full" onClick={(e) => e.stopPropagation()}>
              <div className="mb-2 text-center text-2xl font-black tracking-widest text-yellow-300">SETTINGS</div>
              {settingsPanel}
              <button onClick={() => setShowSettings(false)} className="mt-3 w-full rounded-lg border-2 border-black bg-yellow-400 py-2 text-lg font-black text-black shadow-[0_4px_0_#000] hover:bg-yellow-300">DONE</button>
            </div>
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
          <div className="mt-8 h-8 text-center text-xl font-bold text-white/90">
            {rolling ? 'The computer is choosing its fighter…' : `Your rival is ${CHARS[rival].name.toUpperCase()}! Heading to Bandit Island…`}
          </div>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-black p-4 text-center font-sans text-white">
          <div>
            <div className="text-[10px] font-black tracking-[0.5em] text-fuchsia-300">THE GAME MASTERS ARE BUILDING THE ISLAND</div>
            <div className="nb-title mt-1 text-4xl font-black tracking-widest sm:text-6xl">GREED ISLAND</div>
            <div className="mx-auto mt-4 h-1.5 w-52 overflow-hidden rounded-full bg-white/15"><div className="h-full w-1/2 animate-pulse bg-yellow-300" /></div>
          </div>
        </div>
      )}

      {touch && portrait && phase !== 'victory' && phase !== 'defeat' && (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-50 mx-auto w-fit max-w-[92vw] rounded-full border border-yellow-300/60 bg-black/80 px-4 py-1.5 text-center text-xs font-black tracking-widest text-yellow-200">
          ⟳ ROTATE YOUR DEVICE TO LANDSCAPE FOR THE BEST EXPERIENCE
        </div>
      )}

      {/* start / pause screen – scrolls on narrow phones, splits into two columns on short landscape screens */}
      {phase === 'playing' && hud?.paused && (
        <div className="absolute inset-0 z-40 overflow-y-auto overscroll-contain bg-black/75 font-sans text-white backdrop-blur-[2px]" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
          <div className="mx-auto flex min-h-full w-[min(940px,96vw)] items-center py-3">
            <div className="grid w-full gap-3 text-center [@media(max-height:560px)]:grid-cols-2 [@media(max-height:560px)]:items-center [@media(max-height:560px)]:text-left">
              <div>
                {hud.needLock ? (
                  <>
                    <div className="text-sm font-bold tracking-[0.5em] text-yellow-300">{isBR ? 'GREED ISLAND' : 'BANDIT ISLAND'}</div>
                    <h2 className="mt-1 text-3xl font-black [text-shadow:0_4px_0_#000] sm:text-4xl">{touch ? 'TAP TO ENTER' : 'CLICK TO ENTER'}</h2>
                    {touch ? (
                      <p className="mt-2 text-[13px] leading-5 text-white/80">
                        <b>Left thumb</b>: joystick · <b>Right thumb</b>: drag to look · <b>Buttons</b>: attack, jump, dash, five skills (hold to charge), <b>HEAL</b>{isBR && <>, <b>BINDER</b> and <b>INTERACT</b></>}. Attacks only auto-aim at enemies you are facing — or standing right next to.
                      </p>
                    ) : (
                      <p className="mt-2 text-[13px] leading-5 text-white/80">
                        Your mouse is locked inside the game and replaced by an in-game cursor. Moves go where the cursor points; your hunter turns toward it right before every attack.
                        Hold <b>Right-Click</b> to rotate the camera or press <b>Shift</b> for shift-lock · <b>I / O</b> zoom in / out · <b>R</b> heal{isBR && <> · <b>B</b> binder · <b>E</b> interact · <b>M</b> map</>} · <b>Esc</b> frees your mouse.
                      </p>
                    )}
                  </>
                ) : (
                  <h2 className="text-4xl font-black [text-shadow:0_4px_0_#000]">PAUSED</h2>
                )}
                <div className="mt-3 flex justify-center gap-3 [@media(max-height:560px)]:justify-start">
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
              <div className="mx-auto w-full max-w-[420px] text-left">{settingsPanel}</div>
            </div>
          </div>
        </div>
      )}

      {(phase === 'victory' || phase === 'defeat') && isBR && <BrResults hud={hud} onAgain={again} />}
      {(phase === 'victory' || phase === 'defeat') && !isBR && (
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
