import * as THREE from 'three';
import type { Poi } from './data';

/** Procedural town kit: distinct building archetypes with oriented-rectangle hitboxes (door gaps = enterable). */
export interface Ctx {
  add: (layer: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry: number, color: number, glow?: number) => void;
  circle: (x: number, z: number, r: number, h: number) => void;
  group: THREE.Group;
  anim: ((t: number) => void)[];
  R: () => number;
  gy: number;
  indoor: (x: number, z: number) => void;
  claim: (x: number, z: number, r: number) => boolean;
  tree: (x: number, z: number, s: number, kind: number) => void;
  geo: Record<string, THREE.BufferGeometry>;
  matL: THREE.Material;
  matE: THREE.Material;
  sea: { ang: number; dist: number };
}
const TAU = Math.PI * 2;
const rr = (c: Ctx, a: number, b: number) => a + c.R() * (b - a);
const pick = <T,>(c: Ctx, a: T[]) => a[Math.floor(c.R() * a.length)];

class Loc {
  constructor(public c: Ctx, public x: number, public z: number, public ry: number) {}
  w(lx: number, lz: number): [number, number] { const s = Math.sin(this.ry), co = Math.cos(this.ry); return [this.x + lx * co + lz * s, this.z - lx * s + lz * co]; }
  add(layer: string, lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, color: number, glow = 0, lry = 0) { const [x, z] = this.w(lx, lz); this.c.add(layer, x, ly, z, sx, sy, sz, this.ry + lry, color, glow); }
  box(lx: number, ly: number, lz: number, w: number, h: number, d: number, color: number, glow = 0) { this.add('box', lx, ly, lz, w, h, d, color, glow); }
  cyl(lx: number, ly: number, lz: number, w: number, h: number, d: number, color: number, glow = 0) { this.add('cyl', lx, ly, lz, w, h, d, color, glow); }
  cone(lx: number, ly: number, lz: number, w: number, h: number, d: number, color: number, glow = 0) { this.add('cone', lx, ly, lz, w, h, d, color, glow); }
  sph(lx: number, ly: number, lz: number, w: number, h: number, d: number, color: number, glow = 0) { this.add('sph', lx, ly, lz, w, h, d, color, glow); }
  hemi(lx: number, ly: number, lz: number, w: number, h: number, d: number, color: number, glow = 0) { this.add('hemi', lx, ly, lz, w, h, d, color, glow); }
  /** gabled roof; ridge along local z (len) unless across */
  gable(lx: number, ly: number, lz: number, w: number, h: number, len: number, color: number, across = false) { if (across) this.add('prism', lx, ly, lz, len, h, w, color, 0, Math.PI / 2); else this.add('prism', lx, ly, lz, w, h, len, color); }
  pyramid(lx: number, ly: number, lz: number, w: number, h: number, d: number, color: number) { this.add('roof', lx, ly, lz, w, h, d, color); }
  /** rectangular collider: perimeter circles. door = gap on the local +z side of width dw */
  solid(w: number, d: number, h: number, door = 0, lx = 0, lz = 0) {
    const r = 0.95, step = 1.45, c = this.c;
    const edge = (x1: number, z1: number, x2: number, z2: number, gap: number) => {
      const L = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.ceil(L / step));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        if (gap && Math.abs(t - 0.5) * L < gap / 2) continue;
        const [x, z] = this.w(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t);
        c.circle(x, z, r, h);
      }
    };
    const x0 = lx - w / 2 + r * 0.6, x1 = lx + w / 2 - r * 0.6, z0 = lz - d / 2 + r * 0.6, z1 = lz + d / 2 - r * 0.6;
    edge(x0, z0, x1, z0, 0); edge(x0, z1, x1, z1, door); edge(x0, z0, x0, z1, 0); edge(x1, z0, x1, z1, 0);
    if (door) { const [ix, iz] = this.w(lx, lz); c.indoor(ix, iz); }
  }
  disc(lx: number, lz: number, r: number, color: number, y = 0.05) { const [x, z] = this.w(lx, lz); this.c.add('cyl', x, y, z, r * 2, 0.12, r * 2, 0, color); }
  slab(lx: number, lz: number, w: number, d: number, color: number, y = 0.06, h = 0.14) { this.box(lx, y, lz, w, h, d, color); }
}

const STONE = [0xb9b2a3, 0xa8a090, 0xc8c0ae, 0x9a9488];
const WOOD = [0x6b4a2a, 0x5a3c22, 0x7a5632];
const RF = [0xb5473a, 0x9a3a2a, 0xc2603f, 0x8a4a3a, 0x7a3a3a];

// ----------------------------------------------------------------- reusable furniture
function lamp(c: Ctx, x: number, z: number, col = 0xffe29a) { const l = new Loc(c, x, z, 0); l.cyl(0, 0, 0, 0.3, 4.2, 0.3, 0x2f2f38); l.box(0, 4.0, 0, 0.9, 0.12, 0.9, 0x2f2f38); l.sph(0, 4.15, 0, 0.8, 0.9, 0.8, col, 2.4); c.circle(x, z, 0.3, 4); }
function fountain(c: Ctx, x: number, z: number, r = 5, water = 0x6ad0ff) {
  const l = new Loc(c, x, z, 0);
  l.cyl(0, 0, 0, r * 2.2, 0.9, r * 2.2, 0xc9c3b4); l.cyl(0, 0.9, 0, r * 1.9, 0.12, r * 1.9, water, 0.8);
  l.cyl(0, 0, 0, r * 0.5, 2.8, r * 0.5, 0xd9d3c4); l.cyl(0, 2.8, 0, r * 1.2, 0.3, r * 1.2, 0xc9c3b4); l.cyl(0, 3.0, 0, r * 1.0, 0.1, r * 1.0, water, 0.8); l.cyl(0, 3.0, 0, r * 0.2, 1.6, r * 0.2, 0xd9d3c4); l.sph(0, 4.5, 0, 0.9, 0.9, 0.9, water, 1.2);
  c.circle(x, z, r * 1.1, 1.2);
}
function crate(c: Ctx, x: number, z: number, s = 1) { const l = new Loc(c, x, z, c.R() * 3); l.box(0, 0, 0, 1.2 * s, 1.1 * s, 1.2 * s, pick(c, WOOD)); l.box(0, 0.5 * s, 0, 1.3 * s, 0.1 * s, 1.3 * s, 0x3a2a1a); c.circle(x, z, 0.8 * s, 1.2 * s); }
function barrel(c: Ctx, x: number, z: number) { const l = new Loc(c, x, z, 0); l.cyl(0, 0, 0, 0.95, 1.3, 0.95, 0x7a5632); l.cyl(0, 0.3, 0, 1.0, 0.1, 1.0, 0x3a3a3a); l.cyl(0, 0.9, 0, 1.0, 0.1, 1.0, 0x3a3a3a); c.circle(x, z, 0.5, 1.3); }
function banner(c: Ctx, x: number, z: number, col: number, h = 9) { const l = new Loc(c, x, z, 0); l.cyl(0, 0, 0, 0.25, h, 0.25, 0x4a3a2a); l.box(0.8, h - 3.4, 0, 1.5, 3, 0.1, col); l.cone(0, h, 0, 0.5, 0.7, 0.5, 0xffd24a, 1.2); c.circle(x, z, 0.3, h); }
function bench(c: Ctx, x: number, z: number, ry: number) { const l = new Loc(c, x, z, ry); l.box(0, 0.5, 0, 2.4, 0.15, 0.7, 0x7a5632); l.box(-1, 0, 0, 0.2, 0.5, 0.6, 0x3a2a1a); l.box(1, 0, 0, 0.2, 0.5, 0.6, 0x3a2a1a); l.box(0, 0.9, -0.3, 2.4, 0.5, 0.1, 0x7a5632); }
function windows(b: Loc, w: number, d: number, floors: number, fh: number, y0 = 0.9, frame = 0xf0e6d0, shutter = 0, side = true) {
  const n = Math.max(1, Math.floor(w / 3.2));
  for (let f = 0; f < floors; f++) for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * (w / n);
    if (f === 0 && Math.abs(x) < 1.4) continue;
    const y = y0 + f * fh;
    b.box(x, y, d / 2 + 0.02, 1.3, 1.5, 0.12, frame); b.box(x, y + 0.12, d / 2 + 0.06, 0.95, 1.2, 0.1, 0x35506c);
    b.box(x, y + 0.65, d / 2 + 0.07, 0.08, 1.15, 0.1, frame);
    if (shutter) { b.box(x - 0.95, y, d / 2 + 0.08, 0.4, 1.5, 0.08, shutter); b.box(x + 0.95, y, d / 2 + 0.08, 0.4, 1.5, 0.08, shutter); }
    if (f === 0 && c3(b)) b.box(x, y - 0.35, d / 2 + 0.3, 1.5, 0.3, 0.5, 0x6b4a2a);
  }
  if (side) { const m = Math.max(1, Math.floor(d / 4)); for (let f = 0; f < floors; f++) for (let i = 0; i < m; i++) { const z = (i - (m - 1) / 2) * (d / m); const y = y0 + f * fh; for (const s of [-1, 1]) { b.box(s * (w / 2 + 0.02), y, z, 0.12, 1.5, 1.2, frame); b.box(s * (w / 2 + 0.06), y + 0.1, z, 0.1, 1.2, 0.9, 0x35506c); } } }
}
const c3 = (b: Loc) => b.c.R() < 0.18;
function door(b: Loc, d: number, col = 0x4a2f1c, frame = 0xe8dcc0, w = 1.8) { b.box(0, 0, d / 2 + 0.04, w + 0.5, 2.7, 0.14, frame); b.box(0, 0, d / 2 + 0.1, w, 2.5, 0.12, col); b.sph(w * 0.3, 1.1, d / 2 + 0.2, 0.18, 0.18, 0.18, 0xffd24a); b.box(0, -0.0, d / 2 + 0.7, w + 1, 0.22, 1.2, 0x9a948a); }
function chimney(b: Loc, lx: number, ly: number, lz: number, h = 2.6) { b.box(lx, ly, lz, 1.1, h, 1.1, 0x8a7a6a); b.box(lx, ly + h, lz, 1.4, 0.25, 1.4, 0x5a5048); b.cyl(lx, ly + h + 0.25, lz, 0.5, 0.3, 0.5, 0x2a2a2a); }

// ----------------------------------------------------------------- building archetypes
type Pal = { wall: number[]; roof: number[]; trim: number; shut: number[] };
function cottage(c: Ctx, x: number, z: number, ry: number, pal: Pal, big = 1) {
  const b = new Loc(c, x, z, ry);
  const w = rr(c, 7, 10) * big, d = rr(c, 7, 11) * big, h = rr(c, 3.6, 4.6);
  const wall = pick(c, pal.wall), roof = pick(c, pal.roof);
  b.box(0, 0, 0, w + 0.4, 0.7, d + 0.4, 0x8a8478);
  b.box(0, 0.7, 0, w, h, d, wall);
  b.gable(0, 0.7 + h, 0, w + 1.8, h * 0.62, d + 1.6, roof, true);
  b.box(0, 0.7 + h, 0, w + 1.8, 0.2, d + 1.6, 0x4a3a30);
  chimney(b, w * 0.28, 0.7 + h * 0.8, -d * 0.2, h * 0.55);
  door(b, d, pick(c, WOOD));
  windows(b, w, d, 1, h, 1.8, pal.trim, pick(c, pal.shut));
  if (c.R() < 0.4) { b.box(w * 0.5 + 1.2, 0, d * 0.1, 2.2, 1.0, 3, 0x7a5632); b.box(w * 0.5 + 1.2, 1.0, d * 0.1, 2.4, 0.15, 3.2, 0x5a3c22); } // woodshed
  b.solid(w + 0.4, d + 0.4, h + 3, 0);
}
function timber(c: Ctx, x: number, z: number, ry: number, pal: Pal, floors = 2) {
  const b = new Loc(c, x, z, ry);
  const w = rr(c, 9, 14), d = rr(c, 8, 12), fh = 3.4;
  const wall = pick(c, pal.wall), roof = pick(c, pal.roof);
  b.box(0, 0, 0, w, 1.1, d, 0x8a8478);
  let y = 1.1;
  for (let f = 0; f < floors; f++) {
    const o = f > 0 ? 0.7 : 0, ww = w + o * 2, dd = d + o * 2;
    b.box(0, y, 0, ww, fh, dd, wall);
    b.box(0, y, 0, ww + 0.1, 0.22, dd + 0.1, 0x3a2a1c); b.box(0, y + fh - 0.22, 0, ww + 0.1, 0.22, dd + 0.1, 0x3a2a1c);
    for (let i = 0; i <= 5; i++) { const px = (i / 5 - 0.5) * ww; b.box(px, y, dd / 2 + 0.05, 0.28, fh, 0.12, 0x3a2a1c); }
    if (f === floors - 1) break;
    y += fh;
  }
  const top = y + fh, ww = w + (floors > 1 ? 1.4 : 0), dd = d + (floors > 1 ? 1.4 : 0);
  b.gable(0, top, 0, ww + 1.6, 4.6, dd + 1.6, roof, true);
  b.box(0, top, 0, ww + 1.6, 0.2, dd + 1.6, 0x3a2a1c);
  if (c.R() < 0.6) { b.box(ww * 0.22, top + 1.4, dd * 0.5 - 0.3, 2.2, 2.2, 1.6, wall); b.gable(ww * 0.22, top + 3.6, dd * 0.5 - 0.3, 2.8, 1.4, 2.0, roof, true); b.box(ww * 0.22, top + 1.8, dd * 0.5 + 0.55, 1.0, 1.1, 0.1, 0x35506c); }
  chimney(b, -ww * 0.3, top - 1, -dd * 0.2, 4.2);
  door(b, d, pick(c, WOOD));
  windows(b, w, d, 1, fh, 1.9, 0xf4ecd8, pick(c, pal.shut), true);
  for (let f = 1; f < floors; f++) windows(b, w + 1.4, d + 1.4, 1, fh, 1.1 + f * fh, 0xf4ecd8, pick(c, pal.shut), false);
  b.solid(w, d, top + 4, 0);
}
function townhouse(c: Ctx, x: number, z: number, ry: number, pal: Pal) {
  const b = new Loc(c, x, z, ry);
  const w = rr(c, 5.4, 7.2), d = rr(c, 8, 11), fl = 3 + Math.floor(c.R() * 2), fh = 3.3, h = fl * fh;
  const wall = pick(c, pal.wall), roof = pick(c, pal.roof);
  b.box(0, 0, 0, w, 0.8, d, 0x7a7468); b.box(0, 0.8, 0, w, h, d, wall);
  for (let f = 1; f < fl; f++) { b.box(0, 0.8 + f * fh - 0.15, 0, w + 0.3, 0.3, d + 0.3, pal.trim); }
  // stepped gable facade
  const sx = w;
  for (let i = 0; i < 4; i++) b.box(0, 0.8 + h + i * 0.9, d / 2 - 0.4, sx * (1 - i * 0.22), 0.9, 0.8, wall);
  b.box(0, 0.8 + h + 3.6, d / 2 - 0.4, 0.4, 1.2, 0.4, 0xffd24a);
  b.gable(0, 0.8 + h, 0, w + 0.6, 2.8, d, roof, true);
  door(b, d, pick(c, WOOD), pal.trim, 1.5);
  const bal = fl > 3;
  for (let f = 0; f < fl; f++) for (const s of [-1, 1]) { if (f === 0 && s === 0) continue; const y = 0.8 + f * fh + 1.0; b.box(s * w * 0.27, y, d / 2 + 0.02, 1.1, 1.8, 0.12, pal.trim); b.box(s * w * 0.27, y + 0.1, d / 2 + 0.06, 0.8, 1.5, 0.1, 0x35506c); if (bal && f === 2) { b.box(s * w * 0.27, y - 0.4, d / 2 + 0.6, 1.6, 0.15, 1.0, 0x2a2a30); b.box(s * w * 0.27, y - 0.3, d / 2 + 1.05, 1.6, 0.8, 0.08, 0x2a2a30); } }
  b.solid(w, d, h + 6, 0);
}
function shop(c: Ctx, x: number, z: number, ry: number, pal: Pal) {
  const b = new Loc(c, x, z, ry);
  const w = rr(c, 8, 11), d = rr(c, 7, 9), h = 4.4, wall = pick(c, pal.wall);
  b.box(0, 0, 0, w, h, d, wall); b.box(0, h, 0, w + 0.5, 0.5, d + 0.5, 0x4a3a30);
  const aw = [pick(c, [0xd23a3a, 0x3a6ad2, 0x3aa86a, 0xd2a33a]), 0xf4f0e6];
  for (let i = 0; i < 8; i++) b.box(-w / 2 + (i + 0.5) * (w / 8), 3.0 - i * 0, d / 2 + 0.9, w / 8, 0.12, 2.2, aw[i % 2]);
  b.box(0, 1.2, d / 2 + 0.6, w * 0.7, 1.0, 1.0, 0x7a5632); // counter
  b.box(-w / 2 + 0.5, 0, d / 2 + 1.6, 0.18, 3.0, 0.18, 0x4a3a2a); b.box(w / 2 - 0.5, 0, d / 2 + 1.6, 0.18, 3.0, 0.18, 0x4a3a2a);
  b.box(0, h + 0.5, d / 2 - 0.2, w * 0.6, 1.4, 0.3, pick(c, RF)); b.box(0, h + 0.7, d / 2 - 0.05, w * 0.5, 1.0, 0.1, 0xffe9b0, 0.6);
  for (let i = 0; i < 3; i++) b.sph(-w * 0.25 + i * w * 0.25, 2.3, d / 2 + 0.7, 0.5, 0.5, 0.5, pick(c, [0xff5a5a, 0xffc23a, 0x7ad65a]));
  b.solid(w, d, h + 1, 0);
  barrel(c, ...b.w(w / 2 + 1.3, d / 2 + 1)); crate(c, ...b.w(-w / 2 - 1.2, d / 2 + 1));
}
function inn(c: Ctx, x: number, z: number, ry: number, pal: Pal) {
  const b = new Loc(c, x, z, ry);
  const w = 16, d = 11, h = 7;
  b.box(0, 0, 0, w, 1.0, d, 0x8a8478); b.box(0, 1, 0, w, h, d, pick(c, pal.wall));
  b.box(0, 1 + h * 0.5, 0, w + 0.1, 0.3, d + 0.1, 0x3a2a1c);
  b.gable(0, 1 + h, 0, w + 2, 5.2, d + 1.6, pick(c, pal.roof), true);
  b.box(-w * 0.3, 1 + h, 0, 6, 3, d + 1, pick(c, pal.wall)); b.gable(-w * 0.3, 1 + h + 3, 0, 7, 3, d + 2, pick(c, pal.roof), false);
  chimney(b, w * 0.32, 4, -2, 7); chimney(b, -w * 0.1, 4, 2, 6);
  b.box(w * 0.5 + 0.3, 3.2, d * 0.2, 0.15, 1.4, 2.2, 0x3a2a1a); b.box(w * 0.5 + 1.2, 4.2, d * 0.2, 1.8, 0.1, 0.1, 0x3a2a1a); // signboard
  door(b, d, 0x3a2418, pal.trim, 2.2);
  windows(b, w, d, 2, 3.4, 1.9, pal.trim, pick(c, pal.shut), true);
  b.solid(w, d, h + 6, 2.6);
  for (let i = 0; i < 3; i++) { bench(c, ...b.w(-4 + i * 4, d / 2 + 3), ry); }
}
function clockTower(c: Ctx, x: number, z: number, ry: number, hh = 30) {
  const b = new Loc(c, x, z, ry);
  b.box(0, 0, 0, 11, 6, 11, 0xb4ac9c); b.box(0, 6, 0, 8.4, hh, 8.4, pick(c, STONE)); b.box(0, 6 + hh * 0.5, 0, 8.8, 0.5, 8.8, 0x7a7468);
  for (const [dx, dz] of [[0, 4.3], [0, -4.3], [4.3, 0], [-4.3, 0]]) { const [wx, wz] = b.w(dx, dz); c.add('cyl', wx, 6 + hh - 6, wz, 5.2, 0.4, 5.2, 0, 0xf2ead4); }
  b.box(0, 6 + hh - 6.2, 4.25, 5.6, 5.6, 0.3, 0xf2ead4); b.box(0, 6 + hh - 3.5, 4.45, 0.2, 2.3, 0.15, 0x222222); b.box(0.5, 6 + hh - 3.5, 4.45, 1.6, 0.2, 0.15, 0x222222);
  b.box(0, 6 + hh - 6.2, -4.25, 5.6, 5.6, 0.3, 0xf2ead4); b.box(4.25, 6 + hh - 6.2, 0, 0.3, 5.6, 5.6, 0xf2ead4); b.box(-4.25, 6 + hh - 6.2, 0, 0.3, 5.6, 5.6, 0xf2ead4);
  b.box(0, 6 + hh, 0, 10, 1, 10, 0x7a7468);
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) b.box(sx * 4.4, 6 + hh + 1, sz * 4.4, 1.2, 1.6, 1.2, 0x7a7468);
  b.pyramid(0, 6 + hh + 1, 0, 9, 14, 9, 0x3a6a8a); b.sph(0, 6 + hh + 15, 0, 0.9, 0.9, 0.9, 0xffd24a, 1.6);
  b.solid(11, 11, hh + 10, 0);
}
function church(c: Ctx, x: number, z: number, ry: number, big = 1) {
  const b = new Loc(c, x, z, ry);
  const w = 16 * big, d = 34 * big, h = 14 * big;
  b.box(0, 0, 0, w + 1, 1.2, d + 1, 0xa8a090); b.box(0, 1.2, 0, w, h, d, 0xe4dccb);
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const z0 = (i / 5 - 0.5) * (d - 6); b.box(s * (w / 2 + 0.5), 1.2, z0, 1.2, h * 0.8, 1.2, 0xc8c0ae); b.box(s * (w / 2 + 0.1), 5, z0 + d / 12, 0.2, 5, 1.8, 0x4a78b8); }
  b.gable(0, 1.2 + h, 0, w + 1.5, 8 * big, d + 1, 0x4a5a78, true);
  b.box(0, 1.2 + h + 8 * big, 0, 0.5, 0.5, d + 1, 0xc8a850);
  for (const s of [-1, 1]) { b.box(s * (w / 2 - 1.5), 1.2, d / 2 - 1, 5, h + 12, 5, 0xe4dccb); b.pyramid(s * (w / 2 - 1.5), 1.2 + h + 12, d / 2 - 1, 6, 12, 6, 0x4a5a78); b.sph(s * (w / 2 - 1.5), 1.2 + h + 24.4, d / 2 - 1, 0.9, 0.9, 0.9, 0xffd24a, 1.4); b.box(s * (w / 2 - 1.5), 1.2 + h + 6, d / 2 + 1.55, 1.6, 3.5, 0.2, 0x2a3a58); }
  b.cyl(0, 1.2 + h * 0.62, d / 2 + 0.1, 5.2, 0.5, 5.2, 0xd9d0b8); b.box(0, 1.2 + h * 0.62 - 2.2, d / 2 + 0.1, 4.4, 4.4, 0.5, 0x6ab0ff, 0.8);
  b.box(0, 1.2, d / 2 + 0.08, 3.4, 5.6, 0.3, 0x3a2418); b.box(0, 1.2, d / 2 + 0.5, 4.8, 0.3, 2, 0xb8b0a0); b.box(0, 1.2, d / 2 + 1.2, 6, 0.2, 2, 0xa8a090);
  b.solid(w + 1, d + 1, h + 14, 3.6);
}
function dome(c: Ctx, x: number, z: number, ry: number, col: number, dcol: number, r = 11) {
  const b = new Loc(c, x, z, ry);
  b.cyl(0, 0, 0, r * 2.4, 1.2, r * 2.4, 0xc9c0ad); b.cyl(0, 1.2, 0, r * 2, r * 0.9, r * 2, col);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; b.cyl(Math.cos(a) * r * 1.02, 1.2, Math.sin(a) * r * 1.02, 0.9, r * 0.9, 0.9, 0xf0e8d0); }
  b.cyl(0, 1.2 + r * 0.9, 0, r * 2.1, 0.5, r * 2.1, 0xe0d4a8);
  b.hemi(0, 1.2 + r * 0.9 + 0.4, 0, r * 1.9, r * 1.1, r * 1.9, dcol); b.cyl(0, 1.2 + r * 2, 0, 0.3, r * 0.5, 0.3, 0xffd24a); b.sph(0, 1.2 + r * 2.5, 0, 0.9, 0.9, 0.9, 0xffd24a, 1.5);
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { b.cyl(sx * r * 1.4, 0, sz * r * 1.4, 2.2, r * 1.5, 2.2, 0xf0e8d0); b.cone(sx * r * 1.4, r * 1.5, sz * r * 1.4, 3, r * 0.7, 3, dcol); }
  b.solid(r * 2.2, r * 2.2, r * 2, 5);
}
function wizardTower(c: Ctx, x: number, z: number, ry: number, h = 40, col = 0x6a5aa8, glow = 0xb58cff) {
  const b = new Loc(c, x, z, ry);
  let y = 0, r = 8;
  while (y < h) { const seg = 7 + c.R() * 3; b.cyl(0, y, 0, r * 2, seg, r * 2, col); b.cyl(0, y + seg, 0, r * 2.3, 0.7, r * 2.3, 0xd8c8f0); y += seg + 0.7; r *= 0.88; }
  for (let k = 0; k < 6; k++) { const a = k * 1.7 + y; b.box(Math.cos(a) * r * 1.0, y * 0.3 + k * 4, Math.sin(a) * r * 1.0, 0.1, 1.6, 0.9, glow, 1.5); }
  b.cone(0, y, 0, r * 2.8, h * 0.45, r * 2.8, 0x3a2a78); b.cone(0, y + h * 0.45, 0, 0.8, 4, 0.8, 0xffd24a, 1.2);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 2.4, 0.22, 6, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(glow).multiplyScalar(1.6) }));
  const [wx, wz] = b.w(0, 0); ring.position.set(wx, c.gy + y * 0.9, wz); c.group.add(ring);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.8), new THREE.MeshBasicMaterial({ color: new THREE.Color(glow).multiplyScalar(2) }));
  crystal.position.set(wx, c.gy + y + h * 0.45 + 7, wz); c.group.add(crystal);
  c.anim.push((t) => { ring.rotation.x = Math.PI / 2 + Math.sin(t * 0.7) * 0.3; ring.rotation.y = t * 0.5; ring.position.y = c.gy + y * 0.9 + Math.sin(t) * 1.2; crystal.rotation.y = t * 1.2; crystal.position.y = c.gy + y + h * 0.45 + 7 + Math.sin(t * 1.5) * 0.8; });
  b.cyl(0, 0, 0, 20, 1, 20, 0x8a7ab8);
  b.solid(15, 15, h, 4);
}
function windmill(c: Ctx, x: number, z: number, ry: number) {
  const b = new Loc(c, x, z, ry);
  b.cyl(0, 0, 0, 8, 2, 8, 0x9a9488);
  b.cone(0, 2, 0, 7, 16, 7, 0xe8dcc0); b.cone(0, 18, 0, 6, 4, 6, 0x8a3a2a);
  b.box(0, 3, 3.1, 1.5, 2.6, 0.3, 0x4a2f1c);
  const hub = new THREE.Group(); const [wx, wz] = b.w(0, 3.6);
  hub.position.set(wx, c.gy + 16.5, wz); hub.rotation.y = ry; c.group.add(hub);
  const bm = new THREE.MeshLambertMaterial({ color: 0xf0e6d0, flatShading: true }), fm = new THREE.MeshLambertMaterial({ color: 0xcdbf9f, flatShading: true });
  for (let i = 0; i < 4; i++) { const arm = new THREE.Group(); arm.rotation.z = (i * Math.PI) / 2; const spar = new THREE.Mesh(c.geo.box, fm); spar.scale.set(0.5, 15, 0.4); spar.position.y = 7.5 + 0; arm.add(spar); const sail = new THREE.Mesh(c.geo.box, bm); sail.scale.set(3.2, 10, 0.15); sail.position.set(1.8, 9, 0.1); arm.add(sail); hub.add(arm); }
  const axle = new THREE.Mesh(c.geo.sph, fm); axle.scale.set(1.6, 1.6, 1.6); hub.add(axle);
  c.anim.push((t) => { hub.children.forEach((ch, i) => { if (i < 4) ch.rotation.z = (i * Math.PI) / 2 + t * 0.35; }); });
  b.solid(6.6, 6.6, 20, 0);
}
function barn(c: Ctx, x: number, z: number, ry: number) {
  const b = new Loc(c, x, z, ry);
  const w = 16, d = 22, h = 7;
  b.box(0, 0, 0, w, h, d, 0xa8372e); b.gable(0, h, 0, w + 1.4, 6, d + 1.4, 0x5a4638, true);
  b.box(0, 0, d / 2 + 0.05, 6.4, 5.6, 0.2, 0xf0e8d8); b.box(0, 0, d / 2 + 0.1, 5.8, 5.2, 0.2, 0xa8372e);
  b.box(-1.5, 0.2, d / 2 + 0.2, 0.4, 5, 0.1, 0xf0e8d8); b.box(1.5, 0.2, d / 2 + 0.2, 0.4, 5, 0.1, 0xf0e8d8); b.box(0, 5.2, d / 2 + 0.2, 4, 0.4, 0.1, 0xf0e8d8);
  b.box(0, h + 3, d / 2 + 0.1, 1.8, 1.8, 0.2, 0xf0e8d8);
  b.solid(w, d, h + 6, 6);
  b.cyl(w * 0.8, 0, -d * 0.3, 5, 14, 5, 0xc9c3b4); b.hemi(w * 0.8, 14, -d * 0.3, 5.2, 3.5, 5.2, 0x6a7a8a); c.circle(...b.w(w * 0.8, -d * 0.3), 3, 16);
  for (let i = 0; i < 4; i++) b.cyl(w * 0.8 - 1.5 + i * 0.5, 0, -d * 0.3 + 3.2, 0.1, 14, 0.1, 0x8a8a92);
}
function farmField(c: Ctx, x: number, z: number, ry: number, w: number, d: number) {
  const b = new Loc(c, x, z, ry);
  const col = pick(c, [0x8a9a3a, 0xc2a438, 0x6a8a3a, 0x7a6a3a]);
  b.slab(0, 0, w, d, 0x6a4a2a, 0.04, 0.1);
  const rows = Math.floor(w / 2.4);
  for (let i = 0; i < rows; i++) b.box(-w / 2 + 1.2 + i * 2.4, 0.1, 0, 1.0, 0.7 + c.R() * 0.5, d - 1, col);
  for (const s of [-1, 1]) for (let i = 0; i < Math.floor(d / 3); i++) { b.box(s * (w / 2), 0, -d / 2 + i * 3, 0.15, 0.9, 0.15, 0x6b4a2a); }
}
function hut(c: Ctx, x: number, z: number, ry: number, wall = 0x7a6248, roof = 0x5a4a38) {
  const b = new Loc(c, x, z, ry);
  const w = rr(c, 5, 7), d = rr(c, 5, 7), h = 3.2;
  b.box(0, 0, 0, w, h, d, wall);
  for (let i = 0; i < 6; i++) b.box(-w / 2 + (i + 0.5) * (w / 6), 0, d / 2 + 0.05, 0.12, h, 0.12, 0x3a2a1c);
  b.gable(0, h, 0, w + 1.4, 2.4, d + 1.4, roof, true);
  b.box(0, 0, d / 2 + 0.05, 1.5, 2.3, 0.15, 0x2a1c10);
  b.solid(w, d, h + 2, 0);
}
function tent(c: Ctx, x: number, z: number, ry: number, col: number) {
  const b = new Loc(c, x, z, ry);
  b.gable(0, 0, 0, 6.5, 4.4, 8, col, true); b.box(0, 0, 0, 6.2, 0.2, 7.6, 0x6a5238);
  b.box(0, 0, 4.02, 2.2, 3.2, 0.1, 0x2a1c10); b.cyl(0, 4.4, 0, 0.15, 1.4, 0.15, 0x4a3a2a); b.box(0.5, 5.2, 0, 1.0, 0.6, 0.08, 0xe84a3a);
  b.solid(6.4, 7.6, 4.5, 2.4);
}
function pier(c: Ctx, x: number, z: number, ry: number, len = 70, w = 6) {
  const b = new Loc(c, x, z, ry);
  b.box(0, -0.3, len / 2, w, 0.5, len, 0x7a5a38);
  for (let i = 0; i < len / 6; i++) { for (const s of [-1, 1]) b.cyl(s * (w / 2), -5, 3 + i * 6, 0.7, 6, 0.7, 0x4a3a2a); b.box(0, -0.05, 3 + i * 6, w + 0.2, 0.1, 0.3, 0x5a4228); }
  for (let i = 0; i < len / 12; i++) for (const s of [-1, 1]) { b.cyl(s * (w / 2 + 0.2), 0, 6 + i * 12, 0.5, 1.8, 0.5, 0x3a2a1c); b.sph(s * (w / 2 + 0.2), 1.6, 6 + i * 12, 0.5, 0.4, 0.5, 0xffe29a, 1.8); }
  for (let i = 0; i < len / 6; i++) { b.cyl(-w / 2 - 0.15, 0, 3 + i * 6, 0.12, 1.6, 0.12, 0x3a2a1c); }
}
function ship(c: Ctx, x: number, z: number, ry: number, s = 1, sail = 0xf2ead8) {
  const b = new Loc(c, x, z, ry);
  b.box(0, -0.6, 0, 6 * s, 3 * s, 18 * s, 0x6a4a2a); b.box(0, 2.2 * s, 0, 6.4 * s, 0.4 * s, 18.4 * s, 0x8a6a3a); b.box(0, 1.0 * s, 0, 4.6 * s, 2 * s, 14 * s, 0x5a3a20);
  b.cone(0, -0.6, 10 * s, 5.4 * s, 3 * s, 3.6 * s, 0x6a4a2a);
  b.cyl(0, 2.4 * s, 1 * s, 0.7 * s, 20 * s, 0.7 * s, 0x4a3a2a); b.box(0, 7 * s, 0.3 * s, 0.2 * s, 12 * s, 6 * s, sail); b.box(0, 16 * s, 0.9 * s, 0.2 * s, 4 * s, 3.4 * s, 0xe84a3a);
  b.box(0, 2.6 * s, -7.5 * s, 5 * s, 2.4 * s, 4 * s, 0x7a5632);
  c.circle(...b.w(0, 0), 3.2 * s, 6); c.circle(...b.w(0, 5 * s), 3 * s, 6); c.circle(...b.w(0, -5 * s), 3 * s, 6);
}
function lighthouse(c: Ctx, x: number, z: number, h = 60) {
  const b = new Loc(c, x, z, 0);
  b.cyl(0, 0, 0, 20, 3, 20, 0x8a8a92);
  for (let i = 0; i < 6; i++) { const r = 8 - i * 0.7; b.cyl(0, 3 + i * (h / 6), 0, r * 2, h / 6, r * 2, i % 2 ? 0xe84a3a : 0xf4f0e6); }
  b.cyl(0, 3 + h, 0, 11, 1, 11, 0x2a2a30); b.cyl(0, 4 + h, 0, 7, 5, 7, 0xfff0b0, 2.2); b.cone(0, 9 + h, 0, 9, 5, 9, 0xe84a3a);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; b.box(Math.cos(a) * 3.4, 4 + h, Math.sin(a) * 3.4, 0.3, 5, 0.3, 0x2a2a30); }
  const [wx, wz] = b.w(0, 0);
  const beamG = new THREE.Group(); beamG.position.set(wx, c.gy + h + 6.5, wz);
  const bm = new THREE.Mesh(new THREE.ConeGeometry(14, 160, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  bm.rotation.z = Math.PI / 2; bm.position.x = 80; beamG.add(bm); c.group.add(beamG);
  c.anim.push((t) => { beamG.rotation.y = t * 0.8; });
  b.box(14, 0, 4, 7, 4, 6, 0xc9bfa8); b.gable(14, 4, 4, 8, 2.6, 7, 0x8a3a2a, true);
  c.circle(x, z, 9, h);
  c.circle(...b.w(14, 4), 4.5, 6);
}
function castleKeep(c: Ctx, x: number, z: number, ry: number) {
  const b = new Loc(c, x, z, ry);
  const W = 70, D = 54, H = 36;
  b.box(0, 0, 0, W + 8, 4, D + 8, 0x9a9488); b.box(0, 4, 0, W, H, D, 0xe4dccb);
  for (let i = 0; i < 12; i++) b.box(-W / 2 + (i + 0.5) * (W / 12), 4 + H, D / 2, 3.4, 2.4, 2, 0xd0c6ae);
  b.box(0, 4 + H, 0, W - 6, 1.2, D - 6, 0x8a8478);
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { b.cyl(sx * W / 2, 0, sz * D / 2, 14, 70, 14, 0xdcd2bc); b.cyl(sx * W / 2, 70, sz * D / 2, 17, 2, 17, 0x8a8478); b.cone(sx * W / 2, 72, sz * D / 2, 17, 26, 17, 0x2a52a8); b.sph(sx * W / 2, 98, sz * D / 2, 1.4, 1.4, 1.4, 0xffd24a, 1.5); b.box(sx * W / 2 + 1, 45, sz * D / 2 + sz * 7.1, 2.2, 5, 0.4, 0x2a3a58); c.circle(...b.w(sx * W / 2, sz * D / 2), 7.6, 74); }
  b.box(0, 4 + H, 0, 30, 24, 24, 0xe8e0d0); b.gable(0, 4 + H + 24, 0, 34, 14, 28, 0x2a52a8, true); b.box(0, 4 + H + 38, 0, 0.8, 0.8, 28, 0xffd24a);
  b.cyl(0, 4 + H + 24, 0, 5, 16, 5, 0xe8e0d0); b.cone(0, 4 + H + 40, 0, 7, 20, 7, 0x2a52a8); b.sph(0, 4 + H + 61, 0, 1.6, 1.6, 1.6, 0xffd24a, 1.6);
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) { b.box(s * (W * 0.32), 4 + 7 + (i % 2) * 14, D / 2 + 0.1, 3, 6, 0.2, 0x35506c); }
  b.box(0, 4, D / 2 + 0.2, 12, 14, 0.4, 0x3a2418); b.box(0, 18, D / 2 + 0.2, 14, 1.2, 0.5, 0xc8a850);
  for (let i = 0; i < 7; i++) b.box(0, i * 0.6, D / 2 + 3 + (6 - i) * 1.2, 22, 0.6, 1.2, 0xb4ac9c);
  for (let i = 0; i < 4; i++) banner(c, ...b.w(-24 + i * 16, D / 2 + 12), pick(c, [0x2a52a8, 0xd23a3a]), 13);
  b.solid(W, D, H + 10, 14);
}
function mansionHall(c: Ctx, x: number, z: number, ry: number) {
  const b = new Loc(c, x, z, ry);
  b.box(0, 0, 0, 44, 2, 28, 0xcfc6b0); b.box(0, 2, 0, 40, 14, 22, 0xf2e8cf);
  for (const s of [-1, 1]) { b.box(s * 26, 2, 0, 16, 11, 20, 0xf2e8cf); b.gable(s * 26, 13, 0, 18, 7, 22, 0xc8a850, true); }
  b.gable(0, 16, 0, 42, 10, 24, 0xc8a850, true);
  for (let i = 0; i < 6; i++) { b.cyl(-9 + i * 3.6, 2, 13, 1.5, 14, 1.5, 0xfff8e4); b.box(-9 + i * 3.6, 2, 13, 2, 0.6, 2, 0xe0d4b0); b.box(-9 + i * 3.6, 16, 13, 2, 0.6, 2, 0xe0d4b0); }
  b.gable(0, 16.6, 13, 24, 5, 3, 0xe8d8a0, true);
  b.box(0, 2, 11.1, 6, 8, 0.3, 0x3a2418);
  for (let i = 0; i < 5; i++) for (const f of [0, 1]) b.box(-14 + i * 7, 5 + f * 6.5, 11.2, 2, 3, 0.2, 0x35506c);
  b.cyl(0, 24, 0, 8, 4, 8, 0xe8d8a0); b.hemi(0, 28, 0, 9, 5, 9, 0xffd24a, 0.4); b.sph(0, 33, 0, 1, 1, 1, 0xffd24a, 1.5);
  b.solid(44, 28, 22, 6);
}
function casino(c: Ctx, x: number, z: number, ry: number, col: number) {
  const b = new Loc(c, x, z, ry);
  b.box(0, 0, 0, 56, 3, 40, 0x2a1a3a); b.box(0, 3, 0, 52, 22, 36, col);
  for (let i = 0; i < 5; i++) { b.box(0, 3 + i * 4.4, 18.1, 52.5, 0.35, 0.3, 0xff4fd8, 2.4); }
  for (let i = 0; i < 14; i++) b.sph(-26 + i * 4, 25.6, 18.4, 0.9, 0.9, 0.9, i % 2 ? 0xffe14a : 0xff4fd8, 2.6);
  for (const s of [-1, 1]) { b.cyl(s * 22, 3, 21, 3, 22, 3, 0x1a1020); b.sph(s * 22, 25, 21, 3.4, 3.4, 3.4, 0xffd24a, 2); b.box(s * 22, 3, 21, 3.6, 0.5, 3.6, 0xff4fd8, 2); }
  b.box(0, 3, 18.2, 10, 8, 0.4, 0xffd24a, 1.2); b.box(0, 3, 18.4, 8, 7.4, 0.3, 0x120a1c);
  b.box(0, 25, 0, 40, 8, 26, 0x1a0e28); b.box(0, 25, 13.2, 36, 6, 0.5, 0xff4fd8, 1.5);
  for (let i = 0; i < 4; i++) b.box(-10.5 + i * 7, 27, 13.5, 4.4, 4.4, 0.4, [0xffe14a, 0xff3a3a, 0x3af0ff, 0x7aff5a][i], 2.4);
  b.cone(0, 33, 0, 14, 10, 14, 0x2a1a3a); b.sph(0, 43, 0, 3, 3, 3, 0xff4fd8, 2.6);
  b.box(0, 36, 0, 22, 4, 8, 0xffe14a, 1.4); // spinning sign mimic
  b.solid(52, 36, 34, 10);
  for (const s of [-1, 1]) { b.box(s * 16, 0, 28, 8, 0.2, 14, 0x3a1a4a); b.disc(s * 16, 28, 3.4, 0xff4fd8, 0.3); }
}
function bunker(c: Ctx, x: number, z: number, ry: number) {
  const b = new Loc(c, x, z, ry);
  b.box(0, 0, 0, 30, 7, 20, 0x6a6e74); b.box(0, 7, 0, 32, 1, 22, 0x4a4e54);
  b.box(0, 0, 10.05, 6, 5, 0.3, 0x2a2a30); b.box(-9, 4, 10.05, 4, 1.4, 0.3, 0x1a1a20); b.box(9, 4, 10.05, 4, 1.4, 0.3, 0x1a1a20);
  b.box(-8, 8, -3, 6, 4, 6, 0x5a5e64); b.cyl(8, 8, -3, 3, 5, 3, 0x8a3a2a);
  b.box(0, 0, 10.2, 10, 0.4, 2, 0xe8c23a); for (let i = 0; i < 6; i++) b.box(-5 + i * 2, 0.2, 10.2, 1, 0.2, 2.02, 0x1a1a1a);
  b.solid(30, 20, 9, 5);
}
function watchtower(c: Ctx, x: number, z: number, h = 16) {
  const b = new Loc(c, x, z, 0);
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) b.box(sx * 2.2, 0, sz * 2.2, 0.6, h, 0.6, 0x5a3c22);
  for (let i = 0; i < 3; i++) { b.box(0, 2 + i * 4.5, 2.2, 4.4, 0.2, 0.2, 0x4a2f1c); b.box(0, 2 + i * 4.5, -2.2, 4.4, 0.2, 0.2, 0x4a2f1c); }
  b.box(0, h, 0, 6.4, 0.5, 6.4, 0x7a5632); b.box(0, h + 0.5, 3, 6.4, 1.3, 0.2, 0x6a4a2a); b.box(0, h + 0.5, -3, 6.4, 1.3, 0.2, 0x6a4a2a);
  b.pyramid(0, h + 1.8, 0, 8, 4, 8, 0x5a4a38);
  c.circle(x, z, 3.2, h + 4);
}
function palisade(c: Ctx, x: number, z: number, r: number, gaps: number[], h = 6) {
  const n = Math.floor((TAU * r) / 2.1);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    if (gaps.some((g) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.1)) continue;
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    c.add('cyl', px, 0, pz, 1.1, h + (i % 3) * 0.5, 1.1, 0, 0x6b4a2a); c.add('cone', px, h + (i % 3) * 0.5, pz, 1.1, 1.2, 1.1, 0, 0x6b4a2a);
    c.circle(px, pz, 1.1, h);
  }
}
function cityWall(c: Ctx, x: number, z: number, r: number, n: number, gates: number[], h = 18) {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU;
    const x0 = x + Math.cos(a0) * r, z0 = z + Math.sin(a0) * r, x1 = x + Math.cos(a1) * r, z1 = z + Math.sin(a1) * r;
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
    const b = new Loc(c, mx, mz, ry);
    const gate = gates.includes(i);
    if (gate) {
      for (const s of [-1, 1]) { b.box(s * (L / 2 - 14), 0, 0, L / 2 - 8, h, 5, 0xcfc6b0); }
      b.box(0, h * 0.72, 0, 20, h * 0.28, 5.4, 0xcfc6b0); b.box(0, h * 0.72, 0, 20.4, 1, 6, 0xb8b0a0);
      for (const s of [-1, 1]) { b.box(s * 8, 0, 0, 2.4, h * 0.8, 6, 0xe0d8c4); c.circle(...b.w(s * 11, 0), 3, h); }
      b.box(0, h * 0.72 + h * 0.28, 0, 22, 3, 6, 0xb8b0a0); banner(c, ...b.w(-9, 4), 0xd23a3a, 20); banner(c, ...b.w(9, 4), 0xd23a3a, 20);
      for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const px = s * (14 + k * (L / 2 - 20) / 3.2); const [wx, wz] = b.w(px, 0); c.circle(wx, wz, 3.4, h); }
    } else {
      b.box(0, 0, 0, L + 1, h, 5, 0xcfc6b0);
      for (let k = 0; k < Math.floor(L / 6); k++) b.box(-L / 2 + k * 6 + 3, h, 1.8, 3, 2.2, 1.2, 0xbab2a0);
      for (let k = 0; k <= Math.floor(L / 3); k++) { const [wx, wz] = b.w(-L / 2 + k * 3, 0); c.circle(wx, wz, 3.4, h); }
    }
    const tb = new Loc(c, x0, z0, a0);
    tb.cyl(0, 0, 0, 11, h + 10, 11, 0xdcd2bc); tb.cyl(0, h + 10, 0, 13, 1.6, 13, 0x8a8478); tb.cone(0, h + 11.6, 0, 13, 14, 13, 0xb5473a); tb.sph(0, h + 26, 0, 1.2, 1.2, 1.2, 0xffd24a, 1.4);
    c.circle(x0, z0, 6, h + 10);
  }
}
function heartSculpture(c: Ctx, x: number, z: number, s = 1) {
  const h = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5aa8).multiplyScalar(1.5) });
  const l = new THREE.Mesh(new THREE.SphereGeometry(5 * s, 16, 12), mat), r = l.clone(), cone = new THREE.Mesh(new THREE.ConeGeometry(7.6 * s, 11 * s, 4), mat);
  l.position.set(-3.6 * s, 4 * s, 0); r.position.set(3.6 * s, 4 * s, 0); cone.rotation.set(0, Math.PI / 4, Math.PI); cone.position.set(0, -1.2 * s, 0); cone.scale.set(1, 1, 0.6);
  h.add(l, r, cone); h.position.set(x, c.gy + 36 * s, z); c.group.add(h);
  c.anim.push((t) => { h.rotation.y = t * 0.6; h.position.y = c.gy + 36 * s + Math.sin(t * 1.2) * 2; h.scale.setScalar(1 + Math.sin(t * 3) * 0.04); });
  const b = new Loc(c, x, z, 0); b.cyl(0, 0, 0, 16, 2, 16, 0xf2c4d6); b.cyl(0, 2, 0, 6, 28 * s, 6, 0xf8e0ea); b.cyl(0, 2, 0, 11, 1, 11, 0xffffff);
  c.circle(x, z, 4, 30);
}
function shisoTree(c: Ctx, x: number, z: number) {
  const b = new Loc(c, x, z, 0);
  // roots
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + 0.3; const r = 11; b.add('cone', Math.cos(a) * r, 0, Math.sin(a) * r, 5, 16, 5, 0x5a3e24, 0, 0); const root = c.R(); void root; }
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + 0.3; const [px, pz] = b.w(Math.cos(a) * 12, Math.sin(a) * 12); c.add('cone', px, 0, pz, 4.4, 9, 4.4, 0, 0x4e3620); }
  b.cyl(0, 0, 0, 20, 30, 20, 0x5e4228); b.cyl(0, 30, 0, 16, 26, 16, 0x654830); b.cyl(0, 54, 0, 13, 16, 13, 0x6a4c32);
  for (let i = 0; i < 6; i++) { const a = i * 1.05; b.cyl(Math.cos(a) * 8, 38 + i * 3, Math.sin(a) * 8, 4, 22, 4, 0x5a3e24); }
  const greens = [0x2f7a3a, 0x3a8a44, 0x2a6a38, 0x4a9a4a, 0x3a7a3a];
  for (let i = 0; i < 34; i++) {
    const a = c.R() * TAU, d = Math.sqrt(c.R()) * 52, y = 66 + c.R() * 30 - (d / 52) * 12;
    b.sph(Math.cos(a) * d, y, Math.sin(a) * d, 26 + c.R() * 18, 18 + c.R() * 12, 26 + c.R() * 18, pick(c, greens));
  }
  for (let i = 0; i < 26; i++) { const a = c.R() * TAU, d = 10 + c.R() * 40, y = 52 + c.R() * 18; b.cyl(Math.cos(a) * d, y, Math.sin(a) * d, 0.12, 6 + c.R() * 5, 0.12, 0x6a4a2a); b.sph(Math.cos(a) * d, y - 1.4, Math.sin(a) * d, 1.4, 1.8, 1.4, pick(c, [0xffd24a, 0xff8a5a, 0xfff0a0]), 2.0); }
  c.circle(x, z, 10.5, 80);
  // plaza
  b.cyl(0, 0, 0, 120, 0.3, 120, 0xb4ae9e); b.cyl(0, 0.2, 0, 98, 0.2, 98, 0xa8a292); b.cyl(0, 0.3, 0, 60, 0.12, 60, 0x9a9488);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; const [px, pz] = b.w(Math.cos(a) * 48, Math.sin(a) * 48); c.add('box', px, 0, pz, 1.6, 2.4 + (i % 3) * 0.6, 1.6, a, 0x8a8478); c.add('box', px, 2.5 + (i % 3) * 0.6, pz, 0.9, 0.6, 0.12, a, 0x7be08a, 2.2); c.circle(px, pz, 1.1, 3); }
  // eta's shrine
  const sh = new Loc(c, x + 28, z + 30, -0.7);
  sh.box(0, 0, 0, 10, 0.8, 10, 0xb8b0a0); for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) sh.cyl(sx * 4, 0.8, sz * 4, 0.9, 6, 0.9, 0xd8402a);
  sh.box(0, 6.8, 0, 11, 0.7, 11, 0x3a2a30); sh.pyramid(0, 7.5, 0, 13, 4.2, 13, 0x3a2a30);
  sh.sph(0, 0.8, 0, 1.4, 1.4, 1.4, 0x7be08a, 2); c.circle(...sh.w(0, 0), 7, 8);
  for (let i = 0; i < 5; i++) { const a = i * 1.25 + 0.4; bench(c, ...b.w(Math.cos(a) * 36, Math.sin(a) * 36), a + 1.57); }
  // signposts toward every city
  const sp = new Loc(c, x - 20, z + 24, 0.3); sp.cyl(0, 0, 0, 0.4, 5, 0.4, 0x5a3c22);
  for (let i = 0; i < 4; i++) sp.add('box', 1.2, 3.8 - i * 0.9, 0, 3.2, 0.6, 0.15, 0x8a6a40, 0, (i - 1.5) * 0.7);
  c.circle(x - 20, z + 24, 0.4, 5);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(46, 0.4, 6, 80), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7be08a).multiplyScalar(1.4), transparent: true, opacity: 0.55 }));
  ring.rotation.x = Math.PI / 2; ring.position.set(x, c.gy + 0.6, z); c.group.add(ring);
  c.anim.push((t) => { (ring.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(t * 1.5) * 0.2; });
}
function ruins(c: Ctx, x: number, z: number, n: number, r: number) {
  for (let i = 0; i < n; i++) {
    const a = c.R() * TAU, d = Math.sqrt(c.R()) * r, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    if (!c.claim(px, pz, 3)) continue;
    const h = 3 + c.R() * 9, l = new Loc(c, px, pz, c.R() * 6);
    l.cyl(0, 0, 0, 2.4, h, 2.4, 0xcdbf9f); l.box(0, h, 0, 3, 0.6, 3, 0xbab08e); if (c.R() < 0.5) l.box(1.4, 0, 0.4, 2.2, 1.2, 2.2, 0xb0a684);
    c.circle(px, pz, 1.3, h);
  }
}
function cyclopsSkull(c: Ctx, x: number, z: number) {
  const b = new Loc(c, x, z, c.R() * 6);
  b.sph(0, 0.4, 0, 6, 5, 6, 0xe9e2cf); b.sph(0, 1.8, 2.6, 2.4, 2.4, 1.4, 0x1a1410); b.box(0, 0, 0, 4.4, 1.2, 4.4, 0xd9d0b8);
  for (let i = 0; i < 6; i++) b.cone(-2 + i * 0.8, 0.2, 3, 0.4, 1.0, 0.4, 0xf4eedd);
  c.circle(x, z, 2.8, 5);
}
function hedgeMaze(c: Ctx, x: number, z: number, ry: number, n = 6) {
  const b = new Loc(c, x, z, ry);
  const cell = 7;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    if (c.R() < 0.18 && !(i === n / 2 && j === 0)) continue;
    const lx = (i - n / 2) * cell, lz = (j - n / 2) * cell;
    if ((i + j) % 2 === 0 || c.R() < 0.5) { b.box(lx, 0, lz, cell * 0.95, 2.6, 1.6, 0x2f6a34); const [wx, wz] = b.w(lx, lz); c.circle(wx, wz, 1.6, 2.6); b.box(lx, 2.6, lz, cell * 0.85, 0.5, 1.2, 0x3a7a3e); }
    if (c.R() < 0.5 && j < n) { b.box(lx, 0, lz + cell / 2, 1.6, 2.6, cell * 0.95, 0x2f6a34); const [wx, wz] = b.w(lx, lz + cell / 2); c.circle(wx, wz, 1.6, 2.6); }
  }
}
function courtArena(c: Ctx, x: number, z: number) {
  const b = new Loc(c, x, z, 0);
  b.box(0, 0, 0, 74, 0.3, 44, 0xc2563a); b.box(0, 0.3, 0, 70, 0.1, 40, 0xe07a4a); b.box(0, 0.3, 0, 0.8, 0.12, 40, 0xffffff);
  
  b.cyl(0, 0.35, 0, 12, 0.12, 12, 0xf4eee0);
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) b.box(0, i * 1.1, s * (26 + i * 2.4), 76, 1.1, 2.4, [0x3a4a7a, 0x4a5a8a, 0x5a6a9a, 0x6a7aaa][i]);
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) b.box(s * (40 + i * 2.4), i * 1.1, 0, 2.4, 1.1, 50, [0x3a4a7a, 0x4a5a8a, 0x5a6a9a, 0x6a7aaa][i]);
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { b.cyl(sx * 42, 0, sz * 28, 1.2, 16, 1.2, 0x2a2a34); b.sph(sx * 42, 16, sz * 28, 2, 2, 2, 0xfff2b0, 2.4); }
  b.solid(2, 2, 3, 0, 0, 0); // center marker
  for (const s of [-1, 1]) { b.solid(76, 2.4, 6, 0, 0, s * 28); }
  for (const s of [-1, 1]) { b.solid(2.4, 50, 6, 0, s * 42, 0); }
}
function boat(c: Ctx, x: number, z: number, ry: number) { const b = new Loc(c, x, z, ry); b.box(0, -0.4, 0, 2.4, 1.2, 7, 0x8a5a30); b.box(0, 0.8, 0, 2.6, 0.2, 7.2, 0x6a4020); b.box(0, 0.8, 1, 0.2, 3, 0.2, 0x3a2a1a); b.box(0.9, 1.4, 1, 0.1, 2, 1.8, 0xf2ead8); c.circle(x, z, 2.4, 2); }
function gardenPlot(c: Ctx, x: number, z: number, ry: number) { const b = new Loc(c, x, z, ry); b.box(0, 0, 0, 7, 0.35, 5, 0x5a4026); for (let i = 0; i < 12; i++) b.sph(-3 + (i % 6) * 1.2, 0.4, -1.5 + Math.floor(i / 6) * 3, 0.7, 0.8, 0.7, pick(c, [0xff5a8a, 0xffd24a, 0xffffff, 0xb58cff, 0xff8a3a])); }

// ----------------------------------------------------------------- layouts
const PALS: Record<string, Pal> = {
  market: { wall: [0xf0e0b8, 0xe8c9a0, 0xf2d7a8, 0xdcb98c, 0xf4ead0], roof: [0xb5473a, 0xc2603f, 0x9a3a2a, 0xd0743a], trim: 0xfff4dc, shut: [0x3a6a8a, 0x2f7a5a, 0x8a3a3a] },
  village: { wall: [0xe8dcc0, 0xd8c8a0, 0xf0e8d0], roof: [0x8a5a3a, 0x7a4a2a, 0xa8603a], trim: 0xf4ecd8, shut: [0x4a7a4a, 0x7a4a3a] },
  village2: { wall: [0x9a8468, 0x8a7458, 0xa89070], roof: [0x5a4a38, 0x4a3a2a], trim: 0xd8c8a8, shut: [0x5a3a2a] },
  love: { wall: [0xffd9e6, 0xffe8f0, 0xf8c8de, 0xfff0d8, 0xffe0cc], roof: [0xff7ab8, 0xe85a9a, 0xff9ac8, 0xd85a8a], trim: 0xffffff, shut: [0xff5a9a, 0xb86ad8] },
  forest: { wall: [0x8a6a44, 0x7a5a38, 0x9a7a52], roof: [0x3a6a3a, 0x2f5a34, 0x4a7a3a], trim: 0xd8c8a0, shut: [0x3a5a2a] },
  port: { wall: [0xe8e4d8, 0xc8d8e8, 0xf0e8d0, 0xd8e0e8], roof: [0x3a5a8a, 0x2f4a7a, 0x4a6a9a, 0x8a3a2a], trim: 0xffffff, shut: [0x2f5a8a, 0xb8483a] },
  magic: { wall: [0xd8c8f0, 0xc8b8e8, 0xe8d8f8, 0xb8a8d8], roof: [0x5a3aa8, 0x7a4ac8, 0x3a2a88], trim: 0xf8f0ff, shut: [0x7a4ac8, 0x3a8ac8] },
};
const clear = (c: Ctx, x: number, z: number, r: number) => c.claim(x, z, r);

function streets(c: Ctx, p: Poi, spokes: number, len: number, w = 7, col = 0xa89c84) {
  const b = new Loc(c, p.x, p.z, 0);
  for (let i = 0; i < spokes; i++) { const a = (i / spokes) * TAU + 0.2; const mx = Math.cos(a) * len / 2, mz = Math.sin(a) * len / 2; b.add('box', mx, 0.05, mz, w, 0.12, len, col, 0, 0); const [wx, wz] = b.w(mx, mz); c.add('box', wx, 0.05, wz, w, 0.14, len, -a + Math.PI / 2 - Math.PI / 2 + 0, col); }
}
function ringBuildings(c: Ctx, p: Poi, r0: number, r1: number, n: number, fn: (x: number, z: number, ry: number, i: number) => void, rad = 8) {
  let k = 0, g = 0;
  while (k < n && g++ < n * 30) {
    const a = c.R() * TAU, d = r0 + Math.sqrt(c.R()) * (r1 - r0), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
    if (!clear(c, x, z, rad)) continue;
    fn(x, z, Math.atan2(p.x - x, p.z - z) + (c.R() - 0.5) * 0.5, k++);
  }
}
/** concentric "organic" street town: a plaza, a ring of civic buildings and houses facing the centre */
function organic(c: Ctx, p: Poi, _pal: Pal, mix: ((x: number, z: number, ry: number) => void)[], civic: ((x: number, z: number, ry: number) => void)[], count: number, plaza = 0xb4ae9e) {
  const b = new Loc(c, p.x, p.z, 0);
  b.cyl(0, 0, 0, 60, 0.2, 60, plaza); b.cyl(0, 0.2, 0, 44, 0.12, 44, 0xc4bead);
  streets(c, p, 6, p.r * 0.95, 8, 0xa89c84);
  civic.forEach((fn, i) => { const a = (i / civic.length) * TAU + 0.6, d = 48 + (i % 2) * 22; const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; c.claim(x, z, 22); fn(x, z, Math.atan2(p.x - x, p.z - z)); });
  ringBuildings(c, p, 70, p.r * 0.92, count, (x, z, ry, i) => mix[i % mix.length](x, z, ry), 9);
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; lamp(c, p.x + Math.cos(a) * 30, p.z + Math.sin(a) * 30); }
  for (let i = 0; i < 9; i++) { const a = c.R() * TAU, d = 55 + c.R() * (p.r - 70), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; if (clear(c, x, z, 3)) { if (i % 3 === 0) barrel(c, x, z); else if (i % 3 === 1) crate(c, x, z); else c.tree(x, z, 1 + c.R() * 0.6, 0); } }
}

export function buildTown(c: Ctx, p: Poi) {
  const pal = PALS[p.style] ?? PALS.village;
  const C = c;
  const cot = (x: number, z: number, ry: number) => cottage(C, x, z, ry, pal);
  const tim = (x: number, z: number, ry: number) => timber(C, x, z, ry, pal, 2 + Math.floor(C.R() * 2));
  const twn = (x: number, z: number, ry: number) => townhouse(C, x, z, ry, pal);
  const shp = (x: number, z: number, ry: number) => shop(C, x, z, ry, pal);
  switch (p.style) {
    case 'tree': {
      shisoTree(C, p.x, p.z);
      for (let i = 0; i < 10; i++) { const a = C.R() * TAU, d = 80 + C.R() * 120; const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; if (clear(C, x, z, 4)) C.tree(x, z, 1.2 + C.R(), i % 2); }
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 1; const x = p.x + Math.cos(a) * 95, z = p.z + Math.sin(a) * 95; if (clear(C, x, z, 8)) hut(C, x, z, a + Math.PI, 0xcfc6a8, 0x4a7a4a); }
      break;
    }
    case 'market': { // Antokiba – tournament city of prizes
      const L = new Loc(C, p.x, p.z, 0);
      organic(C, p, pal, [twn, tim, shp, twn, cot, shp, tim], [(x, z, ry) => clockTower(C, x, z, ry, 34), (x, z, ry) => inn(C, x, z, ry, pal), (x, z, ry) => church(C, x, z, ry, 0.8), (x, z, ry) => dome(C, x, z, ry, 0xe8d8b0, 0xc2603f, 12)], 70);
      fountain(C, p.x, p.z, 6);
      // tournament colosseum ring north of the plaza
      const t = new Loc(C, p.x, p.z - 150, 0); C.claim(p.x, p.z - 150, 60);
      for (let i = 0; i < 32; i++) { const a = (i / 32) * TAU; t.cyl(Math.cos(a) * 44, 0, Math.sin(a) * 44, 5.4, 18, 5.4, 0xe0d4b8); t.add('box', Math.cos(a) * 44, 18, Math.sin(a) * 44, 6, 1.4, 6, 0xc8bca0, 0, a); if (i % 4 === 0) banner(C, ...t.w(Math.cos(a) * 44, Math.sin(a) * 44), 0xd23a3a, 26); const [wx, wz] = t.w(Math.cos(a) * 44, Math.sin(a) * 44); if (!(i > 6 && i < 10)) C.circle(wx, wz, 3.1, 18); }
      t.cyl(0, 0, 0, 74, 0.4, 74, 0xd8c08a); t.cyl(0, 0.4, 0, 30, 0.12, 30, 0xb8a070);
      L.slab(0, -100, 8, 100, 0xa89c84);
      break;
    }
    case 'village': { // Rubicuta – farming town
      organic(C, p, pal, [cot, cot, tim, cot], [(x, z, ry) => windmill(C, x, z, ry), (x, z, ry) => barn(C, x, z, ry), (x, z, ry) => inn(C, x, z, ry, pal)], 30, 0xb8a888);
      for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + 0.3, d = p.r * 1.0 + 20; const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; if (clear(C, x, z, 22)) farmField(C, x, z, a + Math.PI / 2, 30 + C.R() * 14, 22 + C.R() * 14); }
      for (let i = 0; i < 4; i++) { const a = i * 1.7 + 0.5, x = p.x + Math.cos(a) * (p.r + 70), z = p.z + Math.sin(a) * (p.r + 70); if (clear(C, x, z, 14)) barn(C, x, z, a); }
      fountain(C, p.x, p.z, 4, 0x7ad0ff);
      break;
    }
    case 'magic': { // Masadora – wizard spires, domes, arcane obelisks
      organic(C, p, pal, [(x, z, ry) => wizardTower(C, x, z, ry, 16 + C.R() * 18, 0x7a5ac8, 0xb58cff), twn, tim, (x, z, ry) => dome(C, x, z, ry, 0xd8c8f0, 0x7a4ac8, 6)], [(x, z, ry) => wizardTower(C, x, z, ry, 64, 0x6a5aa8, 0xb58cff), (x, z, ry) => dome(C, x, z, ry, 0xe8d8f8, 0x5a3aa8, 14), (x, z, ry) => church(C, x, z, ry, 0.7), (x, z, ry) => wizardTower(C, x, z, ry, 46, 0x5a4a98, 0x6ad0ff)], 56, 0xa89ccc);
      const L = new Loc(C, p.x, p.z, 0);
      L.cyl(0, 0, 0, 20, 1.2, 20, 0x8a7ab8); L.cyl(0, 1.2, 0, 14, 0.4, 14, 0xd8c8f0); L.cyl(0, 1.6, 0, 3, 16, 3, 0x7a5ac8); L.sph(0, 17.6, 0, 3, 3, 3, 0xb58cff, 2.4);
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xd8b8ff).multiplyScalar(2) })); orb.position.set(p.x, C.gy + 24, p.z); C.group.add(orb);
      C.anim.push((t) => { orb.rotation.y = t; orb.position.y = C.gy + 24 + Math.sin(t * 1.5) * 1.5; });
      C.circle(p.x, p.z, 2.2, 18);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; const x = p.x + Math.cos(a) * 28, z = p.z + Math.sin(a) * 28; const o = new Loc(C, x, z, a); o.box(0, 0, 0, 1.4, 7 + (i % 3) * 2, 1.4, 0x6a5aa8); o.box(0, 7 + (i % 3) * 2, 0, 0.8, 1.6, 0.8, 0xb58cff, 1.8); C.circle(x, z, 1, 8); }
      break;
    }
    case 'castle': { // Limeiro – walled royal capital with keep
      const keepX = p.x, keepZ = p.z - p.r * 0.5;
      C.claim(keepX, keepZ, 70); castleKeep(C, keepX, keepZ, 0);
      cityWall(C, p.x, p.z, p.r, 14, [3, 10]);
      streets(C, { ...p, r: p.r * 0.8 } as Poi, 8, p.r * 0.85, 9, 0xb4ac98);
      const b = new Loc(C, p.x, p.z + 30, 0); b.cyl(0, 0, 0, 80, 0.3, 80, 0xc4bca8); b.cyl(0, 0.3, 0, 60, 0.12, 60, 0xd4ccb8);
      fountain(C, p.x, p.z + 30, 7);
      C.claim(p.x, p.z + 30, 50);
      const civic = [(x: number, z: number, ry: number) => church(C, x, z, ry, 1.1), (x: number, z: number, ry: number) => clockTower(C, x, z, ry, 40), (x: number, z: number, ry: number) => dome(C, x, z, ry, 0xe4dcc8, 0x2a52a8, 13), (x: number, z: number, ry: number) => inn(C, x, z, ry, PALS.market)];
      civic.forEach((fn, i) => { const a = (i / 4) * TAU + 0.8, d = 120; const x = p.x + Math.cos(a) * d, z = p.z + 30 + Math.sin(a) * d; if (Math.hypot(x - keepX, z - keepZ) > 90) { C.claim(x, z, 24); fn(x, z, Math.atan2(p.x - x, p.z - z)); } });
      ringBuildings(C, { ...p, z: p.z + 30 } as Poi, 70, p.r * 0.88, 110, (x, z, ry, i) => { if (Math.hypot(x - keepX, z - keepZ) < 100) return; [twn, tim, shp, twn, twn][i % 5](x, z, ry); }, 9);
      for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU; lamp(C, p.x + Math.cos(a) * 45, p.z + 30 + Math.sin(a) * 45); }
      break;
    }
    case 'love': { // Aiai – city of love
      organic(C, p, pal, [cot, twn, tim, shp, cot], [(x, z, ry) => dome(C, x, z, ry, 0xffe0ec, 0xff5aa8, 10), (x, z, ry) => church(C, x, z, ry, 0.7), (x, z, ry) => clockTower(C, x, z, ry, 26)], 54, 0xf2c4d6);
      heartSculpture(C, p.x, p.z, 1.2);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.5, x = p.x + Math.cos(a) * 85, z = p.z + Math.sin(a) * 85; if (clear(C, x, z, 8)) gardenPlot(C, x, z, a); }
      break;
    }
    case 'casino': { // Dorias – neon gambling city
      const L = new Loc(C, p.x, p.z, 0);
      L.cyl(0, 0, 0, 90, 0.2, 90, 0x2a1a3a); L.cyl(0, 0.2, 0, 70, 0.14, 70, 0x3a244a); for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; L.disc(Math.cos(a) * 28, Math.sin(a) * 28, 1.2, 0xff4fd8, 0.4); L.sph(Math.cos(a) * 38, 0.2, Math.sin(a) * 38, 1.6, 1.6, 1.6, i % 2 ? 0xffe14a : 0xff4fd8, 2.6); }
      casino(C, p.x, p.z - 50, Math.PI, 0x4a1a6a); C.claim(p.x, p.z - 50, 45);
      const pal2: Pal = { wall: [0x3a2a58, 0x4a2a68, 0x2a2a58, 0x5a2a58], roof: [0x1a1030, 0x2a1048], trim: 0xff4fd8, shut: [0xff4fd8, 0x3af0ff] };
      const neon = (x: number, z: number, ry: number) => { townhouse(C, x, z, ry, pal2); const n = new Loc(C, x, z, ry); n.box(0, 10, 5.6, 5, 0.4, 0.3, [0xff4fd8, 0x3af0ff, 0xffe14a][Math.floor(C.R() * 3)], 2.4); };
      ringBuildings(C, p, 90, p.r * 0.92, 40, (x, z, ry, i) => { if (i % 5 === 0) casino(C, x, z, ry, [0x2a1a58, 0x581a3a][i % 2]); else neon(x, z, ry); }, 12);
      for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.8; wizardTower(C, p.x + Math.cos(a) * 72, p.z + Math.sin(a) * 72, a, 28, 0x3a2a68, 0xff4fd8); }
      break;
    }
    case 'forest': { // Bunzen – treehouse town in the old-growth forest
      const L = new Loc(C, p.x, p.z, 0); L.cyl(0, 0, 0, 60, 0.2, 60, 0x6a5a3a);
      const trunk = (x: number, z: number, s: number, h: number) => { const l = new Loc(C, x, z, 0); l.cyl(0, 0, 0, 7 * s, h, 7 * s, 0x5a3e24); for (let i = 0; i < 6; i++) { const a = i * 1.05; l.cone(Math.cos(a) * 3.5 * s, 0, Math.sin(a) * 3.5 * s, 2.6 * s, 6 * s, 2.6 * s, 0x4e3620); } for (let i = 0; i < 12; i++) { const a = C.R() * TAU, d = C.R() * 14 * s; l.sph(Math.cos(a) * d, h - 4 + C.R() * 12, Math.sin(a) * d, 16 * s, 10 * s, 16 * s, pick(C, [0x2f7a3a, 0x3a8a44, 0x286a34])); } C.circle(x, z, 3.6 * s, h); };
      const treehouse = (x: number, z: number, ry: number, hgt: number) => { const l = new Loc(C, x, z, ry); l.cyl(0, 0, 0, 2.2, hgt, 2.2, 0x5a3e24); for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { l.cyl(sx * 4.2, 0, sz * 4.2, 0.8, hgt, 0.8, 0x4a3220); C.circle(...l.w(sx * 4.2, sz * 4.2), 0.8, hgt); } l.box(0, hgt, 0, 12, 0.5, 12, 0x7a5632); l.box(0, hgt + 0.5, 0, 8, 4, 8, 0x8a6a44); l.gable(0, hgt + 4.5, 0, 10, 4, 10, 0x3a6a3a, true); l.box(0, hgt + 0.5, 4.05, 1.4, 2.3, 0.15, 0x2a1c10); l.box(0, hgt + 2, 4.1, 2, 1.3, 0.1, 0x35506c); for (let i = 0; i < 6; i++) l.box(0, i * (hgt / 6), 5 + i * 0.3, 2.2, 0.3, 1, 0x7a5632); C.circle(...l.w(0, 0), 2, hgt); };
      trunk(p.x, p.z, 2.4, 52); const big = new Loc(C, p.x, p.z, 0); big.box(0, 30, 0, 26, 0.6, 26, 0x7a5632); big.box(0, 30.6, 0, 18, 6, 18, 0x8a6a44); big.gable(0, 36.6, 0, 22, 8, 22, 0x3a6a3a, true); big.box(0, 30.6, 9.05, 2.4, 3.2, 0.2, 0x2a1c10);
      ringBuildings(C, p, 26, p.r * 0.9, 22, (x, z, ry, i) => { if (i % 3 === 0) trunk(x, z, 1 + C.R() * 0.6, 26 + C.R() * 14); else treehouse(x, z, ry, 7 + C.R() * 10); }, 11);
      // rope bridges between neighbouring platforms
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, x0 = p.x + Math.cos(a) * 40, z0 = p.z + Math.sin(a) * 40; const l = new Loc(C, x0, z0, a + Math.PI / 2); l.box(0, 12, 0, 1.6, 0.2, 26, 0x6a4a2a); l.box(-0.8, 12.2, 0, 0.1, 1, 26, 0x4a3220); l.box(0.8, 12.2, 0, 0.1, 1, 26, 0x4a3220); }
      for (let i = 0; i < 14; i++) lamp(C, p.x + Math.cos(i) * (30 + (i % 4) * 22), p.z + Math.sin(i) * (30 + (i % 4) * 22), 0xb6ff9a);
      break;
    }
    case 'port': { // Soufrabi – big harbor city on the sea-facing side
      organic(C, p, pal, [twn, tim, shp, twn, cot], [(x, z, ry) => clockTower(C, x, z, ry, 28), (x, z, ry) => inn(C, x, z, ry, pal), (x, z, ry) => church(C, x, z, ry, 0.8)], 60, 0xb4aa94);
      const sd = C.sea, ang = sd.ang, d0 = Math.max(120, sd.dist - 40);
      const S0 = new Loc(C, p.x + Math.sin(ang) * d0, p.z + Math.cos(ang) * d0, ang);
      for (let i = -2; i <= 2; i++) { const [px, pz] = S0.w(i * 55, 0); pier(C, px, pz, ang, 90, 7); }
      for (let i = -2; i <= 2; i++) { const [px, pz] = S0.w(i * 55 + 27, 125 + (i % 2) * 20); ship(C, px, pz, ang + Math.PI / 2 + (i % 2) * 0.1, 1 + (Math.abs(i) % 3) * 0.2, [0xf2ead8, 0xe8d8a8, 0xd8e0f0][Math.abs(i) % 3]); }
      for (let i = 0; i < 8; i++) { const [cx, cz] = S0.w(-110 + i * 30, -10); crate(C, cx, cz, 1 + (i % 2) * 0.4); const [bx, bz] = S0.w(-100 + i * 30, -18); barrel(C, bx, bz); }
      for (let i = -1; i <= 1; i++) { const [wx, wz] = S0.w(i * 70, -50); const w = new Loc(C, wx, wz, ang); w.box(0, 0, 0, 30, 9, 16, 0x8a6a4a); w.gable(0, 9, 0, 32, 6, 16, 0x4a5a6a, false); w.box(0, 0, 8.05, 8, 7, 0.3, 0x2a1c10); w.solid(30, 16, 14, 8); }
      for (let i = -1; i <= 1; i++) { const [cx, cz] = S0.w(i * 70 + 30, -12); const cr = new Loc(C, cx, cz, ang); cr.box(0, 0, 0, 1.4, 22, 1.4, 0x7a3a2a); cr.box(0, 22, 0, 1.4, 1.4, 16, 0x7a3a2a); cr.cyl(0, 6, 7, 0.15, 16, 0.15, 0x2a2a2a); }
      break;
    }
    case 'port2': { // Greed Island Port – harbormaster & ferry
      organic(C, p, pal, [cot, tim, shp, cot], [(x, z, ry) => inn(C, x, z, ry, pal), (x, z, ry) => clockTower(C, x, z, ry, 24)], 28, 0xb4aa94);
      const sd = C.sea, ang = sd.ang, d0 = Math.max(100, sd.dist - 40);
      const S0 = new Loc(C, p.x + Math.sin(ang) * d0, p.z + Math.cos(ang) * d0, ang);
      for (let i = -1; i <= 1; i++) { const [px, pz] = S0.w(i * 50, 0); pier(C, px, pz, ang, 80, 8); }
      { const [sx, sz] = S0.w(0, 130); ship(C, sx, sz, ang + Math.PI / 2, 1.9, 0xf4f0e6); const [qx, qz] = S0.w(95, 140); ship(C, qx, qz, ang + Math.PI / 2, 1, 0xe8d8a8); }
      for (let i = 0; i < 6; i++) { const [bx, bz] = S0.w(-80 + i * 22, 30 + (i % 2) * 8); boat(C, bx, bz, ang + Math.PI / 2); }
      const [hx, hz] = S0.w(-60, -50); const hm = new Loc(C, hx, hz, ang); hm.box(0, 0, 0, 20, 8, 14, 0xd8d0b8); hm.gable(0, 8, 0, 22, 5, 14, 0x2a4a7a, true); hm.box(0, 0, 7.05, 3, 4.6, 0.2, 0x2a1c10); hm.solid(20, 14, 12, 4); banner(C, ...hm.w(10, 8), 0x2a4a7a, 12);
      break;
    }
    case 'lighthouse': {
      lighthouse(C, p.x, p.z, 60);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; const x = p.x + Math.cos(a) * 36, z = p.z + Math.sin(a) * 36; tent(C, x, z, a + Math.PI, [0x2a4aa8, 0x1a3a88][i % 2]); }
      for (let i = 0; i < 10; i++) { const a = i * 0.9, d = 24 + (i % 3) * 14; barrel(C, p.x + Math.cos(a) * d, p.z + Math.sin(a) * d); }
      { const [qx, qz] = new Loc(C, p.x + Math.sin(C.sea.ang) * Math.max(90, C.sea.dist - 20), p.z + Math.cos(C.sea.ang) * Math.max(90, C.sea.dist - 20), C.sea.ang).w(0, 40); ship(C, qx, qz, C.sea.ang + 1.2, 1.5, 0x1a1a24); }
      break;
    }
    case 'camp': { // Badlands training camp
      const L = new Loc(C, p.x, p.z, 0); L.cyl(0, 0, 0, 80, 0.2, 80, 0xc8a070);
      for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + 0.3, x = p.x + Math.cos(a) * (40 + (i % 2) * 28), z = p.z + Math.sin(a) * (40 + (i % 2) * 28); tent(C, x, z, a + Math.PI, [0xd8c8a0, 0xc2603f, 0xb8a888, 0x8a5a3a][i % 4]); }
      L.cyl(0, 0.2, 0, 7, 0.9, 7, 0x6a5a4a); L.cone(0, 0.3, 0, 3, 2.4, 3, 0xff8a2a, 2.4); L.cone(0, 0.3, 0, 1.6, 3.4, 1.6, 0xffd24a, 2.8);
      C.circle(p.x, p.z, 3.8, 1);
      for (let i = 0; i < 8; i++) { const a = i * 0.8; bench(C, p.x + Math.cos(a) * 8, p.z + Math.sin(a) * 8, a + 1.57); }
      watchtower(C, p.x + 60, p.z - 50, 18); ruins(C, p.x, p.z, 14, p.r * 1.3); cyclopsSkull(C, p.x - 90, p.z + 70);
      hut(C, p.x - 20, p.z - 70, 0.4, 0xb0956c, 0x7a5a3a); hut(C, p.x + 70, p.z + 40, 2, 0xb0956c, 0x7a5a3a);
      const tgt = new Loc(C, p.x - 55, p.z + 55, 0.6); tgt.cyl(0, 0, 0, 0.5, 4, 0.5, 0x5a3c22); tgt.cyl(0, 2.6, 0.3, 3.2, 0.4, 3.2, 0xf4f0e0); tgt.add('cyl', 0, 2.6, 0.45, 2.0, 0.4, 2.0, 0xd23a3a); C.circle(p.x - 55, p.z + 55, 0.6, 5);
      break;
    }
    case 'village2': { // Mountain bandit village – ramshackle palisade
      palisade(C, p.x, p.z, p.r * 0.85, [0, Math.PI]);
      const L = new Loc(C, p.x, p.z, 0); L.cyl(0, 0, 0, 70, 0.2, 70, 0x7a6a50);
      ringBuildings(C, p, 24, p.r * 0.78, 20, (x, z, ry, i) => (i % 4 === 0 ? tim(x, z, ry) : hut(C, x, z, ry, [0x7a6248, 0x6a5238, 0x8a7258][i % 3], 0x4a3a2a)), 8);
      watchtower(C, p.x + p.r * 0.85, p.z, 18); watchtower(C, p.x - p.r * 0.85, p.z, 18); watchtower(C, p.x, p.z + p.r * 0.85, 16);
      L.cyl(0, 0.2, 0, 6, 0.8, 6, 0x5a4a3a); L.cone(0, 0.3, 0, 2.6, 2.2, 2.6, 0xff8a2a, 2.4); C.circle(p.x, p.z, 3.3, 1);
      for (let i = 0; i < 10; i++) { const a = C.R() * TAU, d = 20 + C.R() * 150, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; if (clear(C, x, z, 2)) (i % 2 ? crate : barrel)(C, x, z, 1); }
      break;
    }
    case 'mansion': { // Gold Dust Mansion & hedge garden
      mansionHall(C, p.x, p.z - 20, 0);
      hedgeMaze(C, p.x, p.z + 60, 0, 6); C.claim(p.x, p.z + 60, 30);
      fountain(C, p.x, p.z + 22, 4.5, 0xffe9a0);
      for (let i = 0; i < 8; i++) lamp(C, p.x - 28 + i * 8, p.z + 14, 0xfff0b0);
      for (const s of [-1, 1]) { const g = new Loc(C, p.x + s * 12, p.z + 118, 0); g.cyl(0, 0, 0, 2.2, 10, 2.2, 0xe8e0c8); g.sph(0, 10, 0, 2.2, 2.2, 2.2, 0xffd24a, 1.3); C.circle(...g.w(0, 0), 1.2, 10); }
      break;
    }
    case 'hideout': { // Genthru's Bomber hideout
      bunker(C, p.x, p.z, 0.4);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, x = p.x + Math.cos(a) * 60, z = p.z + Math.sin(a) * 60; const f = new Loc(C, x, z, a); f.box(0, 0, 0, 22, 4, 0.5, 0x5a5e64); for (let k = 0; k < 8; k++) f.box(-10 + k * 3, 4, 0, 0.1, 1.2, 0.5, 0x2a2a30); const L = 22; for (let k = 0; k <= 7; k++) C.circle(...f.w(-L / 2 + k * (L / 7), 0), 1.4, 4); }
      for (let i = 0; i < 12; i++) { const a = C.R() * TAU, d = 20 + C.R() * 35, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; if (clear(C, x, z, 2)) { const l = new Loc(C, x, z, a); l.cyl(0, 0, 0, 1.4, 1.8, 1.4, 0xb8402a); l.box(0, 0.8, 0, 1.45, 0.5, 1.45, 0xe8c23a); C.circle(x, z, 0.9, 1.8); } }
      watchtower(C, p.x + 50, p.z + 50, 20); watchtower(C, p.x - 50, p.z - 50, 20);
      break;
    }
    case 'court': { courtArena(C, p.x, p.z); break; }
    default: break;
  }
  void streets; void fountain;
}
