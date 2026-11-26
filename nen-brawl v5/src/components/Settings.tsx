import { useState } from 'react';
import { getVolumes, setVolumes } from '../game/audio';
import { detectPlatform, getPref, setPref, type PlatformPref } from '../game/platform';

function Slider({ label, value, min, max, step, fmt, onChange }: { label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between text-xs font-black tracking-widest text-yellow-300">
        <span>{label}</span>
        <span className="text-white">{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full accent-yellow-400" />
    </div>
  );
}

export default function Settings({ get, set, onPlatform }: { get: () => number; set: (v: number) => void; onPlatform?: () => void }) {
  const [v, setV] = useState(get());
  const [vol, setVol] = useState(getVolumes());
  const [pref, setP] = useState<PlatformPref>(getPref());
  const detected = detectPlatform();
  return (
    <div className="rounded-2xl border border-white/20 bg-black/75 p-4 text-left backdrop-blur-md sm:p-5">
      <div className="mb-3">
        <div className="mb-1 text-xs font-black tracking-widest text-yellow-300">CONTROLS <span className="font-bold text-white/50">· detected: {detected === 'pc' ? 'PC (mouse + keyboard)' : 'Mobile (touch)'}</span></div>
        <div className="grid grid-cols-3 gap-1.5">
          {(['auto', 'pc', 'mobile'] as PlatformPref[]).map((p) => (
            <button key={p} onClick={() => { setPref(p); setP(p); onPlatform?.(); }} className="rounded-lg border py-1.5 text-[11px] font-black tracking-widest transition" style={{ borderColor: pref === p ? '#ffd23f' : 'rgba(255,255,255,.2)', background: pref === p ? 'rgba(255,210,63,.2)' : 'transparent', color: pref === p ? '#ffe9a0' : '#fff' }}>
              {p === 'auto' ? 'AUTO' : p === 'pc' ? '🖱 PC' : '📱 MOBILE'}
            </button>
          ))}
        </div>
      </div>
      <Slider label="SENSITIVITY" value={v} min={0.15} max={3.5} step={0.05} fmt={(x) => `${x.toFixed(2)}x`} onChange={(n) => { setV(n); set(n); }} />
      <Slider label="MUSIC" value={vol.music} min={0} max={1} step={0.05} fmt={(x) => `${Math.round(x * 100)}%`} onChange={(n) => { setVol({ ...vol, music: n }); setVolumes(undefined, n); }} />
      <Slider label="SOUND EFFECTS" value={vol.sfx} min={0} max={1} step={0.05} fmt={(x) => `${Math.round(x * 100)}%`} onChange={(n) => { setVol({ ...vol, sfx: n }); setVolumes(n); }} />
      <div className="text-[11px] leading-4 text-white/60">PC: your mouse is locked into the game and replaced by an in-game cursor — moves fire where it points and your hunter turns toward it right before every attack. <b className="text-white">I / O</b> zoom in / out, <b className="text-white">Shift</b> toggles shift-lock, <b className="text-white">R</b> heals.</div>
    </div>
  );
}
