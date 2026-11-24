let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

export function initAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch {
    /* audio unavailable */
  }
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, freq: number, delay = 0) {
  if (!ctx || !master || !noiseBuf) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(master);
  s.start(t);
  s.stop(t + dur + 0.02);
}

export type Sfx = 'hit' | 'heavy' | 'swing' | 'zap' | 'boom' | 'dash' | 'level' | 'ui' | 'death' | 'charge' | 'hurt';

export function sfx(name: Sfx) {
  if (!ctx) return;
  switch (name) {
    case 'hit':
      noise(0.1, 0.5, 900);
      tone(180, 0.1, 'square', 0.15, 80);
      break;
    case 'hurt':
      noise(0.14, 0.5, 600);
      tone(140, 0.16, 'sawtooth', 0.15, 60);
      break;
    case 'heavy':
      noise(0.3, 0.8, 300);
      tone(110, 0.3, 'sawtooth', 0.3, 40);
      break;
    case 'swing':
      noise(0.12, 0.25, 2200);
      break;
    case 'zap':
      tone(900, 0.25, 'sawtooth', 0.15, 120);
      noise(0.25, 0.3, 4000);
      break;
    case 'boom':
      noise(0.7, 1, 180);
      tone(70, 0.6, 'sine', 0.5, 30);
      break;
    case 'dash':
      noise(0.18, 0.3, 1500);
      tone(300, 0.15, 'sine', 0.1, 900);
      break;
    case 'charge':
      tone(120, 0.5, 'sawtooth', 0.12, 500);
      break;
    case 'level':
      tone(520, 0.15, 'square', 0.12);
      tone(660, 0.15, 'square', 0.12, undefined, 0.12);
      tone(880, 0.3, 'square', 0.12, undefined, 0.24);
      break;
    case 'ui':
      tone(700, 0.08, 'square', 0.1);
      break;
    case 'death':
      tone(300, 0.6, 'sawtooth', 0.2, 40);
      break;
  }
}
