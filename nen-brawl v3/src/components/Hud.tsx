import { useEffect, useRef, useState } from 'react';
import type { HudState } from '../game/Game';
import { CHARS } from '../game/chars';

/** a bar with a lagging "damage" ghost behind the live value */
function Bar({ value, max, from, to, label, h = 18, ghost = false, glow = '' }: { value: number; max: number; from: string; to: string; label: string; h?: number; ghost?: boolean; glow?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const [lag, setLag] = useState(pct);
  const ref = useRef(pct);
  useEffect(() => {
    ref.current = pct;
    if (pct >= lag) {
      setLag(pct);
      return;
    }
    const t = window.setTimeout(() => setLag(ref.current), 380);
    return () => window.clearTimeout(t);
  }, [pct, lag]);
  return (
    <div className="relative w-[320px] max-w-[46vw] overflow-hidden rounded-md border border-white/25 bg-black/60 shadow-lg backdrop-blur-sm" style={{ height: h }}>
      {ghost && <div className="absolute inset-y-0 left-0 bg-white/70 transition-[width] duration-500" style={{ width: `${lag}%` }} />}
      <div className="absolute inset-y-0 left-0 transition-[width] duration-100" style={{ width: `${pct}%`, background: `linear-gradient(180deg, ${from}, ${to})`, boxShadow: glow ? `0 0 12px ${glow}` : undefined }} />
      <div className="absolute inset-x-0 top-0 h-1/2 bg-white/15" />
      <div className="absolute inset-0 flex items-center justify-between px-2 text-[10px] font-black tracking-wider text-white [text-shadow:0_1px_2px_#000]">
        <span>{label}</span>
        <span>{Math.ceil(value)} / {Math.ceil(max)}</span>
      </div>
    </div>
  );
}

function Slot({ k, name, cost, cd, cdMax, charging, accent, afford, wide }: { k: string; name: string; cost?: number; cd: number; cdMax: number; charging?: boolean; accent: string; afford: boolean; wide?: boolean }) {
  const ready = cd <= 0;
  const frac = Math.min(1, cd / Math.max(0.01, cdMax));
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-black/60 text-center backdrop-blur-sm transition-transform ${charging ? 'scale-110' : ''}`}
      style={{
        width: wide ? 64 : 78,
        height: 78,
        borderColor: charging ? '#fff' : ready && afford ? accent : 'rgba(255,255,255,.18)',
        boxShadow: charging ? `0 0 20px ${accent}` : ready && afford ? `0 0 10px ${accent}55, inset 0 0 14px ${accent}22` : 'none',
      }}
    >
      <div className="absolute left-1.5 top-1 grid h-5 min-w-5 place-items-center rounded-md px-1 text-[11px] font-black text-black" style={{ background: ready && afford ? accent : '#777' }}>{k}</div>
      {!!cost && <div className="absolute right-1.5 top-1 text-[10px] font-black text-cyan-300">{cost}</div>}
      <div className="flex h-full items-end justify-center px-1 pb-1.5 text-[10px] font-extrabold leading-[11px] text-white/90">{name}</div>
      {!ready && (
        <>
          <div className="absolute inset-0" style={{ background: `conic-gradient(rgba(0,0,0,0.72) ${frac * 360}deg, transparent 0)` }} />
          <div className="absolute inset-0 grid place-items-center text-xl font-black [text-shadow:0_2px_4px_#000]">{cd < 10 ? cd.toFixed(1) : Math.ceil(cd)}</div>
        </>
      )}
      {ready && !afford && <div className="absolute inset-0 bg-blue-950/60" />}
    </div>
  );
}

export default function Hud({ hud }: { hud: HudState }) {
  const accent = CHARS[hud.kind].css;
  const xpPct = Math.min(100, (hud.xp / hud.xpNeed) * 100);
  const lowHp = hud.hp / hud.maxHp < 0.25;
  const m = hud.meter;
  const [help, setHelp] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setHelp(false), 14000);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === 'KeyH') setHelp((v) => !v);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 font-sans text-white">
      {lowHp && hud.hp > 0 && <div className="absolute inset-0 animate-pulse" style={{ boxShadow: 'inset 0 0 180px 50px rgba(255,0,0,.45)' }} />}

      {hud.rival && (
        <div className="absolute left-1/2 top-4 w-[min(600px,62vw)] -translate-x-1/2">
          <div className="mb-1 flex items-end justify-between px-1 text-sm font-black tracking-[0.2em] [text-shadow:0_2px_3px_#000]">
            <span className="text-red-300">☠ {hud.rival.name.toUpperCase()}</span>
            <span className="text-xs text-white/80">{Math.ceil(hud.rival.hp)} / {Math.ceil(hud.rival.maxHp)}</span>
          </div>
          <div className="relative h-5 overflow-hidden rounded-md border border-white/30 bg-black/60 shadow-xl backdrop-blur-sm">
            <div className="h-full transition-[width] duration-150" style={{ width: `${(hud.rival.hp / hud.rival.maxHp) * 100}%`, background: 'linear-gradient(180deg,#ff7b7b,#b3121f)', boxShadow: '0 0 14px rgba(255,60,60,.7)' }} />
            <div className="absolute inset-x-0 top-0 h-1/2 bg-white/15" />
          </div>
        </div>
      )}

      {hud.quest && (
        <div className="absolute left-4 top-4 w-[250px] overflow-hidden rounded-xl border border-yellow-300/60 bg-black/55 p-2.5 text-sm backdrop-blur-md">
          <div className="text-[10px] font-black tracking-[0.3em] text-yellow-300">{hud.stage === 'arena' ? hud.mapName.toUpperCase() : 'QUEST'}</div>
          <div className="font-bold">{hud.quest.text}</div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/15">
            <div className="h-full bg-yellow-300" style={{ width: `${(hud.quest.progress / Math.max(1, hud.quest.goal)) * 100}%` }} />
          </div>
          <div className="mt-0.5 text-xs text-yellow-100/80">{hud.quest.progress} / {hud.quest.goal}</div>
        </div>
      )}

      <div className="absolute right-4 top-4 max-w-[330px] rounded-xl border border-white/15 bg-black/55 px-3 py-2 text-[11px] leading-[19px] text-white/75 backdrop-blur-md">
        <div className="flex items-center justify-between text-[10px] font-black tracking-[0.3em] text-white/50">
          <span>CONTROLS</span>
          <span>[H] {help ? 'HIDE' : 'SHOW'}</span>
        </div>
        {help && (
          <>
            <div><b className="text-white">WASD</b> move · <b className="text-white">Space</b> jump · <b className="text-white">Q</b> dash</div>
            <div><b className="text-white">Hold Space</b> = higher jump <span className="text-cyan-300">(drains stamina)</span></div>
            <div><b className="text-white">Click</b> combo · <b className="text-white">Z X C V F</b> skills (hold to charge)</div>
            <div><b className="text-white">Right-drag / Shift-lock / ↑↓←→</b> look — full up &amp; down</div>
            <div><b className="text-white">Wheel</b> or <b className="text-white">+ / −</b> zoom · <b className="text-white">Esc</b> pause</div>
          </>
        )}
        <div>Shift-lock: <span style={{ color: hud.shiftLock ? '#7dff7d' : '#ff8a8a' }}>{hud.shiftLock ? 'ON' : 'OFF'}</span></div>
      </div>

      {hud.banner && (
        <div className="absolute left-1/2 top-[22%] -translate-x-1/2 text-center">
          <div className="animate-[pop_.5s_ease-out] text-4xl font-black tracking-wider text-white md:text-6xl [text-shadow:0_4px_0_#000,0_0_30px_rgba(255,200,60,.9)]">{hud.banner}</div>
          {hud.sub && <div className="mt-2 text-lg font-bold text-yellow-200 [text-shadow:0_2px_3px_#000]">{hud.sub}</div>}
        </div>
      )}
      {hud.countdown && (
        <div key={hud.countdown} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-[pop_.5s_ease-out] text-[120px] font-black text-white [text-shadow:0_6px_0_#000,0_0_50px_rgba(255,80,40,.95)]">
          {hud.countdown}
        </div>
      )}

      {hud.charge >= 0 && (
        <div className="absolute left-1/2 top-[62%] -translate-x-1/2">
          <div className="h-3 w-56 overflow-hidden rounded-full border border-white/40 bg-black/60">
            <div className="h-full" style={{ width: `${hud.charge * 100}%`, background: hud.charge >= 1 ? '#ffffff' : accent, boxShadow: hud.charge >= 1 ? '0 0 14px #fff' : `0 0 8px ${accent}` }} />
          </div>
          <div className="mt-0.5 text-center text-[10px] font-black tracking-[0.3em] text-white/85 [text-shadow:0_1px_2px_#000]">{hud.charge >= 1 ? 'FULL CHARGE' : 'CHARGING'}</div>
        </div>
      )}

      {hud.form && (
        <div className="absolute left-1/2 top-[88px] w-[min(400px,50vw)] -translate-x-1/2 text-center">
          <div className="text-xs font-black tracking-[0.35em] [text-shadow:0_1px_3px_#000]" style={{ color: hud.form.kind === 'exhaust' ? '#bbb' : accent }}>{hud.form.name}</div>
          <div className="mt-0.5 h-2 overflow-hidden rounded-full border border-white/30 bg-black/60">
            <div className="h-full" style={{ width: `${(hud.form.t / hud.form.max) * 100}%`, background: hud.form.kind === 'exhaust' ? '#888' : accent, boxShadow: `0 0 10px ${accent}` }} />
          </div>
        </div>
      )}

      <div className="absolute bottom-[110px] left-4 flex flex-col gap-1.5 lg:bottom-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl border-2 text-lg font-black text-black" style={{ background: accent, borderColor: '#fff', boxShadow: `0 0 16px ${accent}` }}>{hud.level}</div>
          <div>
            <div className="text-base font-black tracking-widest [text-shadow:0_2px_3px_#000]" style={{ color: accent }}>{hud.name.toUpperCase()}</div>
            <div className="text-sm font-black text-emerald-300 [text-shadow:0_2px_3px_#000]">${hud.beli.toLocaleString()}{hud.level >= 10 ? ' · MAX' : ''}</div>
          </div>
        </div>
        <div className="h-1.5 w-[320px] max-w-[46vw] overflow-hidden rounded-full border border-white/20 bg-black/70">
          <div className="h-full bg-fuchsia-400 transition-[width] duration-200" style={{ width: `${xpPct}%` }} />
        </div>
        <Bar value={hud.hp} max={hud.maxHp} from="#6dff7f" to="#12a34a" label="HEALTH" h={22} ghost glow="rgba(80,255,120,.5)" />
        <Bar value={hud.energy} max={hud.maxEnergy} from="#59e3ff" to="#0a8fb5" label="STAMINA · ENERGY" h={16} glow="rgba(80,220,255,.4)" />
        <Bar value={m.value} max={m.max} from={m.color} to={m.color + '99'} label={m.name} h={14} glow={m.color + '77'} />
      </div>

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-end gap-2">
        {hud.skills.map((s) => (
          <Slot key={s.key} k={s.key} name={s.name.replace('Jajanken: ', '')} cost={s.cost} cd={s.cd} cdMax={s.cdMax} charging={s.charging} accent={accent} afford={hud.energy >= s.cost} />
        ))}
        <div className="ml-2 flex gap-2">
          <Slot k="Q" name="Dash" cd={hud.dashCd} cdMax={hud.dashMax} accent="#ffffff" afford wide />
          <div
            className="relative grid place-items-center overflow-hidden rounded-xl border bg-black/60 text-center backdrop-blur-sm"
            style={{ width: 64, height: 78, borderColor: hud.shiftLock ? '#7dff7d' : 'rgba(255,255,255,.25)', boxShadow: hud.shiftLock ? '0 0 12px #7dff7d66' : 'none' }}
          >
            <div className="absolute left-1.5 top-1 rounded-md bg-white/80 px-1 text-[9px] font-black text-black">SHIFT</div>
            <div className="pt-4 text-[10px] font-extrabold leading-3">Shift Lock<br /><span style={{ color: hud.shiftLock ? '#7dff7d' : '#ff8a8a' }}>{hud.shiftLock ? 'ON' : 'OFF'}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
