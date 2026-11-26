import { useState } from 'react';
import { getVolumes, setVolumes } from '../game/audio';

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

export default function Settings({ get, set }: { get: () => number; set: (v: number) => void }) {
  const [v, setV] = useState(get());
  const [vol, setVol] = useState(getVolumes());
  return (
    <div className="rounded-2xl border border-white/20 bg-black/75 p-5 text-left backdrop-blur-md">
      <Slider label="MOUSE SENSITIVITY" value={v} min={0.15} max={3.5} step={0.05} fmt={(x) => `${x.toFixed(2)}x`} onChange={(n) => { setV(n); set(n); }} />
      <Slider label="MUSIC" value={vol.music} min={0} max={1} step={0.05} fmt={(x) => `${Math.round(x * 100)}%`} onChange={(n) => { setVol({ ...vol, music: n }); setVolumes(undefined, n); }} />
      <Slider label="SOUND EFFECTS" value={vol.sfx} min={0} max={1} step={0.05} fmt={(x) => `${Math.round(x * 100)}%`} onChange={(n) => { setVol({ ...vol, sfx: n }); setVolumes(n); }} />
      <div className="text-[11px] leading-4 text-white/60">Sensitivity affects the cursor and camera rotation (right-click drag / Shift Lock).</div>
    </div>
  );
}
