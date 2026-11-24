import type { HudState } from '../game/Game';

function Bar({ value, max, from, to, label }: { value: number; max: number; from: string; to: string; label: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="relative h-7 w-[300px] max-w-[42vw] overflow-hidden rounded-sm border-2 border-black bg-black/70">
      <div className="h-full transition-[width] duration-150" style={{ width: `${pct}%`, background: `linear-gradient(${from},${to})` }} />
      <div className="absolute inset-0 flex items-center justify-center text-[13px] font-extrabold text-white [text-shadow:0_1px_2px_#000,0_0_3px_#000]">
        {label} {Math.ceil(value)}/{Math.ceil(max)}
      </div>
    </div>
  );
}

export default function Hud({ hud }: { hud: HudState }) {
  const accent = hud.kind === 'killua' ? '#8fe3ff' : '#8dff6a';
  const xpPct = Math.min(100, (hud.xp / hud.xpNeed) * 100);
  const lowHp = hud.hp / hud.maxHp < 0.25;

  return (
    <div className="pointer-events-none absolute inset-0 font-sans text-white">
      {/* low hp vignette */}
      {lowHp && hud.hp > 0 && (
        <div className="absolute inset-0 animate-pulse" style={{ boxShadow: 'inset 0 0 160px 40px rgba(255,0,0,.45)' }} />
      )}

      {/* rival boss bar */}
      {hud.rival && (
        <div className="absolute left-1/2 top-4 w-[min(560px,60vw)] -translate-x-1/2">
          <div className="mb-1 flex items-end justify-between text-sm font-black tracking-widest [text-shadow:0_2px_3px_#000]">
            <span className="text-red-400">☠ RIVAL {hud.rival.name.toUpperCase()}</span>
            <span>
              {Math.ceil(hud.rival.hp)} / {Math.ceil(hud.rival.maxHp)}
            </span>
          </div>
          <div className="h-5 overflow-hidden rounded-sm border-2 border-black bg-black/70">
            <div
              className="h-full transition-[width] duration-150"
              style={{ width: `${(hud.rival.hp / hud.rival.maxHp) * 100}%`, background: 'linear-gradient(#ff6b6b,#b3121f)' }}
            />
          </div>
        </div>
      )}

      {/* quest */}
      {hud.quest && (
        <div className="absolute left-4 top-4 w-[250px] rounded border-2 border-yellow-400 bg-black/60 p-2 text-sm">
          <div className="text-xs font-black tracking-widest text-yellow-300">
            {hud.stage === 'arena' ? 'ARENA' : 'QUEST'}
          </div>
          <div className="font-bold">{hud.quest.text}</div>
          <div className="text-yellow-200">
            {hud.quest.progress} / {hud.quest.goal}
          </div>
        </div>
      )}

      {/* controls */}
      <div className="absolute right-4 top-4 rounded bg-black/50 px-3 py-2 text-[11px] leading-5 text-white/80">
        <div><b className="text-white">WASD</b> move · <b className="text-white">Space</b> jump · <b className="text-white">Shift</b> dash</div>
        <div><b className="text-white">Click / J</b> combo · <b className="text-white">Z X C V F</b> moves</div>
        <div><b className="text-white">T</b> lock-on: <span style={{ color: hud.lockOn ? '#7dff7d' : '#ff8a8a' }}>{hud.lockOn ? 'ON' : 'OFF'}</span> · <b className="text-white">P</b> pause</div>
        <div><b className="text-white">Q/E</b> or <b className="text-white">right-drag</b> camera</div>
      </div>

      {/* banner */}
      {hud.banner && (
        <div className="absolute left-1/2 top-[22%] -translate-x-1/2 text-center">
          <div className="text-4xl font-black tracking-wider text-white md:text-5xl [text-shadow:0_3px_0_#000,0_0_20px_rgba(255,200,60,.8)]">
            {hud.banner}
          </div>
          {hud.sub && <div className="mt-2 text-lg font-bold text-yellow-200 [text-shadow:0_2px_3px_#000]">{hud.sub}</div>}
        </div>
      )}
      {hud.countdown && (
        <div
          key={hud.countdown}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-[pop_.5s_ease-out] text-[110px] font-black text-white [text-shadow:0_6px_0_#000,0_0_40px_rgba(255,80,40,.9)]"
        >
          {hud.countdown}
        </div>
      )}

      {/* bottom-left stats (Blox Fruits style) */}
      <div className="absolute bottom-[100px] left-4 flex flex-col gap-1 lg:bottom-4">
        <div className="mb-1 flex items-center gap-3">
          <div className="rounded border-2 border-black bg-yellow-400 px-3 py-0.5 text-sm font-black text-black">
            Lv. {hud.level}
            {hud.level >= 10 ? ' (MAX)' : ''}
          </div>
          <div className="text-xl font-black text-emerald-300 [text-shadow:0_2px_3px_#000]">${hud.beli.toLocaleString()}</div>
        </div>
        <div className="h-2.5 w-[300px] max-w-[42vw] overflow-hidden rounded-sm border border-black bg-black/70">
          <div className="h-full bg-fuchsia-500 transition-[width] duration-200" style={{ width: `${xpPct}%` }} />
        </div>
        <Bar value={hud.hp} max={hud.maxHp} from="#4ade50" to="#16a34a" label="Health" />
        <Bar value={hud.energy} max={hud.maxEnergy} from="#38d9f5" to="#0891b2" label="Energy" />
      </div>

      {/* hotbar */}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
        {hud.skills.map((s) => {
          const ready = s.cd <= 0;
          const afford = hud.energy >= s.cost;
          return (
            <div
              key={s.key}
              className="relative h-[72px] w-[72px] overflow-hidden rounded border-2 bg-black/65 text-center"
              style={{ borderColor: ready && afford ? accent : '#444' }}
            >
              <div className="absolute left-1 top-0.5 text-sm font-black" style={{ color: accent }}>{s.key}</div>
              <div className="absolute right-1 top-1 text-[10px] font-bold text-cyan-300">{s.cost}</div>
              <div className="flex h-full items-center justify-center px-1 pt-3 text-[10px] font-bold leading-[11px]">{s.name.replace('Jajanken: ', '')}</div>
              {!ready && (
                <>
                  <div className="absolute inset-x-0 top-0 bg-black/65" style={{ height: `${(s.cd / s.cdMax) * 100}%` }} />
                  <div className="absolute inset-0 flex items-center justify-center text-xl font-black">{s.cd.toFixed(1)}</div>
                </>
              )}
              {ready && !afford && <div className="absolute inset-0 bg-blue-900/50" />}
            </div>
          );
        })}
        <div className="relative ml-2 h-[72px] w-[72px] overflow-hidden rounded border-2 border-white/40 bg-black/65 text-center">
          <div className="absolute left-1 top-0.5 text-xs font-black text-white">SHIFT</div>
          <div className="flex h-full items-center justify-center pt-3 text-[10px] font-bold">Dash</div>
          {hud.dashCd > 0 && (
            <div className="absolute inset-x-0 top-0 bg-black/65" style={{ height: `${Math.min(100, (hud.dashCd / 1) * 100)}%` }} />
          )}
        </div>
      </div>

      {/* right move list like Blox Fruits */}
      <div className="absolute right-4 top-1/2 hidden w-[250px] -translate-y-1/2 overflow-hidden rounded border-2 border-black bg-black/60 md:block">
        <div className="bg-black/70 py-1 text-center text-lg font-black tracking-widest" style={{ color: accent }}>
          {hud.name.toUpperCase()}
        </div>
        {hud.skills.map((s) => (
          <div
            key={s.key}
            className="flex items-center justify-between border-t border-white/10 px-2 py-1.5 text-[13px] font-bold"
            style={{ opacity: s.cd > 0 ? 0.45 : 1 }}
          >
            <span className="truncate">{s.name}</span>
            <span className="ml-2 rounded px-1.5 text-black" style={{ background: accent }}>{s.key}</span>
          </div>
        ))}
        {hud.buff && <div className="bg-cyan-400/80 py-0.5 text-center text-xs font-black text-black">⚡ GODSPEED ACTIVE</div>}
      </div>

      {/* capture hint */}
      {!hud.locked && !hud.paused && hud.stage !== 'over' && hud.stage !== 'transition' && (
        <div className="absolute bottom-[108px] left-1/2 -translate-x-1/2 rounded bg-black/60 px-3 py-1 text-xs text-white/80">
          Click the game to capture the mouse for camera control
        </div>
      )}

      {hud.paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="text-center">
            <div className="text-6xl font-black">PAUSED</div>
            <div className="mt-2 text-white/70">Press P to resume</div>
          </div>
        </div>
      )}

      {/* teleport fade */}
      <div
        className="absolute inset-0 bg-white transition-opacity duration-700"
        style={{ opacity: hud.fade ? 1 : 0 }}
      />
    </div>
  );
}
