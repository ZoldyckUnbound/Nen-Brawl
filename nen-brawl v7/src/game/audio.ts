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
const recent: number[] = [];
const MIN_GAP: Record<string, number> = { boom: 0.28, heavy: 0.12, thunder: 0.3, charge: 0.25, death: 0.3, level: 0.5, ui: 0.06, smoke: 0.2, zap: 0.12, slash: 0.07, dash: 0.1 };
export function sfx(name: Sfx) {
  if (!ctx) return;
  const now = ctx.currentTime;
  // never stack identical sounds, and cap how many voices can start in a short window
  const minGap = MIN_GAP[name] ?? 0.05;
  if (now - (lastPlay[name] ?? -1) < minGap) return;
  while (recent.length && now - recent[0] > 0.22) recent.shift();
  const prio = name === 'death' || name === 'level' || name === 'boom';
  if (recent.length >= (prio ? 9 : 6)) return;
  recent.push(now);
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
// A small melodic engine: pulse-wave lead (with vibrato + echo), auto-harmony, arpeggios, bass, pads and drums.
// Each theme is an 8-bar loop built around one singable hook – bright, heroic and easy to remember.
export type MusicMode = 'menu' | 'island' | 'arena' | 'victory' | 'defeat' | 'brLobby' | 'brMatch' | 'brFinal' | 'off';
interface Song {
  bpm: number; chords: number[][]; lead: string; scale?: number[]; kick: string; snare: string; hat: string;
  bass: 'root' | 'eighth' | 'walk'; arp: number; stab?: string; crash?: boolean; fill?: boolean; leadVol?: number; padVol?: number; harmVol?: number; taiko?: string;
}
const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
interface LN { m: number; l: number }
function parseLead(s: string): Map<number, LN> {
  const map = new Map<number, LN>();
  let step = 0;
  for (const tok of s.trim().split(/\s+/)) {
    const [n, l] = tok.split(':');
    const len = parseInt(l || '2', 10);
    if (n !== 'r') {
      const m = n.match(/^([A-G])([#b]?)(-?\d)$/);
      if (m) map.set(step, { m: PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12, l: len });
    }
    step += len;
  }
  return map;
}
const MAJ = [0, 2, 4, 5, 7, 9, 11];
const MODES: Record<Exclude<MusicMode, 'off'>, Song> = {
  // G major – "Hunter's Hymn": rising arpeggio hook, answered by a step-wise phrase
  menu: {
    bpm: 112, scale: MAJ.map((x) => (x + 7) % 12),
    chords: [[43, 55, 59, 62], [38, 50, 54, 57], [40, 52, 55, 59], [36, 48, 52, 55], [43, 55, 59, 62], [38, 50, 54, 57], [36, 48, 52, 55], [38, 50, 54, 57]],
    lead: 'G4:2 B4:2 D5:4 G5:6 F#5:2  A5:6 F#5:2 D5:4 F#5:4  E5:4 G5:4 B5:6 A5:2  G5:6 E5:2 C5:4 E5:4  G4:2 B4:2 D5:4 G5:6 F#5:2  A5:6 F#5:2 D5:4 A5:4  E5:2 G5:2 C6:4 B5:2 A5:2 G5:2 E5:2  F#5:4 A5:4 D6:6 r:2',
    kick: 'X...x...X...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'walk', arp: 2, leadVol: 1, taiko: 'X.......x.......',
  },
  // C major – "Bandit Island": bouncy adventure march
  island: {
    bpm: 138, scale: MAJ,
    chords: [[36, 48, 52, 55], [33, 45, 48, 52], [41, 53, 57, 60], [43, 55, 59, 62], [36, 48, 52, 55], [33, 45, 48, 52], [41, 53, 57, 60], [43, 55, 59, 62]],
    lead: 'E5:2 E5:2 G5:2 E5:2 C5:2 E5:2 G5:4  A5:2 A5:2 G5:2 E5:2 C5:2 E5:2 A4:4  F5:2 F5:2 A5:2 F5:2 C5:2 F5:2 A5:4  G5:2 F5:2 E5:2 D5:2 B4:4 D5:2 G4:2  E5:2 G5:2 C6:4 B5:2 G5:2 E5:4  A5:2 C6:2 E6:4 D6:2 C6:2 A5:4  A5:2 F5:2 C6:4 A5:2 F5:2 A5:4  D6:2 B5:2 G5:4 A5:2 B5:2 D6:4',
    kick: 'X...X...X...X..x', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx', bass: 'eighth', arp: 2, stab: 'X.....x.X.......', leadVol: 1, taiko: 'X.......X.......',
  },
  // E minor – "Final Duel": relentless heroic boss theme
  arena: {
    bpm: 172,
    chords: [[40, 52, 55, 59], [36, 48, 52, 55], [43, 55, 59, 62], [38, 50, 54, 57], [40, 52, 55, 59], [36, 48, 52, 55], [38, 50, 54, 57], [35, 47, 51, 54]],
    lead: 'E5:2 r:2 E5:2 G5:2 B5:4 A5:2 G5:2  G5:2 r:2 G5:2 E5:2 C6:4 B5:2 G5:2  B5:2 r:2 B5:2 D6:2 G6:4 F#6:2 D6:2  A5:2 A5:2 D6:2 F#6:2 A6:4 F#6:2 D6:2  E6:4 B5:2 G5:2 E6:4 B5:2 G5:2  E6:4 C6:2 G5:2 E6:4 C6:2 G5:2  F#6:4 D6:2 A5:2 F#6:4 D6:2 A5:2  D#6:2 F#6:2 B6:4 A6:2 F#6:2 D#6:2 B5:2',
    kick: 'X..xX..xX..xX.xx', snare: '....X.......X..x', hat: 'xxxxxxxxxxxxxxxx', bass: 'eighth', arp: 1, stab: 'X.....x.X..x..x.', crash: true, fill: true, leadVol: 1.1, taiko: 'X.......X.x.....',
  },
  // C major – victory fanfare
  victory: {
    bpm: 124, scale: MAJ,
    chords: [[36, 48, 52, 55], [41, 53, 57, 60], [43, 55, 59, 62], [36, 48, 52, 55]],
    lead: 'G4:2 C5:2 E5:2 G5:4 E5:2 G5:4  A5:2 F5:2 A5:2 C6:4 A5:2 C6:4  B5:2 G5:2 B5:2 D6:4 B5:2 D6:4  C6:8 G5:2 E5:2 C5:4',
    kick: 'X.......X...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'root', arp: 2, stab: 'X.......X.......', crash: true, leadVol: 1.1, taiko: 'X.......X.......',
  },
  // A minor – defeat
  defeat: {
    bpm: 66, chords: [[33, 45, 48, 52], [41, 53, 57, 60], [38, 50, 53, 57], [40, 52, 56, 59]],
    lead: 'E5:8 C5:4 D5:4  A4:8 C5:4 A4:4  D5:8 F5:4 E5:4  G#4:4 B4:4 E5:8',
    kick: 'X...............', snare: '................', hat: '................', bass: 'root', arp: 4, leadVol: 0.8, padVol: 1.3,
  },
  // D minor – "Greed Island": mysterious, grand, a little dangerous
  brLobby: {
    bpm: 100,
    chords: [[38, 50, 53, 57], [34, 46, 50, 53], [41, 53, 57, 60], [36, 48, 52, 55], [38, 50, 53, 57], [34, 46, 50, 53], [43, 55, 58, 62], [45, 57, 61, 64]],
    lead: 'D5:4 F5:4 A5:6 G5:2  F5:4 A5:4 D6:8  C6:4 A5:4 F5:4 A5:2 C6:2  G5:6 E5:2 G5:4 C6:4  D5:4 F5:4 A5:6 G5:2  A5:4 D6:4 F6:8  G5:4 Bb5:4 D6:4 Bb5:4  E6:4 C#6:4 A5:4 C#6:4',
    kick: 'X.......x.......', snare: '........x.......', hat: '..x...x...x...x.', bass: 'root', arp: 2, leadVol: 1, padVol: 1.4, taiko: 'X.......X.x.....',
  },
  // F major – exploring the island
  brMatch: {
    bpm: 118, scale: MAJ.map((x) => (x + 5) % 12),
    chords: [[41, 53, 57, 60], [36, 48, 52, 55], [38, 50, 53, 57], [34, 46, 50, 53], [41, 53, 57, 60], [36, 48, 52, 55], [34, 46, 50, 53], [36, 48, 52, 55]],
    lead: 'A4:2 C5:2 F5:4 E5:2 F5:2 A5:4  G5:4 E5:4 C5:4 E5:2 G5:2  D5:2 F5:2 A5:4 G5:2 F5:2 D5:4  Bb4:2 D5:2 F5:4 D5:4 C5:4  A4:2 C5:2 F5:4 E5:2 F5:2 A5:4  G5:4 E5:4 C6:6 B5:2  Bb5:4 A5:2 G5:2 F5:4 D5:4  E5:2 G5:2 C6:4 D6:2 E6:2 G5:4',
    kick: 'X.......X...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xx', bass: 'walk', arp: 2, stab: 'X.......X.......', leadVol: 1, taiko: 'X...............',
  },
  // A minor – the last circle
  brFinal: {
    bpm: 176,
    chords: [[33, 45, 48, 52], [41, 53, 57, 60], [36, 48, 52, 55], [43, 55, 59, 62], [33, 45, 48, 52], [41, 53, 57, 60], [40, 52, 56, 59], [40, 52, 56, 59]],
    lead: 'A5:2 r:2 A5:2 C6:2 E6:4 D6:2 C6:2  C6:2 r:2 C6:2 A5:2 F6:4 E6:2 C6:2  E6:2 r:2 E6:2 G6:2 C7:4 B6:2 G6:2  D6:2 D6:2 G6:2 B6:2 D7:4 B6:2 G6:2  A6:4 E6:2 C6:2 A6:4 E6:2 C6:2  A6:4 F6:2 C6:2 A6:4 F6:2 C6:2  G#6:4 E6:2 B5:2 G#6:4 E6:2 B5:2  G#5:2 B5:2 E6:4 G#6:2 B6:2 E7:4',
    kick: 'X..xX..xX..xX.xx', snare: '....X.......X.xx', hat: 'xxxxxxxxxxxxxxxx', bass: 'eighth', arp: 1, stab: 'X.....x.X..x..x.', crash: true, fill: true, leadVol: 1.1, taiko: 'X.......X.x.x...',
  },
};
const LEADS: Record<string, Map<number, LN>> = {};
for (const k of Object.keys(MODES)) LEADS[k] = parseLead(MODES[k as keyof typeof MODES].lead);

const hz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
let mode: MusicMode = 'off';
let timer = 0;
let step = 0;
let nextT = 0;
let echoIn: GainNode | null = null;
let echoDelay: DelayNode | null = null;
const waves: Record<string, PeriodicWave> = {};
function pulseWave(d: number) {
  const key = String(d);
  if (waves[key] || !ctx) return waves[key];
  const N = 40;
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  for (let n = 1; n < N; n++) { re[n] = Math.sin(2 * Math.PI * n * d) / n; im[n] = (1 - Math.cos(2 * Math.PI * n * d)) / n; }
  waves[key] = ctx.createPeriodicWave(re, im);
  return waves[key];
}
function ensureFx() {
  if (!ctx || !musBus || echoIn) return;
  echoIn = ctx.createGain();
  echoIn.gain.value = 0.28;
  echoDelay = ctx.createDelay(1);
  echoDelay.delayTime.value = 0.2;
  const fb = ctx.createGain();
  fb.gain.value = 0.34;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3200;
  echoIn.connect(echoDelay);
  echoDelay.connect(lp);
  lp.connect(fb);
  fb.connect(echoDelay);
  lp.connect(musBus);
}

function mTone(freq: number, t: number, dur: number, type: OscillatorType, vol: number, lp = 0, rev = 0, detune = 0, duty = 0, echo = 0, vib = 0) {
  if (!ctx || !musBus) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  if (duty) o.setPeriodicWave(pulseWave(duty));
  else o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.012);
  g.gain.setValueAtTime(Math.max(0.0002, vol * 0.8), t + Math.max(0.02, dur * 0.7));
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
  if (rev && reverbIn) { const r = ctx.createGain(); r.gain.value = rev; g.connect(r); r.connect(reverbIn); }
  if (echo && echoIn) { const r = ctx.createGain(); r.gain.value = echo; g.connect(r); r.connect(echoIn); }
  if (vib) {
    const l = ctx.createOscillator();
    const lg = ctx.createGain();
    l.frequency.value = 5.6;
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(vib, t + Math.min(0.25, dur * 0.5));
    l.connect(lg);
    lg.connect(o.detune);
    l.start(t);
    l.stop(t + dur + 0.05);
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
  if (rev && reverbIn) { const r = ctx.createGain(); r.gain.value = rev; g.connect(r); r.connect(reverbIn); }
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
function down3(m: number, sc: number[]) {
  let c = 0;
  let x = m;
  while (c < 2 && x > 0) { x--; if (sc.includes(((x % 12) + 12) % 12)) c++; }
  return x;
}

function scheduleStep(m: Song, key: string, st: number, t: number) {
  const bars = m.chords.length;
  const total = bars * 16;
  const sIdx = st % total;
  const bar = Math.floor(sIdx / 16);
  const s = sIdx % 16;
  const chord = m.chords[bar];
  const sd = 60 / m.bpm / 4;
  const on = (p: string) => p[s] !== '.' && p[s] !== undefined;
  const acc = (p: string) => (p[s] === 'X' ? 1 : 0.72);
  const hard = key === 'arena' || key === 'brFinal';
  const lastBar = bar === bars - 1;
  if (on(m.kick)) kick(t, 0.9 * acc(m.kick));
  if (on(m.snare)) snare(t, 0.36 * acc(m.snare));
  if (on(m.hat)) mNoise(t, 0.04, (hard ? 0.12 : 0.085) * (s % 4 === 2 ? 1.2 : 0.8), 8500, 'highpass');
  if (m.taiko && on(m.taiko)) taiko(t, (hard ? 0.7 : 0.45) * acc(m.taiko));
  if (m.fill && lastBar && s >= 12) { snare(t, 0.16 + (s - 12) * 0.07); if (s === 12 || s === 14) mTone(180 - s * 6, t, 0.16, 'sine', 0.3); }
  if (m.crash && bar === 0 && s === 0) mNoise(t, 1.1, 0.3, 5000, 'highpass', 800, 1, 0.5);
  // bass
  const root = chord[0];
  if (m.bass === 'root' && s % 8 === 0) {
    mTone(hz(root), t, sd * 7, 'triangle', 0.24);
    mTone(hz(root), t, sd * 7, 'sawtooth', 0.07, 320);
  } else if (m.bass === 'eighth' && s % 2 === 0) {
    const n = root + (s % 8 >= 6 ? 12 : 0);
    mTone(hz(n), t, sd * 1.7, 'sawtooth', 0.14, 380 + (hard ? 200 : 0));
    mTone(hz(n), t, sd * 1.7, 'triangle', 0.2);
  } else if (m.bass === 'walk' && s % 4 === 0) {
    const n = [root, root + 7, root + 12, root + 7][(s / 4) % 4];
    mTone(hz(n), t, sd * 3.4, 'triangle', 0.24);
    mTone(hz(n), t, sd * 3.4, 'sawtooth', 0.06, 340);
  }
  // pad / strings
  if (s === 0) {
    const pv = (m.padVol ?? 1) * 0.026;
    for (const n of chord.slice(1)) {
      mTone(hz(n), t, sd * 16.2, 'sawtooth', pv, 950, 0.5, -9);
      mTone(hz(n), t, sd * 16.2, 'sawtooth', pv, 950, 0.5, 9);
    }
  }
  // arpeggio
  if (m.arp && s % m.arp === 0) {
    const seq = [1, 2, 3, 2];
    const n = chord[seq[(s / m.arp) % 4]] + 12;
    mTone(hz(n), t, sd * m.arp * 1.4, hard ? 'square' : 'triangle', hard ? 0.032 : 0.05, hard ? 3000 : 2400, 0.25, 0, 0, 0.25);
  }
  // chord stabs
  if (m.stab && on(m.stab)) {
    for (const n of chord.slice(1)) {
      mTone(hz(n + 12), t, sd * 2.4, 'sawtooth', 0.04 * acc(m.stab), 2600, 0.2, -7);
      mTone(hz(n + 12), t, sd * 2.4, 'sawtooth', 0.04 * acc(m.stab), 2600, 0.2, 8);
    }
  }
  // the hook
  const ln = LEADS[key].get(sIdx);
  if (ln) {
    const v = (m.leadVol ?? 1) * 0.085;
    const d = sd * ln.l * 0.96;
    const vib = ln.l >= 4 ? 9 : 0;
    mTone(hz(ln.m), t, d, 'square', v, 4200, 0.3, 0, 0.25, 0.32, vib);
    mTone(hz(ln.m), t, d, 'triangle', v * 0.55, 0, 0.2);
    if (m.scale) mTone(hz(down3(ln.m, m.scale)), t, d, 'square', v * 0.38, 3200, 0.3, 4, 0.125, 0.2, vib);
    if (hard) mTone(hz(ln.m - 12), t, d, 'sawtooth', v * 0.22, 1800, 0.2);
  }
}

function tick() {
  if (!ctx || mode === 'off') return;
  const m = MODES[mode];
  const sd = 60 / m.bpm / 4;
  while (nextT < ctx.currentTime + 0.14) {
    if (nextT < ctx.currentTime - 0.2) nextT = ctx.currentTime + 0.02;
    scheduleStep(m, mode, step, nextT);
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
  ensureFx();
  mode = next;
  step = 0;
  nextT = ctx.currentTime + 0.08;
  clearInterval(timer);
  if (next === 'off') return;
  if (echoDelay) echoDelay.delayTime.value = (60 / MODES[next].bpm) * 0.75;
  const g = musBus.gain;
  const target = musVol * 0.6;
  g.cancelScheduledValues(ctx.currentTime);
  g.setValueAtTime(target * 0.2, ctx.currentTime);
  g.linearRampToValueAtTime(target, ctx.currentTime + 0.8);
  timer = window.setInterval(tick, 25);
}
export const getMusic = () => mode;
