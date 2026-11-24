import type { HudState } from '../game/Game';
import { CHARS } from '../game/chars';

function Bar({ value, max, from, to, label, h = 'h-6' }: { value: number; max: number; from: string; to: string; label: string; h?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`relative ${h} w-[300px] max-w-[42vw] overflow-hidden rounded-sm border-2 border-black bg-black/70`}>
      <div className="h-full transition-[width] duration-100" style={{ width: `${pct}%`, background: `linear-gradient(${from},${to})` }} />
      <div className="absolute inset-0 flex items-center justify-center text-[12px] font-extrabold text-white [text-shadow:0_1px_2px_#000,0_0_3px_#000]">
        {label} {Math.ceil(value)}/{Math.ceil(max)}
      </div>
    </div>
  );
}

export default function Hud({ hud }: { hud: HudState }) {
  const accent = CHARS[hud.kind].css;
  const xpPct = Math.min(100, (hud.xp / hud.xpNeed) * 100);
  const lowHp = hud.hp / hud.maxHp < 0.25;
  const m = hud.meter;

  return (
    <div className="pointer-events-none absolute inset-0 font-sans text-white">
      {lowHp && hud.hp > 0 && <div className="absolute inset-0 animate-pulse" style={{ boxShadow: 'inset 0 0 160px 40px rgba(255,0,0,.45)' }} />}

      {hud.rival && (
        <div className="absolute left-1/2 top-4 w-[min(560px,60vw)] -translate-x-1/2">
          <div className="mb-1 flex items-end justify-between text-sm font-black tracking-widest [text-shadow:0_2px_3px_#000]">
            <span className="text-red-400">☠ RIVAL {hud.rival.name.toUpperCase()}</span>
            <span>{Math.ceil(hud.rival.hp)} / {Math.ceil(hud.rival.maxHp)}</span>
          </div>
          <div className="h-5 overflow-hidden rounded-sm border-2 border-black bg-black/70">
            <div className="h-full transition-[width] duration-150" style={{ width: `${(hud.rival.hp / hud.rival.maxHp) * 100}%`, background: 'linear-gradient(#ff6b6b,#b3121f)' }} />
          </div>
        </div>
      )}

      {hud.quest && (
        <div className="absolute left-4 top-4 w-[250px] rounded border-2 border-yellow-400 bg-black/60 p-2 text-sm">
          <div className="text-xs font-black tracking-widest text-yellow-300">{hud.stage === 'arena' ? hud.mapName.toUpperCase() : 'QUEST'}</div>
          <div className="font-bold">{hud.quest.text}</div>
          <div className="text-yellow-200">{hud.quest.progress} / {hud.quest.goal}</div>
        </div>
      )}

      <div className="absolute right-4 top-4 rounded bg-black/55 px-3 py-2 text-[11px] leading-5 text-white/80">
        <div><b className="text-white">WASD</b> move · <b className="text-white">Space</b> jump · <b className="text-white">Q</b> dash</div>
        <div><b className="text-white">Click</b> M1 combo · <b className="text-white">Z X C V F</b> skills (hold = charge)</div>
        <div><b className="text-white">Hold Right-Click</b> rotate camera · <b className="text-white">Wheel</b> zoom</div>
        <div>
          <b className="text-white">Shift</b> shift-lock: <span style={{ color: hud.shiftLock ? '#7dff7d' : '#ff8a8a' }}>{hud.shiftLock ? 'ON' : 'OFF'}</span> · <b className="text-white">Esc</b> menu
        </div>
      </div>

      {hud.banner && (
        <div className="absolute left-1/2 top-[22%] -translate-x-1/2 text-center">
          <div className="text-4xl font-black tracking-wider text-white md:text-5xl [text-shadow:0_3px_0_#000,0_0_20px_rgba(255,200,60,.8)]">{hud.banner}</div>
          {hud.sub && <div className="mt-2 text-lg font-bold text-yellow-200 [text-shadow:0_2px_3px_#000]">{hud.sub}</div>}
        </div>
      )}
      {hud.countdown && (
        <div key={hud.countdown} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-[pop_.5s_ease-out] text-[110px] font-black text-white [text-shadow:0_6px_0_#000,0_0_40px_rgba(255,80,40,.9)]">
          {hud.countdown}
        </div>
      )}

      {hud.charge >= 0 && (
        <div className="absolute left-1/2 top-[62%] -translate-x-1/2">
          <div className="h-3 w-48 overflow-hidden rounded-full border-2 border-black bg-black/60">
            <div className="h-full" style={{ width: `${hud.charge * 100}%`, background: hud.charge >= 1 ? '#ffffff' : accent, boxShadow: hud.charge >= 1 ? '0 0 10px #fff' : 'none' }} />
          </div>
          <div className="mt-0.5 text-center text-[10px] font-black tracking-widest text-white/80 [text-shadow:0_1px_2px_#000]">{hud.charge >= 1 ? 'FULL CHARGE' : 'CHARGING'}</div>
        </div>
      )}

      {hud.form && (
        <div className="absolute left-1/2 top-[88px] w-[min(380px,50vw)] -translate-x-1/2 text-center">
          <div className="text-xs font-black tracking-[0.3em] [text-shadow:0_1px_3px_#000]" style={{ color: hud.form.kind === 'exhaust' ? '#bbb' : accent }}>{hud.form.name}</div>
          <div className="mt-0.5 h-2 overflow-hidden rounded-full border border-black bg-black/60">
            <div className="h-full" style={{ width: `${(hud.form.t / hud.form.max) * 100}%`, background: hud.form.kind === 'exhaust' ? '#888' : accent }} />
          </div>
        </div>
      )}

      <div className="absolute bottom-[104px] left-4 flex flex-col gap-1 lg:bottom-4">
        <div className="mb-0.5 flex items-center gap-3">
          <div className="rounded border-2 border-black bg-yellow-400 px-3 py-0.5 text-sm font-black text-black">
            Lv. {hud.level}
            {hud.level >= 10 ? ' (MAX)' : ''}
          </div>
          <div className="text-lg font-black text-emerald-300 [text-shadow:0_2px_3px_#000]">${hud.beli.toLocaleString()}</div>
          <div className="text-sm font-black tracking-widest" style={{ color: accent }}>{hud.name.toUpperCase()}</div>
        </div>
        <div className="h-2 w-[300px] max-w-[42vw] overflow-hidden rounded-sm border border-black bg-black/70">
          <div className="h-full bg-fuchsia-500 transition-[width] duration-200" style={{ width: `${xpPct}%` }} />
        </div>
        <Bar value={hud.hp} max={hud.maxHp} from="#4ade50" to="#16a34a" label="Health" />
        <Bar value={hud.energy} max={hud.maxEnergy} from="#38d9f5" to="#0891b2" label="Energy" h="h-5" />
        <Bar value={m.value} max={m.max} from={m.color} to={m.color + 'aa'} label={m.name} h="h-5" />
      </div>

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
        {hud.skills.map((s) => {
          const ready = s.cd <= 0;
          const afford = hud.energy >= s.cost;
          return (
            <div
              key={s.key}
              className="relative h-[74px] w-[74px] overflow-hidden rounded border-2 bg-black/65 text-center"
              style={{ borderColor: s.charging ? '#ffffff' : ready && afford ? accent : '#444', boxShadow: s.charging ? `0 0 14px ${accent}` : 'none' }}
            >
              <div className="absolute left-1 top-0.5 text-sm font-black" style={{ color: accent }}>{s.key}</div>
              {s.cost > 0 && <div className="absolute right-1 top-1 text-[10px] font-bold text-cyan-300">{s.cost}</div>}
              <div className="flex h-full items-center justify-center px-1 pt-3 text-[10px] font-bold leading-[11px]">{s.name.replace('Jajanken: ', '')}</div>
              {!ready && (
                <>
                  <div className="absolute inset-x-0 top-0 bg-black/65" style={{ height: `${Math.min(100, (s.cd / Math.max(0.01, s.cdMax)) * 100)}%` }} />
                  <div className="absolute inset-0 flex items-center justify-center text-xl font-black">{s.cd.toFixed(1)}</div>
                </>
              )}
              {ready && !afford && <div className="absolute inset-0 bg-blue-900/50" />}
            </div>
          );
        })}
        <div className="relative ml-2 h-[74px] w-[74px] overflow-hidden rounded border-2 border-white/40 bg-black/65 text-center">
          <div className="absolute left-1 top-0.5 text-xs font-black text-white">Q</div>
          <div className="flex h-full items-center justify-center pt-3 text-[10px] font-bold">Dash</div>
          {hud.dashCd > 0 && <div className="absolute inset-x-0 top-0 bg-black/65" style={{ height: `${Math.min(100, (hud.dashCd / Math.max(0.1, hud.dashMax)) * 100)}%` }} />}
        </div>
        <div
          className="relative h-[74px] w-[74px] overflow-hidden rounded border-2 bg-black/65 text-center"
          style={{ borderColor: hud.shiftLock ? '#7dff7d' : 'rgba(255,255,255,.4)' }}
        >
          <div className="absolute left-1 top-0.5 text-[10px] font-black text-white">SHIFT</div>
          <div className="flex h-full items-center justify-center px-1 pt-3 text-[10px] font-bold leading-3">Shift Lock<br />{hud.shiftLock ? 'ON' : 'OFF'}</div>
        </div>
      </div>
    </div>
  );
}
