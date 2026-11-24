import { useState } from 'react';

export default function Settings({ get, set }: { get: () => number; set: (v: number) => void }) {
  const [v, setV] = useState(get());
  return (
    <div className="rounded-lg border-2 border-white/20 bg-black/60 p-4 text-left">
      <div className="mb-1 flex items-center justify-between text-sm font-black tracking-widest text-yellow-300">
        <span>MOUSE SENSITIVITY</span>
        <span className="text-white">{v.toFixed(2)}x</span>
      </div>
      <input
        type="range"
        min={0.15}
        max={3.5}
        step={0.05}
        value={v}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          setV(n);
          set(n);
        }}
        className="w-full accent-yellow-400"
      />
      <div className="mt-1 flex justify-between text-[10px] font-bold text-white/50">
        <span>SLOW</span>
        <span>FAST</span>
      </div>
      <div className="mt-2 text-[11px] leading-4 text-white/60">Affects both the on-screen cursor speed and camera rotation (right-click drag / Shift Lock).</div>
    </div>
  );
}
