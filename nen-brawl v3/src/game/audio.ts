/**
 * Procedural audio engine (WebAudio): layered, reverbed sound effects plus a
 * step-sequenced battle-music engine (menu / island / arena / victory / defeat).
 * Everything is synthesised at runtime – no external files, works offline.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musBus: GainNode | null = null;
let reverbIn: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let sfxVol = 0.9;
let musVol = 0.55;
let pendingMode: MusicMode | null = null;

try {
  const a = parseFloat(localStorage.getItem('nenbrawl.sfx') || '');
  const b = parseFloat(localStorage.getItem('nenbrawl.music') || '');
  if (a >= 0 && a <= 1) sfxVol = a;
  if (b >= 0 && b <= 1) musVol = b;
} catch { /* ignore */ }

export function initAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 12;
      comp.ratio.value = 5;
      comp.attack.value = 0.004;
      comp.release.value = 0.18;
      master = ctx.createGain();
      master.gain.value = 0.7;
      master.connect(comp);
      comp.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = sfxVol;
      sfxBus.connect(master);
      musBus = ctx.createGain();
      musBus.gain.value = musVol * 0.6;
      musBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // convolution reverb from a decaying noise impulse
      const len = Math.floor(ctx.sampleRate * 1.7);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const dd = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
      const conv = ctx.createConvolver();
      conv.buffer = ir;
      reverbIn = ctx.createGain();
      reverbIn.gain.value = 0.32;
      reverbIn.connect(conv);
      conv.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (pendingMode) {
      const m = pendingMode;
      pendingMode = null;
      setMusic(m);
    }
  } catch {
    /* audio unavailable */
  }
}

export function setVolumes(sfx?: number, music?: number) {
  if (sfx !== undefined) {
    sfxVol = sfx;
    if (sfxBus) sfxBus.gain.value = sfx;
    try { localStorage.setItem('nenbrawl.sfx', String(sfx)); } catch { /* ignore */ }
  }
  if (music !== undefined) {
    musVol = music;
    if (musBus) musBus.gain.value = music * 0.6;
    try { localStorage.setItem('nenbrawl.music', String(music)); } catch { /* ignore */ }
  }
}
export const getVolumes = () => ({ sfx: sfxVol, music: musVol });

// ------------------------------------------------------------------ primitives
type Dest = AudioNode | null;
function tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0, rev = 0, dest: Dest = null, lp = 0) {
  if (!ctx || !master || !sfxBus) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let n: AudioNode = o;
  if (lp) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lp;
    o.connect(f);
    n = f;
  }
  n.connect(g);
  g.connect(dest ?? sfxBus);
  if (rev && reverbIn) {
    const s = ctx.createGain();
    s.gain.value = rev;
    g.connect(s);
    s.connect(reverbIn);
  }
  o.start(t);
  o.stop(t + dur + 0.03);
}
function noise(dur: number, vol: number, freq: number, delay = 0, type: BiquadFilterType = 'bandpass', slideTo?: number, q = 1, rev = 0, dest: Dest = null) {
  if (!ctx || !master || !noiseBuf || !sfxBus) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(dest ?? sfxBus);
  if (rev && reverbIn) {
    const r = ctx.createGain();
    r.gain.value = rev;
    g.connect(r);
    r.connect(reverbIn);
  }
  s.start(t, Math.random());
  s.stop(t + dur + 0.03);
}

export type Sfx = 'hit' | 'heavy' | 'swing' | 'zap' | 'boom' | 'dash' | 'level' | 'ui' | 'death' | 'charge' | 'hurt' | 'slash' | 'thunder' | 'chain' | 'card' | 'smoke';
const lastPlay: Record<string, number> = {};
export function sfx(name: Sfx) {
  if (!ctx) return;
  const now = ctx.currentTime;
  if (now - (lastPlay[name] ?? -1) < 0.025) return; // avoid stacking identical sounds in one frame
  lastPlay[name] = now;
  const j = 0.92 + Math.random() * 0.16;
  switch (name) {
    case 'hit':
      noise(0.09, 0.55, 1500 * j, 0, 'bandpass', 600, 0.9);
      noise(0.12, 0.5, 260, 0, 'lowpass');
      tone(190 * j, 0.1, 'square', 0.16, 70);
      tone(2400, 0.03, 'square', 0.05);
      break;
    case 'hurt':
      noise(0.16, 0.55, 700, 0, 'bandpass', 250, 0.8);
      noise(0.2, 0.45, 220, 0, 'lowpass');
      tone(150 * j, 0.18, 'sawtooth', 0.15, 55);
      break;
    case 'heavy':
      tone(95 * j, 0.45, 'sine', 0.8, 32, 0, 0.25);
      noise(0.4, 0.85, 700, 0, 'lowpass', 120, 0.7, 0.2);
      noise(0.1, 0.5, 3500, 0, 'highpass');
      tone(210, 0.2, 'sawtooth', 0.2, 60);
      break;
    case 'swing':
      noise(0.17, 0.3, 700 * j, 0, 'bandpass', 3600, 1.4);
      noise(0.1, 0.12, 5200, 0.03, 'highpass');
      break;
    case 'slash':
      noise(0.2, 0.4, 900, 0, 'bandpass', 5200, 1.6);
      noise(0.14, 0.3, 6000, 0.02, 'highpass');
      tone(3100 * j, 0.22, 'triangle', 0.07, 2600, 0.03, 0.15);
      tone(4700 * j, 0.18, 'triangle', 0.05, 4200, 0.03, 0.15);
      break;
    case 'zap':
      tone(1500 * j, 0.28, 'sawtooth', 0.17, 90, 0, 0.1);
      for (let i = 0; i < 4; i++) noise(0.04, 0.35, 5000 + i * 600, i * 0.045, 'highpass');
      tone(60, 0.25, 'sine', 0.3, 40);
      break;
    case 'thunder':
      noise(0.9, 0.9, 1800, 0, 'lowpass', 90, 0.8, 0.45);
      tone(1400, 0.4, 'sawtooth', 0.22, 50, 0, 0.2);
      tone(70, 0.8, 'sine', 0.7, 28, 0.04, 0.3);
      for (let i = 0; i < 5; i++) noise(0.05, 0.5, 6000, i * 0.06, 'highpass');
      break;
    case 'boom':
      tone(88 * j, 1.0, 'sine', 0.95, 26, 0, 0.5);
      noise(1.1, 0.95, 500, 0, 'lowpass', 70, 0.7, 0.6);
      noise(0.15, 0.6, 3000, 0, 'highpass');
      tone(160, 0.35, 'sawtooth', 0.22, 40, 0, 0.3);
      break;
    case 'dash':
      noise(0.24, 0.38, 500, 0, 'bandpass', 3200 * j, 1.2);
      tone(260, 0.2, 'sine', 0.1, 1100);
      break;
    case 'charge':
      tone(90, 0.7, 'sawtooth', 0.12, 720, 0, 0.2, null, 1500);
      tone(500, 0.7, 'sine', 0.07, 1800, 0.05, 0.3);
      noise(0.6, 0.1, 400, 0, 'bandpass', 3000, 2);
      break;
    case 'level':
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, 'triangle', 0.18, undefined, i * 0.1, 0.5));
      tone(1568, 0.6, 'sine', 0.1, undefined, 0.4, 0.6);
      break;
    case 'ui':
      tone(880, 0.07, 'triangle', 0.12);
      tone(1320, 0.09, 'triangle', 0.08, undefined, 0.04);
      break;
    case 'death':
      tone(220, 0.9, 'sawtooth', 0.22, 28, 0, 0.5, null, 1200);
      noise(0.9, 0.5, 900, 0, 'lowpass', 60, 0.7, 0.5);
      tone(70, 0.9, 'sine', 0.6, 25, 0, 0.4);
      break;
    case 'chain':
      for (let i = 0; i < 4; i++) {
        tone(2100 + i * 220, 0.1, 'square', 0.07, 1100, i * 0.045, 0.15);
        noise(0.05, 0.25, 6500, i * 0.045, 'highpass');
      }
      break;
    case 'card':
      noise(0.07, 0.3, 6500, 0, 'highpass');
      tone(3200, 0.05, 'triangle', 0.05, 1800);
      break;
    case 'smoke':
      noise(0.7, 0.3, 450, 0, 'lowpass', 150, 0.7, 0.3);
      noise(0.5, 0.08, 2500, 0.05, 'bandpass', 800);
      break;
  }
}

// ------------------------------------------------------------------ music
export type MusicMode = 'menu' | 'island' | 'arena' | 'victory' | 'defeat' | 'off';
interface Mode {
  bpm: number;
  /** chords: first note = root (midi) */
  prog: number[][];
  kick: string;
  snare: string;
  hat: string;
  bass: string;
  arp: string;
  stab: string;
  taiko: string;
  pad: number;
  bassVol: number;
  arpVol: number;
  lead?: string;
}
const E2 = 40;
const MODES: Record<Exclude<MusicMode, 'off'>, Mode> = {
  menu: {
    bpm: 94, prog: [[E2 + 12, E2 + 19, E2 + 24, E2 + 27], [E2 + 8, E2 + 15, E2 + 20, E2 + 24], [E2 + 15, E2 + 22, E2 + 27, E2 + 30], [E2 + 14, E2 + 21, E2 + 26, E2 + 29]],
    kick: 'X.......x.......', snare: '................', hat: '..x...x...x...x.', bass: 'x.......x.......', arp: 'x..x..x.x..x..x.', stab: '................', taiko: 'X.......x...x...', pad: 1, bassVol: 0.5, arpVol: 0.5,
  },
  island: {
    bpm: 128, prog: [[E2 + 12, E2 + 19, E2 + 24, E2 + 27], [E2 + 8, E2 + 15, E2 + 20, E2 + 24], [E2 + 15, E2 + 22, E2 + 27, E2 + 30], [E2 + 19, E2 + 26, E2 + 31, E2 + 34]],
    kick: 'X...X...X...X..x', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xx', bass: 'x.xx.xx.x.xx.xx.', arp: 'x.xx.xx.x.xx.xxx', stab: 'X.....x.X.......', taiko: 'X.......X.......', pad: 1, bassVol: 0.8, arpVol: 0.7,
  },
  arena: {
    bpm: 168, prog: [[E2 + 12, E2 + 19, E2 + 24, E2 + 27], [E2 + 8, E2 + 15, E2 + 20, E2 + 24], [E2 + 10, E2 + 17, E2 + 22, E2 + 26], [E2 + 7, E2 + 14, E2 + 19, E2 + 23], [E2 + 12, E2 + 19, E2 + 24, E2 + 27], [E2 + 8, E2 + 15, E2 + 20, E2 + 24], [E2 + 15, E2 + 22, E2 + 27, E2 + 30], [E2 + 7, E2 + 14, E2 + 19, E2 + 23]],
    kick: 'X..x..x.X..x..xx', snare: '....X.......X..x', hat: 'xxxxxxxxxxxxxxxx', bass: 'xxxxxxxxxxxxxxxx', arp: 'xxxxxxxxxxxxxxxx', stab: 'X.....x.X..x..x.', taiko: 'X.......X.x.....', pad: 1, bassVol: 1, arpVol: 0.9,
  },
  victory: {
    bpm: 112, prog: [[E2 + 20, E2 + 24, E2 + 27, E2 + 32], [E2 + 15, E2 + 19, E2 + 22, E2 + 27], [E2 + 17, E2 + 21, E2 + 24, E2 + 29], [E2 + 20, E2 + 24, E2 + 27, E2 + 32]],
    kick: 'X.......X.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'x...x...x...x...', arp: 'xxxxxxxxxxxxxxxx', stab: 'X.......X.......', taiko: 'X.......X.......', pad: 1, bassVol: 0.7, arpVol: 0.8,
  },
  defeat: {
    bpm: 66, prog: [[E2 + 12, E2 + 19, E2 + 24, E2 + 27], [E2 + 8, E2 + 15, E2 + 20, E2 + 23], [E2 + 5, E2 + 12, E2 + 17, E2 + 20], [E2 + 7, E2 + 14, E2 + 19, E2 + 22]],
    kick: 'X...............', snare: '................', hat: '................', bass: 'x...............', arp: 'x...x...x...x...', stab: '................', taiko: 'X...............', pad: 1, bassVol: 0.6, arpVol: 0.5,
  },
};

const hz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
let mode: MusicMode = 'off';
let timer = 0;
let step = 0;
let nextT = 0;
let intensity = 0;

function mTone(freq: number, t: number, dur: number, type: OscillatorType, vol: number, lp = 0, rev = 0, detune = 0) {
  if (!ctx || !musBus) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let n: AudioNode = o;
  if (lp) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(lp * 1.8, t);
    f.frequency.exponentialRampToValueAtTime(lp, t + dur * 0.6);
    o.connect(f);
    n = f;
  }
  n.connect(g);
  g.connect(musBus);
  if (rev && reverbIn) {
    const r = ctx.createGain();
    r.gain.value = rev;
    g.connect(r);
    r.connect(reverbIn);
  }
  o.start(t);
  o.stop(t + dur + 0.05);
}
function mNoise(t: number, dur: number, vol: number, freq: number, type: BiquadFilterType, slideTo?: number, q = 1, rev = 0) {
  if (!ctx || !noiseBuf || !musBus) return;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(musBus);
  if (rev && reverbIn) {
    const r = ctx.createGain();
    r.gain.value = rev;
    g.connect(r);
    r.connect(reverbIn);
  }
  s.start(t, Math.random());
  s.stop(t + dur + 0.05);
}
const kick = (t: number, v: number) => {
  if (!ctx || !musBus) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(170, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
  o.connect(g);
  g.connect(musBus);
  o.start(t);
  o.stop(t + 0.4);
  mNoise(t, 0.03, v * 0.5, 3000, 'highpass');
};
const snare = (t: number, v: number) => {
  mNoise(t, 0.2, v, 2200, 'bandpass', 1400, 0.7, 0.3);
  mTone(200, t, 0.12, 'triangle', v * 0.5);
};
const taiko = (t: number, v: number) => {
  mTone(110, t, 0.5, 'sine', v, 0, 0.5);
  mTone(70, t, 0.7, 'sine', v * 0.9, 0, 0.5);
  mNoise(t, 0.12, v * 0.5, 300, 'lowpass', 90, 1, 0.4);
};

function scheduleStep(m: Mode, st: number, t: number, md: MusicMode) {
  const bars = m.prog.length;
  const bar = Math.floor(st / 16) % bars;
  const s = st % 16;
  const chord = m.prog[bar];
  const sd = 60 / m.bpm / 4;
  const on = (p: string) => p[s] !== '.' && p[s] !== undefined;
  const acc = (p: string) => (p[s] === 'X' ? 1 : 0.72);
  const lastBar = bar === bars - 1;
  const arena = md === 'arena';
  if (on(m.kick)) kick(t, 0.9 * acc(m.kick));
  if (on(m.snare)) snare(t, 0.38 * acc(m.snare));
  if (lastBar && arena && s >= 12) snare(t, 0.2 + (s - 12) * 0.07);
  if (on(m.hat)) mNoise(t, 0.04, (arena ? 0.13 : 0.1) * (s % 4 === 2 ? 1.2 : 0.8), 8500, 'highpass');
  if (on(m.taiko) && (arena || md === 'island' || md === 'victory' || md === 'menu')) taiko(t, (arena ? 0.7 : 0.5) * acc(m.taiko));
  if (on(m.bass)) {
    const root = chord[0] - 24 + (arena && s % 8 >= 6 ? 12 : 0);
    mTone(hz(root), t, sd * 1.6, 'sawtooth', 0.2 * m.bassVol * acc(m.bass), 260 + (arena ? 160 : 0));
    mTone(hz(root), t, sd * 1.6, 'sine', 0.22 * m.bassVol);
  }
  if (on(m.stab)) {
    for (const n of [chord[0], chord[1], chord[2]]) {
      mTone(hz(n + 12), t, sd * 2.6, 'sawtooth', 0.06 * acc(m.stab), 2600, 0.2, -8);
      mTone(hz(n + 12), t, sd * 2.6, 'sawtooth', 0.06 * acc(m.stab), 2600, 0.2, 9);
    }
  }
  if (on(m.arp)) {
    const seq = arena ? [0, 2, 1, 3, 2, 3, 1, 2] : [0, 1, 2, 3, 2, 1];
    const i = seq[(st >> (arena ? 0 : 0)) % seq.length];
    const oct = arena ? (Math.floor(st / 8) % 2 ? 24 : 12) : 12;
    mTone(hz(chord[i % 4] + oct), t, sd * (arena ? 1.1 : 1.8), arena ? 'square' : 'triangle', 0.055 * m.arpVol, arena ? 3200 : 2400, 0.25);
  }
  // pad on the first step of each bar
  if (s === 0 && m.pad) {
    for (const n of chord) {
      mTone(hz(n), t, sd * 16 * 1.02, 'sawtooth', 0.03, 900, 0.5, -10);
      mTone(hz(n), t, sd * 16 * 1.02, 'sawtooth', 0.03, 900, 0.5, 10);
    }
  }
  // arena: heroic lead phrase every other bar + riser before the loop restarts
  if (arena) {
    const phrase = [0, -1, 2, -1, 3, 2, 1, -1, 0, -1, 3, 2, 4, 3, 2, 1];
    const p = phrase[s];
    if (bar % 2 === 0 && p >= 0) {
      const n = chord[p % 4] + 12 + (p >= 4 ? 12 : 0) + 12;
      mTone(hz(n), t, sd * 1.7, 'sawtooth', 0.07, 3600, 0.35, 6);
    }
    if (lastBar && s === 0) mNoise(t, sd * 16, 0.12, 400, 'bandpass', 7000, 2, 0.3);
    if (s === 0 && bar === 0) mNoise(t, 0.9, 0.35, 5000, 'highpass', 800, 1, 0.5); // crash
  }
  if (md === 'victory' && s % 2 === 0 && bar < 2) mTone(hz(chord[(s / 2) % 4] + 24), t, sd * 1.8, 'triangle', 0.08, 3000, 0.4);
}

function tick() {
  if (!ctx || mode === 'off') return;
  const m = MODES[mode];
  const sd = 60 / m.bpm / 4;
  while (nextT < ctx.currentTime + 0.14) {
    if (nextT < ctx.currentTime - 0.2) nextT = ctx.currentTime + 0.02;
    scheduleStep(m, step, nextT, mode);
    step++;
    nextT += sd;
  }
}

export function setMusic(next: MusicMode) {
  if (!ctx || !musBus) {
    pendingMode = next;
    return;
  }
  if (next === mode) return;
  mode = next;
  step = 0;
  nextT = ctx.currentTime + 0.08;
  clearInterval(timer);
  if (next === 'off') return;
  // short duck + swell so changes feel intentional
  const g = musBus.gain;
  const target = musVol * 0.6;
  g.cancelScheduledValues(ctx.currentTime);
  g.setValueAtTime(target * 0.2, ctx.currentTime);
  g.linearRampToValueAtTime(target, ctx.currentTime + 0.8);
  timer = window.setInterval(tick, 25);
  intensity = 0;
  void intensity;
}
export const getMusic = () => mode;
