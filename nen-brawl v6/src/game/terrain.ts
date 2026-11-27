/**
 * Greed Island terrain: one analytic height-field shared by rendering, physics, AI and the map.
 * The coastline is traced from the official island map (2011 anime layout, north up).
 * 1 map pixel = 11.5 m  →  ~125 km² of land (≈ 49× the old island).
 */
export const S = 11.5;
export const toWorld = (px: number, py: number): [number, number] => [(px - 561) * S, (py - 701) * S];
export const WORLD_W = 17000;
export const SEA_Y = -0.5;
export const DEEP = -1.4;

const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function h2(ix: number, iy: number, seed: number) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(x: number, y: number, s: number) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = h2(ix, iy, s), b = h2(ix + 1, iy, s), c = h2(ix, iy + 1, s), d = h2(ix + 1, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x: number, y: number, s = 1) => (vn(x, y, s) * 0.55 + vn(x * 2.03, y * 2.03, s + 1) * 0.28 + vn(x * 4.1, y * 4.1, s + 2) * 0.12 + vn(x * 8.3, y * 8.3, s + 3) * 0.05);
const ridge = (x: number, y: number, s: number) => {
  let a = 0, amp = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { const n = 1 - Math.abs(vn(x * f, y * f, s + i) * 2 - 1); a += n * n * amp; amp *= 0.5; f *= 2.1; }
  return a / 0.9375;
};
export { sstep, lerp };

// ---------------------------------------------------------------- coastline (map pixels, north up)
const COAST_PX: [number, number][] = [
  [200, 195], [260, 160], [330, 175], [400, 235], [470, 215], [560, 150], [620, 100], [690, 105], [740, 150], [850, 140], [940, 150], [1030, 180], [1065, 215],
  [1090, 300], [1080, 380], [1095, 450], [1100, 520], [1105, 620], [1100, 690], [1075, 760], [1085, 830], [1100, 880], [1060, 960], [1075, 1040], [1100, 1110],
  [1100, 1170], [1040, 1230], [940, 1250], [850, 1230], [800, 1255], [700, 1260], [600, 1275], [500, 1280], [420, 1265], [330, 1260], [240, 1210], [190, 1130],
  [130, 1070], [40, 950], [20, 860], [70, 800], [40, 760], [120, 780], [200, 760], [300, 740], [380, 720], [410, 690], [330, 670], [250, 640], [210, 605],
  [130, 590], [60, 570], [100, 520], [120, 480], [200, 440], [250, 380], [340, 340], [380, 290], [330, 270], [250, 255], [200, 230],
];
const poly = COAST_PX.map(([a, b]) => toWorld(a, b));

const GX0 = -7600, GZ0 = -8000, GC = 60, GW = Math.ceil(15200 / GC) + 1, GH = Math.ceil(16000 / GC) + 1;
const sdfGrid = new Float32Array(GW * GH);
(function buildSdf() {
  const n = poly.length;
  for (let j = 0; j < GH; j++) {
    for (let i = 0; i < GW; i++) {
      const x = GX0 + i * GC, z = GZ0 + j * GC;
      let best = 1e12, inside = false;
      for (let a = 0, b = n - 1; a < n; b = a++) {
        const [x1, z1] = poly[a], [x2, z2] = poly[b];
        if ((z1 > z) !== (z2 > z) && x < ((x2 - x1) * (z - z1)) / (z2 - z1) + x1) inside = !inside;
        const dx = x2 - x1, dz = z2 - z1;
        const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz)));
        const ex = x1 + dx * t - x, ez = z1 + dz * t - z;
        const d2 = ex * ex + ez * ez;
        if (d2 < best) best = d2;
      }
      sdfGrid[j * GW + i] = (inside ? 1 : -1) * Math.sqrt(best);
    }
  }
})();
export function sdf(x: number, z: number) {
  const fx = (x - GX0) / GC, fz = (z - GZ0) / GC;
  if (fx < 0 || fz < 0 || fx >= GW - 1 || fz >= GH - 1) return -4000;
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const a = sdfGrid[j * GW + i], b = sdfGrid[j * GW + i + 1], c = sdfGrid[(j + 1) * GW + i], d = sdfGrid[(j + 1) * GW + i + 1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// ---------------------------------------------------------------- features
interface Blob { x: number; z: number; r: number; h: number }
const blob = (px: number, py: number, rpx: number, h = 1): Blob => { const [x, z] = toWorld(px, py); return { x, z, r: rpx * S, h }; };
const MOUNTS: Blob[] = [
  blob(650, 110, 120, 1.0), blob(735, 235, 115, 0.9), blob(900, 790, 200, 1.0), blob(560, 520, 105, 0.7), blob(300, 330, 70, 0.4), blob(405, 1235, 90, 0.55),
  blob(140, 880, 60, 0.4), blob(390, 560, 70, 0.45), blob(470, 430, 70, 0.5), blob(1030, 470, 60, 0.7), blob(760, 700, 60, 0.45), blob(1000, 880, 80, 0.8),
];
const FORESTS: Blob[] = [
  blob(520, 1060, 150), blob(300, 420, 110), blob(440, 250, 90), blob(640, 330, 120), blob(800, 230, 110), blob(950, 330, 100), blob(860, 1010, 90), blob(320, 980, 90),
  blob(480, 640, 70), blob(660, 880, 80), blob(230, 540, 60), blob(1000, 700, 90), blob(540, 380, 80), blob(150, 830, 50), blob(770, 480, 70),
];
export const BAD = (() => { const [x, z] = toWorld(960, 560); return { x, z, r: 175 * S }; })();
export const PINK = (() => { const [x, z] = toWorld(1010, 490); return { x, z, r: 55 * S }; })();
const RIVERS: [number, number][][] = ([
  [[420, 290], [450, 335], [485, 420], [430, 475], [385, 525], [355, 590], [330, 650]],
  [[800, 880], [860, 905], [920, 945], [938, 1010], [920, 1080], [898, 1130], [880, 1175]],
  [[520, 205], [525, 260], [480, 305], [440, 345]],
  [[640, 600], [610, 640], [560, 680], [540, 740], [575, 790], [600, 850]],
] as [number, number][][]).map((r) => r.map(([a, b]) => toWorld(a, b)));
export const RIVER_LINES = RIVERS;
export const LAKES2: Blob[] = [blob(330, 790, 22), blob(700, 1130, 20), blob(520, 780, 14), blob(860, 640, 18), blob(150, 640, 14)];

export interface Flat { x: number; z: number; r: number; h: number }
let flats: Flat[] = [];
let roadSegs: { x1: number; z1: number; x2: number; z2: number; w: number }[] = [];
export function setFlats(f: Flat[]) { flats = f; }
export function setRoadSegs(s: typeof roadSegs) { roadSegs = s; }
export function roadSegments() { return roadSegs; }

function distSeg(x: number, z: number, x1: number, z1: number, x2: number, z2: number) {
  const dx = x2 - x1, dz = z2 - z1;
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x1 + dx * t - x, z1 + dz * t - z);
}
export function riverDist(x: number, z: number) {
  let best = 1e9;
  for (const r of RIVERS) for (let i = 0; i < r.length - 1; i++) {
    const a = r[i], b = r[i + 1];
    if (Math.abs(x - (a[0] + b[0]) / 2) > 900 + Math.abs(a[0] - b[0]) / 2 || Math.abs(z - (a[1] + b[1]) / 2) > 900 + Math.abs(a[1] - b[1]) / 2) continue;
    const d = distSeg(x, z, a[0], a[1], b[0], b[1]);
    if (d < best) best = d;
  }
  return best;
}
export function roadDist(x: number, z: number) {
  let best = 1e9;
  for (const s of roadSegs) {
    if (x < Math.min(s.x1, s.x2) - 60 || x > Math.max(s.x1, s.x2) + 60 || z < Math.min(s.z1, s.z2) - 60 || z > Math.max(s.z1, s.z2) + 60) continue;
    const d = distSeg(x, z, s.x1, s.z1, s.x2, s.z2) - s.w * 0.5;
    if (d < best) best = d;
  }
  return best;
}

function natural(x: number, z: number): number {
  let d = sdf(x, z);
  d += (fbm(x / 900, z / 900, 31) - 0.5) * 520 + (fbm(x / 170, z / 170, 33) - 0.5) * 70;
  let h = -9 + 10 * sstep(-380, 30, d);
  h += sstep(-20, 120, d) * 1.9;
  const inl = sstep(40, 700, d);
  h += inl * ((fbm(x / 420, z / 420, 5) - 0.5) * 10 + (fbm(x / 90, z / 90, 6) - 0.5) * 2.4);
  const hm = sstep(0.48, 0.78, fbm(x / 2600 + 4, z / 2600, 7));
  h += inl * hm * (22 + 55 * fbm(x / 520, z / 520, 8));
  let mt = 0;
  for (const m of MOUNTS) { const dd = Math.hypot(x - m.x, z - m.z) / m.r; if (dd < 1.3) mt += (1 - sstep(0.15, 1.25, dd)) * m.h; }
  if (mt > 0) h += inl * Math.min(1.25, mt) * (28 + 340 * (0.3 * fbm(x / 900, z / 900, 11) + 0.7 * ridge(x / 800, z / 800, 10)));
  const bd = Math.hypot(x - BAD.x, z - BAD.z) / BAD.r + (fbm(x / 600, z / 600, 12) - 0.5) * 0.35;
  const bm = 1 - sstep(0.7, 1.12, bd);
  if (bm > 0) {
    const n = fbm(x / 340, z / 340, 13) * 6;
    const f = n - Math.floor(n);
    h += inl * bm * (20 + (Math.floor(n) + sstep(0.86, 1, f)) * 12);
    const cn = Math.abs(fbm(x / 650, z / 650, 14) * 2 - 1);
    h -= bm * sstep(0.1, 0, cn) * 22;
  }
  return h;
}

export function groundAt(x: number, z: number): number {
  let h = natural(x, z);
  if (h > -4) {
    for (const l of LAKES2) { const d = Math.hypot(x - l.x, z - l.z); if (d < l.r) h = lerp(h, -4.2, 1 - sstep(l.r * 0.5, l.r, d)); }
    const rd = riverDist(x, z);
    if (rd < 95 && h > -0.5) h -= (1 - sstep(10, 95, rd)) * 2.7;
  }
  for (const f of flats) {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d < f.r * 1.8) h = lerp(h, f.h, 1 - sstep(f.r * 0.8, f.r * 1.8, d));
  }
  return h;
}
export const naturalAt = natural;
export const isWater = (x: number, z: number) => groundAt(x, z) < DEEP;
export const onLand = (x: number, z: number) => groundAt(x, z) > 1.2;
export function slopeAt(x: number, z: number, e = 3) {
  const dx = groundAt(x + e, z) - groundAt(x - e, z), dz = groundAt(x, z + e) - groundAt(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}
let groundFn: (x: number, z: number) => number = () => 0;
let waterFn: ((x: number, z: number) => boolean) | null = null;
export const setGround = (f: (x: number, z: number) => number, w: ((x: number, z: number) => boolean) | null = null) => { groundFn = f; waterFn = w; };
/** physics ground (0 outside Greed Island so the 1v1 arenas are untouched) */
export const gy = (x: number, z: number) => groundFn(x, z);
export const blockedWater = (x: number, z: number) => (waterFn ? waterFn(x, z) : false);

// ---------------------------------------------------------------- biome fields
export function forestAt(x: number, z: number) {
  let m = 0;
  for (const f of FORESTS) { const d = Math.hypot(x - f.x, z - f.z) / f.r; if (d < 1.15) m = Math.max(m, 1 - sstep(0.45, 1.1, d + (fbm(x / 300, z / 300, 21) - 0.5) * 0.5)); }
  const n = fbm(x / 520 + 9, z / 520, 22);
  return Math.max(0, Math.min(1, m * (0.35 + n * 1.0)));
}
export function badAt(x: number, z: number) { const bd = Math.hypot(x - BAD.x, z - BAD.z) / BAD.r + (fbm(x / 600, z / 600, 12) - 0.5) * 0.35; return 1 - sstep(0.7, 1.12, bd); }
export function pinkAt(x: number, z: number) { return 1 - sstep(0.4, 1, Math.hypot(x - PINK.x, z - PINK.z) / PINK.r); }
export function warmth(z: number) { return sstep(-1500, 2500, z); } // 0 = cold north (pines), 1 = warm south (broadleaf)

const PAL_BAD = [[0.74, 0.4, 0.24], [0.86, 0.62, 0.38], [0.63, 0.3, 0.2], [0.9, 0.74, 0.5], [0.7, 0.46, 0.3]];
export function colorAt(x: number, z: number, h: number, slope: number, out: number[]) {
  const nv = fbm(x / 22, z / 22, 40), nv2 = vn(x / 5, z / 5, 41), mn = fbm(x / 140, z / 140, 42);
  let r: number, g: number, b: number;
  if (h < -0.15) {
    const k = sstep(-9, -0.4, h);
    r = lerp(0.07, 0.8, k * k); g = lerp(0.22, 0.82, k * k); b = lerp(0.34, 0.62, k * k);
    const fo = 1 - sstep(0, 0.7, Math.abs(h + 0.5)); r = lerp(r, 0.95, fo * 0.55); g = lerp(g, 0.97, fo * 0.55); b = lerp(b, 0.97, fo * 0.55);
  } else {
    const f = forestAt(x, z), bm = badAt(x, z);
    r = 0.33 + nv * 0.14 + (mn > 0.62 ? 0.08 : 0); g = 0.55 + nv * 0.13 - (mn > 0.62 ? 0.04 : 0); b = 0.2 + nv2 * 0.06;
    if (f > 0.05) { const k = Math.min(1, f * 1.6); r = lerp(r, 0.17 + nv * 0.07, k); g = lerp(g, 0.34 + nv * 0.08, k); b = lerp(b, 0.14, k); }
    if (bm > 0.02) {
      const band = Math.floor(h / 3.4 + nv * 2.2 + Math.sin(z / 60 + nv * 5) * 0.3);
      const p = PAL_BAD[((band % 5) + 5) % 5];
      const k = Math.min(1, bm * 1.5);
      r = lerp(r, p[0] + nv * 0.06, k); g = lerp(g, p[1] + nv * 0.05, k); b = lerp(b, p[2] + nv * 0.04, k);
      const pk = pinkAt(x, z);
      if (pk > 0) { r = lerp(r, 0.86, pk * 0.55); g = lerp(g, 0.34, pk * 0.55); b = lerp(b, 0.56, pk * 0.55); }
    }
    const sandK = 1 - sstep(1.0, 3.4 + nv * 1.5, h);
    if (sandK > 0) { r = lerp(r, 0.86 + nv * 0.06, sandK); g = lerp(g, 0.78 + nv * 0.05, sandK); b = lerp(b, 0.56, sandK); }
    const rockK = Math.max(sstep(0.5, 0.95, slope), sstep(110, 230, h + nv * 40) * 0.8);
    if (rockK > 0) { const t = 0.4 + nv * 0.12 + nv2 * 0.06; r = lerp(r, t + 0.03, rockK); g = lerp(g, t, rockK); b = lerp(b, t - 0.02, rockK); }
    const snow = sstep(210, 260, h + (nv - 0.5) * 60) * (1 - sstep(0.8, 1.2, slope));
    if (snow > 0) { r = lerp(r, 0.94, snow); g = lerp(g, 0.96, snow); b = lerp(b, 0.98, snow); }
    const rd = riverDist(x, z);
    if (rd < 40 && h < 12) { const k = 1 - sstep(8, 40, rd); r = lerp(r, 0.55, k * 0.7); g = lerp(g, 0.5, k * 0.7); b = lerp(b, 0.36, k * 0.7); }
    const rod = roadDist(x, z);
    if (rod < 4) { const k = 1 - sstep(0, 4, rod); r = lerp(r, 0.64 + nv2 * 0.05, k * 0.9); g = lerp(g, 0.53 + nv2 * 0.04, k * 0.9); b = lerp(b, 0.37, k * 0.9); }
  }
  out[0] = r; out[1] = g; out[2] = b;
}

export function biomeName(x: number, z: number, h: number): string {
  if (h < DEEP) return 'sea';
  if (h < 2.6) return 'coast';
  if (badAt(x, z) > 0.35) return 'badlands';
  if (h > 150) return 'mountains';
  if (forestAt(x, z) > 0.4) return 'forest';
  if (h > 45) return 'hills';
  return 'lowland';
}

/** Mitchell best-candidate points on dry, gentle land – used for player spawns */
export function landPoints(n: number, rnd: () => number, opts: { maxR: number; avoid?: { x: number; z: number; r: number }[] }): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = [];
  const ok = (x: number, z: number) => {
    if (Math.hypot(x, z) > opts.maxR) return false;
    if (sdf(x, z) < 300) return false;
    const h = groundAt(x, z);
    if (h < 2.2 || h > 110) return false;
    if (slopeAt(x, z, 6) > 0.42) return false;
    if (riverDist(x, z) < 60) return false;
    for (const a of opts.avoid ?? []) if (Math.hypot(x - a.x, z - a.z) < a.r) return false;
    return true;
  };
  for (let i = 0; i < n; i++) {
    let best: { x: number; z: number } | null = null, bd = -1;
    for (let k = 0; k < 160; k++) {
      const x = (rnd() * 2 - 1) * 6600, z = (rnd() * 2 - 1) * 7000;
      if (!ok(x, z)) continue;
      let md = 1e9;
      for (const p of pts) md = Math.min(md, Math.hypot(p.x - x, p.z - z));
      if (md > bd) { bd = md; best = { x, z }; }
    }
    if (best) pts.push(best);
  }
  return pts;
}
