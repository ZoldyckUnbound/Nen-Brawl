import * as THREE from 'three';
import type { World, Obstacle } from '../world';
import { POIS, ROADS, DUNGEONS, LAKES, BADLANDS_C, HIGHLAND_C, MAP_R, poi, type Poi } from './data';

export interface Spot { x: number; z: number; tier: number }
export interface GreedWorld extends World {
  mapCanvas: HTMLCanvasElement;
  near: (x: number, z: number) => Obstacle[];
  setFocus: (x: number, z: number, range?: number) => void;
  setBarrier: (r: number, level: number, visible?: boolean) => void;
  blocked: (x: number, z: number, r: number) => boolean;
  chestSpots: Spot[];
  lootSpots: Spot[];
  herbSpots: Spot[];
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
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
const fbm = (x: number, y: number, s = 1) => vn(x, y, s) * 0.6 + vn(x * 2.1, y * 2.1, s + 1) * 0.3 + vn(x * 4.3, y * 4.3, s + 2) * 0.1;

// biomes: 0 grass, 1 forest, 2 badlands, 3 highland, 4 sand, 5 water
function biomeAt(x: number, z: number): number {
  const d = Math.hypot(x, z);
  if (d > MAP_R + 10) return 5;
  if (d > MAP_R - 36 + (fbm(x / 60, z / 60, 9) - 0.5) * 22) return 4;
  if (Math.hypot(x - BADLANDS_C.x, z - BADLANDS_C.z) < BADLANDS_C.r + (fbm(x / 90, z / 90, 4) - 0.5) * 150) return 2;
  if (Math.hypot(x - HIGHLAND_C.x, z - HIGHLAND_C.z) < HIGHLAND_C.r + (fbm(x / 90, z / 90, 6) - 0.5) * 150) return 3;
  if (fbm(x / 160 + 10, z / 160, 3) > 0.6 || Math.hypot(x + 110, z - 700) < 240) return 1;
  return 0;
}
const inTown = (x: number, z: number, extra = 0) => POIS.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + extra);

const TILE = 250;
const GEO: Record<string, THREE.BufferGeometry> = {
  box: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10).translate(0, 0.5, 0),
  cone: new THREE.ConeGeometry(0.5, 1, 8).translate(0, 0.5, 0),
  roof: new THREE.ConeGeometry(0.7071, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0),
  sph: new THREE.SphereGeometry(0.5, 10, 8),
  rock: new THREE.DodecahedronGeometry(0.5, 0).translate(0, 0.3, 0),
};
const MAT_L = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
const MAT_E = new THREE.MeshBasicMaterial({ color: 0xffffff });
interface Item { x: number; y: number; z: number; sx: number; sy: number; sz: number; ry: number; c: THREE.Color }

export function buildGreedIsland(): GreedWorld {
  const R = rng(20250);
  const group = new THREE.Group();
  const obstacles: Obstacle[] = [];
  const grid = new Map<number, Obstacle[]>();
  const CELL = 48;
  const addOb = (x: number, z: number, r: number, h = 6) => {
    const o: Obstacle = { x, z, r, h };
    obstacles.push(o);
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL), z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      const k = i * 4096 + j;
      let a = grid.get(k);
      if (!a) grid.set(k, (a = []));
      a.push(o);
    }
  };
  const tmpList: Obstacle[] = [];
  const near = (x: number, z: number) => {
    tmpList.length = 0;
    const i = Math.floor(x / CELL), j = Math.floor(z / CELL);
    for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) { const l = grid.get(a * 4096 + b); if (l) for (const o of l) tmpList.push(o); }
    return tmpList;
  };
  const blocked = (x: number, z: number, r: number) => {
    for (const o of near(x, z)) if (Math.hypot(x - o.x, z - o.z) < o.r + r) return true;
    return false;
  };

  // ------------------------------------------------ instanced kit
  const chunks = new Map<string, { cx: number; cz: number; items: Record<string, Item[]> }>();
  const add = (layer: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry: number, color: number, glow = 0) => {
    const kx = Math.floor(x / TILE), kz = Math.floor(z / TILE);
    const key = kx + ',' + kz;
    let ch = chunks.get(key);
    if (!ch) chunks.set(key, (ch = { cx: (kx + 0.5) * TILE, cz: (kz + 0.5) * TILE, items: {} }));
    const L = glow ? layer + 'E' : layer;
    (ch.items[L] ??= []).push({ x, y, z, sx, sy, sz, ry, c: new THREE.Color(color).multiplyScalar(glow || 1) });
  };

  // ------------------------------------------------ helpers
  const placed: { x: number; z: number; r: number }[] = [];
  const free = (x: number, z: number, r: number) => !placed.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + r + 2) && !LAKES.some((l) => Math.hypot(x - l.x, z - l.z) < l.r + r + 2);
  const house = (x: number, z: number, w: number, d: number, h: number, ry: number, wall: number, roof: number, ob = true) => {
    add('box', x, 0, z, w, h, d, ry, wall);
    add('roof', x, h, z, w * 1.15, h * 0.6, d * 1.15, ry, roof);
    add('box', x + Math.sin(ry) * d * 0.5 * 0.98, 0, z + Math.cos(ry) * d * 0.5 * 0.98, 1.4, 2.2, 0.3, ry, 0x3a2a1c); // door
    if (ob) addOb(x, z, Math.hypot(w, d) * 0.5 * 0.95, h + 3);
    placed.push({ x, z, r: Math.hypot(w, d) * 0.5 });
  };
  const tower = (x: number, z: number, r: number, h: number, c: number, rc: number, glow = 0) => {
    add('cyl', x, 0, z, r * 2, h, r * 2, 0, c);
    add('cone', x, h, z, r * 2.5, r * 2.4, r * 2.5, 0, rc, glow);
    addOb(x, z, r * 1.05, h + 4);
    placed.push({ x, z, r });
  };
  const wallSeg = (x1: number, z1: number, x2: number, z2: number, h: number, th: number, c: number, gap = 0) => {
    const L = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.max(1, Math.round(L / 6));
    const ry = Math.atan2(x2 - x1, z2 - z1);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      if (gap && Math.abs(t - 0.5) * L < gap) continue;
      const x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t;
      add('box', x, 0, z, th, h, L / n + 0.4, ry, c);
      addOb(x, z, Math.max(th, L / n) * 0.55, h);
    }
  };
  const tree = (x: number, z: number, s: number, kind: number) => {
    add('cyl', x, 0, z, 0.9 * s, 3.4 * s, 0.9 * s, 0, 0x6b4a2a);
    if (kind === 3) { // pine
      add('cone', x, 2 * s, z, 4.2 * s, 5.4 * s, 4.2 * s, 0, 0x2f5f45);
      add('cone', x, 5 * s, z, 3.2 * s, 4.6 * s, 3.2 * s, 0, 0x3a7050);
      add('cone', x, 8 * s, z, 2.2 * s, 3.4 * s, 2.2 * s, 0, 0xe8f0f4);
    } else if (kind === 4) { // palm
      add('sph', x, 3.4 * s, z, 4.8 * s, 1.1 * s, 4.8 * s, 0, 0x4fae52);
    } else if (kind === 2) { // cactus
      add('cyl', x, 0, z, 1.1 * s, 4.4 * s, 1.1 * s, 0, 0x4f8f4a);
      add('cyl', x + 0.9 * s, 2 * s, z, 0.6 * s, 1.8 * s, 0.6 * s, 0, 0x4f8f4a);
    } else {
      const g = kind === 1 ? 0x2f7a3a : 0x4e9a46;
      add('cone', x, 2 * s, z, 4.6 * s, 5 * s, 4.6 * s, 0, g);
      add('cone', x, 4.6 * s, z, 3.4 * s, 4.4 * s, 3.4 * s, 0, g + 0x0a1408);
    }
    addOb(x, z, 0.8 * s, 6 * s);
    placed.push({ x, z, r: 0.8 * s });
  };
  const rock = (x: number, z: number, s: number, c = 0x8a8a92) => { add('rock', x, 0, z, 3 * s, 2.4 * s, 2.6 * s, R() * 6, c); addOb(x, z, 1.2 * s, 2.4 * s); placed.push({ x, z, r: 1.2 * s }); };
  const lamp = (x: number, z: number, c = 0xffe29a) => { add('cyl', x, 0, z, 0.3, 4, 0.3, 0, 0x3a3a44); add('sph', x, 4, z, 0.9, 0.9, 0.9, 0, c, 2.4); };
  const stall = (x: number, z: number, ry: number, c: number) => { add('box', x, 0, z, 3.6, 1.1, 2.2, ry, 0x7a5a3a); add('roof', x, 2.2, z, 4.2, 1.1, 3, ry, c); add('cyl', x - 1.6, 0, z - 1, 0.2, 2.4, 0.2, 0, 0x5a4020); add('cyl', x + 1.6, 0, z + 1, 0.2, 2.4, 0.2, 0, 0x5a4020); addOb(x, z, 2, 3); placed.push({ x, z, r: 2 }); };
  const ring = (p: Poi, n: number, r0: number, r1: number, fn: (x: number, z: number, i: number) => void) => {
    let c = 0, g = 0;
    while (c < n && g++ < n * 40) {
      const a = R() * 6.2832, d = r0 + R() * (r1 - r0);
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      if (Math.hypot(x, z) > MAP_R - 30 || !free(x, z, 5)) continue;
      fn(x, z, c++);
    }
  };
  const PAL = [0xe8d8b8, 0xd9c7a0, 0xf0e6d0, 0xc9b890, 0xe0cfae];
  const ROOFS = [0xb5473a, 0x9a3a2a, 0xc2603f, 0x8a4a3a];
  const pick = <T,>(a: T[]) => a[Math.floor(R() * a.length)];
  const flat: { x: number; z: number; r: number; c: number; y: number }[] = [];
  const disc = (x: number, z: number, r: number, c: number, y = 0.08) => flat.push({ x, z, r, c, y });

  // ------------------------------------------------ towns
  const hearts: THREE.Mesh[] = [];
  const beams: THREE.Object3D[] = [];
  const mkTown = (p: Poi) => {
    placed.push({ x: p.x, z: p.z, r: 8 });
    switch (p.style) {
      case 'castle': {
        disc(0, 0, 30, 0xd8cdb6, 0.1);
        disc(0, 0, 20, 0xc9b068, 0.14);
        for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.2832; const x = Math.cos(a) * 28, z = Math.sin(a) * 28; add('cyl', x, 0, z, 2.2, 16, 2.2, 0, 0xe9e2d0); add('box', x, 16, z, 3, 1.2, 3, a, 0xc9b068); addOb(x, z, 1.4, 16); if (i % 2 === 0) add('sph', x, 17.4, z, 1.6, 1.6, 1.6, 0, 0xffd24a, 2.2); }
        placed.push({ x: 0, z: 0, r: 34 });
        const cz = -84;
        add('box', 0, 0, cz, 34, 30, 30, 0, 0xe2d8c0); add('roof', 0, 30, cz, 38, 16, 34, 0, 0x3a5aa8); addOb(0, cz, 22, 36); placed.push({ x: 0, z: cz, r: 26 });
        for (const [dx, dz] of [[-24, -18], [24, -18], [-24, 18], [24, 18]]) tower(dx, cz + dz, 6, 44, 0xd6ccb4, 0x3a5aa8);
        wallSeg(-34, cz + 22, -34, cz - 30, 14, 3, 0xd0c6ae); wallSeg(34, cz + 22, 34, cz - 30, 14, 3, 0xd0c6ae);
        wallSeg(-34, cz - 30, 34, cz - 30, 14, 3, 0xd0c6ae); wallSeg(-34, cz + 22, 34, cz + 22, 14, 3, 0xd0c6ae, 9);
        for (const [fx, fz] of [[-12, cz + 12], [12, cz + 12]]) { add('cyl', fx, 0, fz, 0.4, 18, 0.4, 0, 0x555555); add('box', fx + 2, 14, fz, 4, 2.6, 0.2, 0, 0xffd24a, 1.8); }
        ring(p, 26, 46, 96, (x, z) => house(x, z, 8 + R() * 5, 8 + R() * 5, 6 + R() * 3, R() * 6, pick(PAL), 0x3a5aa8));
        break;
      }
      case 'market': {
        disc(p.x, p.z, 24, 0xcdbf9f);
        add('box', p.x, 0, p.z, 10, 1.2, 8, 0, 0x8a6a3a); addOb(p.x, p.z, 5.5, 2);
        for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.2832; stall(p.x + Math.cos(a) * 15, p.z + Math.sin(a) * 15, a, pick([0xe0603a, 0x3a8ae0, 0xe0c03a, 0x6ac04a])); }
        for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.2832 + 0.2; add('box', p.x + Math.cos(a) * 22, 0, p.z + Math.sin(a) * 22, 4, 5, 0.4, -a + 1.57, 0xf4e4a0, 1.1); }
        ring(p, 15, 28, 58, (x, z) => house(x, z, 8 + R() * 4, 7 + R() * 4, 5 + R() * 3, R() * 6, pick(PAL), pick(ROOFS)));
        break;
      }
      case 'village': case 'village2': {
        const rc = p.style === 'village2' ? [0x6a5a48, 0x5a4a38] : ROOFS;
        const wl = p.style === 'village2' ? [0x8a7a68, 0x7a6a58] : [0xf0ead8, 0xe8dcc0];
        add('cyl', p.x, 0, p.z, 3.4, 1.4, 3.4, 0, 0x8a8a92); addOb(p.x, p.z, 2, 2);
        ring(p, p.style === 'village2' ? 12 : 14, 12, p.r + 6, (x, z) => house(x, z, 6 + R() * 3, 6 + R() * 3, 4 + R() * 2, R() * 6, pick(wl), pick(rc)));
        if (p.style === 'village2') for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.5; add('sph', p.x + Math.cos(a) * 9, 0.3, p.z + Math.sin(a) * 9, 1.2, 1.2, 1.2, 0, 0xff8a2a, 2.2); }
        break;
      }
      case 'tree': {
        add('cyl', p.x, 0, p.z, 11, 36, 11, 0, 0x6b4a2a); addOb(p.x, p.z, 6.2, 36);
        for (let i = 0; i < 9; i++) { const a = i * 0.7; add('sph', p.x + Math.cos(a) * 13, 36 + Math.sin(i * 2.1) * 4, p.z + Math.sin(a) * 13, 26, 18, 26, 0, i % 2 ? 0x3a8a46 : 0x4aa650); }
        add('sph', p.x, 46, p.z, 30, 20, 30, 0, 0x56b85a);
        for (let i = 0; i < 14; i++) { const a = i * 0.45 + R(); add('sph', p.x + Math.cos(a) * (9 + R() * 12), 14 + R() * 24, p.z + Math.sin(a) * (9 + R() * 12), 0.9, 0.9, 0.9, 0, 0xffe58a, 2.6); }
        disc(p.x, p.z, 20, 0xb8b090, 0.1);
        for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.2832; add('box', p.x + Math.cos(a) * 17, 0, p.z + Math.sin(a) * 17, 3, 1, 1.2, -a + 1.57, 0x9a9a9a); }
        break;
      }
      case 'magic': {
        disc(p.x, p.z, 26, 0x6a5a98);
        for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.2832; const d = 24 + (i % 3) * 8; tower(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, 3.4, 20 + (i % 3) * 8, 0x8a6ad0, 0x4aa8e8, 1.6); }
        add('box', p.x, 0, p.z, 16, 9, 11, 0, 0x5a3a98); add('roof', p.x, 9, p.z, 18.5, 7, 13, 0, 0xd04ad0); add('cone', p.x, 17, p.z, 2, 5, 2, 0, 0xffe066, 2.4); addOb(p.x, p.z, 10, 14); placed.push({ x: p.x, z: p.z, r: 11 });
        for (let i = 0; i < 24; i++) { const a = R() * 6.2832, d = 14 + R() * 44; add('cone', p.x + Math.cos(a) * d, 0, p.z + Math.sin(a) * d, 1.4, 3 + R() * 3, 1.4, 0, pick([0xb06bff, 0x6ad0ff, 0xff6ad8]), 2.2); }
        for (let i = 0; i < 16; i++) { const a = R() * 6.2832, d = 8 + R() * 50; add('sph', p.x + Math.cos(a) * d, 8 + R() * 26, p.z + Math.sin(a) * d, 1.2, 1.2, 1.2, 0, pick([0xb06bff, 0x6ad0ff]), 2.6); }
        ring(p, 10, 34, 62, (x, z) => house(x, z, 7 + R() * 3, 7 + R() * 3, 5 + R() * 3, R() * 6, 0x7a5ab0, 0xc04ad0));
        break;
      }
      case 'love': {
        disc(p.x, p.z, 24, 0xf2b8cc);
        ring(p, 15, 26, 56, (x, z) => house(x, z, 7 + R() * 3, 7 + R() * 3, 5 + R() * 2, R() * 6, pick([0xffd0e0, 0xffc0d8, 0xfff0f4]), pick([0xff5a9a, 0xff7ab8])));
        for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.2832; lamp(p.x + Math.cos(a) * 21, p.z + Math.sin(a) * 21, 0xff8ac8); }
        const sh = new THREE.Shape();
        sh.moveTo(0.25, 0.25); sh.bezierCurveTo(0.25, 0.25, 0.2, 0, 0, 0); sh.bezierCurveTo(-0.3, 0, -0.3, 0.35, -0.3, 0.35); sh.bezierCurveTo(-0.3, 0.55, -0.1, 0.77, 0.25, 0.95);
        sh.bezierCurveTo(0.6, 0.77, 0.8, 0.55, 0.8, 0.35); sh.bezierCurveTo(0.8, 0.35, 0.8, 0, 0.5, 0); sh.bezierCurveTo(0.35, 0, 0.25, 0.25, 0.25, 0.25);
        const g = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05 });
        g.center(); g.scale(34, 34, 34);
        const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5aa8).multiplyScalar(1.7) }));
        m.position.set(p.x, 52, p.z); m.rotation.z = Math.PI;
        group.add(m); hearts.push(m);
        add('cyl', p.x, 0, p.z, 5, 1.6, 5, 0, 0xffe0ec); addOb(p.x, p.z, 3, 2);
        break;
      }
      case 'court': {
        add('box', p.x, 0, p.z, 44, 0.3, 28, 0, 0xc84a3a);
        add('box', p.x, 0.32, p.z, 42, 0.05, 0.6, 0, 0xffffff);
        wallSeg(p.x - 24, p.z - 16, p.x + 24, p.z - 16, 4, 1, 0x8a8a92); wallSeg(p.x - 24, p.z + 16, p.x + 24, p.z + 16, 4, 1, 0x8a8a92);
        wallSeg(p.x - 24, p.z - 16, p.x - 24, p.z + 16, 4, 1, 0x8a8a92, 6); wallSeg(p.x + 24, p.z - 16, p.x + 24, p.z + 16, 4, 1, 0x8a8a92, 6);
        for (let i = 0; i < 4; i++) lamp(p.x + (i < 2 ? -20 : 20), p.z + (i % 2 ? -13 : 13), 0xffffff);
        break;
      }
      case 'casino': {
        disc(p.x, p.z, 28, 0x3a2a50);
        add('box', p.x, 0, p.z, 24, 14, 17, 0, 0x2a1a3e); add('box', p.x, 14, p.z, 26, 1.2, 19, 0, 0xff4fd8, 1.6); addOb(p.x, p.z, 13, 16); placed.push({ x: p.x, z: p.z, r: 14 });
        add('box', p.x, 15.4, p.z + 9.6, 18, 5, 0.6, 0, 0xffe066, 2.4); add('box', p.x - 6, 15.8, p.z + 9.9, 3, 3.6, 0.3, 0, 0xff2a2a, 2.8); add('box', p.x, 15.8, p.z + 9.9, 3, 3.6, 0.3, 0, 0xff2a2a, 2.8); add('box', p.x + 6, 15.8, p.z + 9.9, 3, 3.6, 0.3, 0, 0xff2a2a, 2.8);
        for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.2832; tower(p.x + Math.cos(a) * 24, p.z + Math.sin(a) * 24, 2.4, 14, 0x3a2a50, 0x00e0ff, 2.2); }
        for (let i = 0; i < 22; i++) { const a = R() * 6.2832, d = 12 + R() * 40; add('sph', p.x + Math.cos(a) * d, 1.2 + R() * 3, p.z + Math.sin(a) * d, 0.8, 0.8, 0.8, 0, pick([0xff4fd8, 0x00e0ff, 0xffe066]), 2.6); }
        ring(p, 9, 34, 60, (x, z) => house(x, z, 8 + R() * 3, 8 + R() * 3, 6 + R() * 3, R() * 6, 0x4a3a60, pick([0xff4fd8, 0x00c0e0])));
        break;
      }
      case 'forest': {
        ring(p, 11, 10, p.r + 6, (x, z) => house(x, z, 6 + R() * 3, 6 + R() * 3, 4 + R() * 2, R() * 6, 0x8a6a42, 0x3a5a2a));
        for (let i = 0; i < 40; i++) { const a = R() * 6.2832, d = p.r + 6 + R() * 50; const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; if (free(x, z, 3) && Math.hypot(x, z) < MAP_R - 30) tree(x, z, 1.3 + R() * 0.8, 1); }
        break;
      }
      case 'port': case 'port2': {
        ring(p, 12, 12, p.r + 8, (x, z) => house(x, z, 7 + R() * 3, 6 + R() * 3, 5 + R() * 2, R() * 6, pick([0xe8f0f8, 0xd8e4f0]), pick([0x3a6ab0, 0x2a5a98])));
        const ca = Math.atan2(p.z, p.x);
        for (let i = 0; i < 3; i++) { const a = ca + (i - 1) * 0.12; const x = Math.cos(a) * (MAP_R - 24), z = Math.sin(a) * (MAP_R - 24); add('box', x, 0, z, 14, 0.8, 5, -a + 1.57, 0x7a5a3a); const sx = Math.cos(a) * (MAP_R + 4), sz = Math.sin(a) * (MAP_R + 4); add('box', sx, -0.4, sz, 18, 4, 7, -a + 1.57, 0x5a3a28); add('cyl', sx, 4, sz, 0.5, 18, 0.5, 0, 0x4a3a28); add('box', sx, 7, sz, 8, 9, 0.3, -a + 1.57, 0xf4ecd8); }
        if (p.style === 'port2') { tower(p.x + 14, p.z - 6, 3.4, 30, 0xe0e8f0, 0x2a8ae0); add('sph', p.x + 14, 33, p.z - 6, 2, 2, 2, 0, 0x7ad0ff, 2.6); }
        break;
      }
      case 'lighthouse': {
        add('cyl', p.x, 0, p.z, 11, 14, 11, 0, 0xf4f0e8); add('cyl', p.x, 14, p.z, 9, 14, 9, 0, 0xc8302a); add('cyl', p.x, 28, p.z, 7, 12, 7, 0, 0xf4f0e8); add('cyl', p.x, 40, p.z, 8, 2, 8, 0, 0x3a3a44);
        add('sph', p.x, 43, p.z, 5, 5, 5, 0, 0xffee99, 3); addOb(p.x, p.z, 6, 44); add('cone', p.x, 46, p.z, 8, 5, 8, 0, 0xc8302a);
        wallSeg(p.x - 24, p.z - 24, p.x + 24, p.z - 24, 8, 2, 0x6a6a74); wallSeg(p.x - 24, p.z + 24, p.x + 24, p.z + 24, 8, 2, 0x6a6a74, 6);
        wallSeg(p.x - 24, p.z - 24, p.x - 24, p.z + 24, 8, 2, 0x6a6a74); wallSeg(p.x + 24, p.z - 24, p.x + 24, p.z + 24, 8, 2, 0x6a6a74, 6);
        for (let i = 0; i < 6; i++) add('box', p.x + (R() - 0.5) * 36, 0, p.z + (R() - 0.5) * 36, 3, 2.4, 3, R() * 3, 0x7a5a3a);
        const bg = new THREE.Mesh(new THREE.ConeGeometry(7, 70, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffee99).multiplyScalar(1.5), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        bg.geometry.translate(0, -35, 0); bg.geometry.rotateX(Math.PI / 2);
        const pivot = new THREE.Group(); pivot.position.set(p.x, 43, p.z); pivot.add(bg); group.add(pivot); beams.push(pivot);
        break;
      }
      case 'camp': {
        disc(p.x, p.z, 18, 0xb88a5a);
        for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.2832; const x = p.x + Math.cos(a) * 18, z = p.z + Math.sin(a) * 18; add('cone', x, 0, z, 6, 5, 6, 0, pick([0xe8d8b8, 0xc89a62, 0xb8704a])); addOb(x, z, 2.6, 5); placed.push({ x, z, r: 3 }); }
        add('sph', p.x, 0.5, p.z, 1.6, 1.6, 1.6, 0, 0xff7a1a, 2.8); add('cyl', p.x + 6, 0, p.z, 1, 4, 1, 0, 0x7a5a3a);
        for (let i = 0; i < 28; i++) { const a = R() * 6.2832, d = 70 + R() * 190; const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; if (Math.hypot(x, z) > MAP_R - 50 || !free(x, z, 22)) continue; const rr = 8 + R() * 12, hh = 12 + R() * 22; add('cyl', x, 0, z, rr * 2, hh, rr * 2, 0, pick([0xc8784a, 0xb8683a, 0xd88a58])); add('cyl', x, hh, z, rr * 2.05, 1.2, rr * 2.05, 0, 0xe8a070); addOb(x, z, rr, hh); placed.push({ x, z, r: rr }); }
        break;
      }
      case 'mansion': {
        add('box', p.x, 0, p.z, 26, 15, 16, 0, 0xf4ecd4); add('roof', p.x, 15, p.z, 29, 9, 19, 0, 0xd8a838); add('sph', p.x, 24, p.z, 2.4, 2.4, 2.4, 0, 0xffd24a, 2.4); addOb(p.x, p.z, 13, 18); placed.push({ x: p.x, z: p.z, r: 14 });
        wallSeg(p.x - 26, p.z - 22, p.x + 26, p.z - 22, 6, 1.4, 0xd8c8a0); wallSeg(p.x - 26, p.z + 22, p.x + 26, p.z + 22, 6, 1.4, 0xd8c8a0, 6);
        wallSeg(p.x - 26, p.z - 22, p.x - 26, p.z + 22, 6, 1.4, 0xd8c8a0); wallSeg(p.x + 26, p.z - 22, p.x + 26, p.z + 22, 6, 1.4, 0xd8c8a0);
        for (let i = 0; i < 8; i++) { const a = i * 0.78; add('sph', p.x + Math.cos(a) * 17, 1.4, p.z + Math.sin(a) * 17, 1.6, 2.4, 1.6, 0, 0xffd24a, 2.2); }
        break;
      }
      case 'hideout': {
        disc(p.x, p.z, 26, 0x4a4040);
        for (let i = 0; i < 22; i++) { const a = R() * 6.2832, d = 6 + R() * 26; const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; if (!free(x, z, 2)) continue; if (i % 3 === 0) { add('cyl', x, 0, z, 3.4, 4.5, 3.4, 0, 0x7a3a2a); addOb(x, z, 1.8, 4.5); } else { add('box', x, 0, z, 2.6, 2.4, 2.6, R() * 3, 0x8a6a42); addOb(x, z, 1.8, 2.4); } placed.push({ x, z, r: 2 }); }
        for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.2832; add('sph', p.x + Math.cos(a) * 28, 6, p.z + Math.sin(a) * 28, 1.2, 1.2, 1.2, 0, 0xff2a1a, 3); add('cyl', p.x + Math.cos(a) * 28, 0, p.z + Math.sin(a) * 28, 0.5, 6, 0.5, 0, 0x2a2a30); }
        break;
      }
    }
  };
  for (const p of POIS) mkTown(p);

  // dungeon entrances
  for (const d of DUNGEONS) {
    const c = parseInt(d.color.slice(1), 16);
    for (const s of [-1, 1]) { add('box', d.x + s * 4, 0, d.z, 2.4, 10, 2.4, 0, 0x7a7a84); addOb(d.x + s * 4, d.z, 1.6, 10); }
    add('box', d.x, 10, d.z, 11, 2, 2.6, 0, 0x8a8a94);
    add('box', d.x, 0.2, d.z, 6, 9.6, 0.4, 0, c, 2.2);
    for (let i = 0; i < 8; i++) rock(d.x + (R() - 0.5) * 24, d.z + (R() - 0.5) * 24 - 6, 1 + R(), 0x6a6a72);
    placed.push({ x: d.x, z: d.z, r: 14 });
    disc(d.x, d.z + 6, 8, 0x4a4a54, 0.1);
  }
  // lakes
  const lakeMeshes: THREE.Mesh[] = [];
  for (const l of LAKES) {
    addOb(l.x, l.z, l.r, 0);
    const m = new THREE.Mesh(new THREE.CircleGeometry(l.r, 32), new THREE.MeshBasicMaterial({ color: 0x3aa0e0, transparent: true, opacity: 0.88 }));
    m.rotation.x = -Math.PI / 2; m.position.set(l.x, 0.12, l.z); group.add(m); lakeMeshes.push(m);
    const rim = new THREE.Mesh(new THREE.RingGeometry(l.r, l.r + 3.2, 32), new THREE.MeshBasicMaterial({ color: 0xe6d9a8 }));
    rim.rotation.x = -Math.PI / 2; rim.position.set(l.x, 0.1, l.z); group.add(rim);
    for (let i = 0; i < 10; i++) { const a = R() * 6.2832; add('cyl', l.x + Math.cos(a) * (l.r + 2), 0, l.z + Math.sin(a) * (l.r + 2), 0.3, 2.6, 0.3, 0, 0x6a9a4a); }
  }
  // mountains
  for (let i = 0; i < 26; i++) {
    const a = R() * 6.2832, d = R() * HIGHLAND_C.r * 0.95;
    const x = HIGHLAND_C.x + Math.cos(a) * d, z = HIGHLAND_C.z + Math.sin(a) * d;
    if (Math.hypot(x, z) > MAP_R - 70 || inTown(x, z, 30)) continue;
    const r = 22 + R() * 26, h = 55 + R() * 70;
    add('cone', x, 0, z, r * 2, h, r * 2, R() * 3, pick([0x7a7e88, 0x6a6e78, 0x8a8e96])); add('cone', x, h * 0.68, z, r * 0.86, h * 0.32, r * 0.86, 0, 0xf2f6fa);
    addOb(x, z, r * 0.7, h); placed.push({ x, z, r: r * 0.8 });
  }
  // scatter: trees, cacti, rocks
  for (let i = 0; i < 11000; i++) {
    const a = R() * 6.2832, d = Math.sqrt(R()) * (MAP_R - 20);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const b = biomeAt(x, z);
    const pr = R();
    if (b === 5 || inTown(x, z, 10) || !free(x, z, 1)) continue;
    if (b === 1 && pr < 0.6) tree(x, z, 0.9 + R() * 0.9, 1);
    else if (b === 0 && pr < 0.1) tree(x, z, 0.9 + R() * 0.7, 0);
    else if (b === 3 && pr < 0.18) tree(x, z, 1 + R() * 0.8, 3);
    else if (b === 4 && pr < 0.05) tree(x, z, 1 + R() * 0.4, 4);
    else if (b === 2 && pr < 0.06) tree(x, z, 0.9 + R() * 0.6, 2);
    else if (pr > 0.992) rock(x, z, 1 + R() * 1.6);
  }

  // ------------------------------------------------ chunks -> instanced meshes
  const chunkGroups: { g: THREE.Group; cx: number; cz: number }[] = [];
  for (const ch of chunks.values()) {
    const g = new THREE.Group();
    for (const [L, items] of Object.entries(ch.items)) {
      const glow = L.endsWith('E');
      const shape = glow ? L.slice(0, -1) : L;
      const mesh = new THREE.InstancedMesh(GEO[shape], glow ? MAT_E : MAT_L, items.length);
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      items.forEach((it, i) => {
        q.setFromAxisAngle(up, it.ry);
        m4.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.sx, it.sy, it.sz));
        mesh.setMatrixAt(i, m4);
        mesh.setColorAt(i, it.c);
      });
      mesh.castShadow = !glow;
      mesh.receiveShadow = !glow;
      mesh.computeBoundingSphere();
      g.add(mesh);
    }
    group.add(g);
    chunkGroups.push({ g, cx: ch.cx, cz: ch.cz });
  }

  // flat decals (plazas, floors)
  for (const f of flat) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(f.r, 36), new THREE.MeshLambertMaterial({ color: f.c }));
    m.rotation.x = -Math.PI / 2; m.position.set(f.x, f.y, f.z); m.receiveShadow = true; group.add(m);
  }

  // ------------------------------------------------ ground texture + map
  const S = 1536;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c2 = cv.getContext('2d')!;
  const img = c2.createImageData(S, S);
  const W = 2000;
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const x = (px / S) * W - W / 2, z = (py / S) * W - W / 2;
      const b = biomeAt(x, z);
      const n = fbm(x / 28, z / 28, 17);
      let r = 0, g = 0, bl = 0;
      if (b === 0) { r = 92 + n * 36; g = 146 + n * 34; bl = 66 + n * 22; }
      else if (b === 1) { r = 54 + n * 24; g = 108 + n * 30; bl = 54 + n * 18; }
      else if (b === 2) { const band = Math.sin(z / 5 + n * 6) * 0.5 + 0.5; r = 190 + band * 26 + n * 16; g = 120 + band * 22 + n * 16; bl = 74 + band * 14; }
      else if (b === 3) { const sn = fbm(x / 70, z / 70, 21); if (sn > 0.6) { r = 236; g = 240; bl = 244; } else { r = 112 + n * 40; g = 118 + n * 38; bl = 124 + n * 36; } }
      else if (b === 4) { r = 226 + n * 14; g = 206 + n * 14; bl = 150 + n * 14; }
      else { r = 36; g = 118; bl = 186 + n * 26; }
      const i = (py * S + px) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = bl; img.data[i + 3] = 255;
    }
  }
  c2.putImageData(img, 0, 0);
  const tx = (x: number) => ((x + W / 2) / W) * S;
  const sc = S / W;
  c2.lineCap = 'round';
  c2.strokeStyle = '#bfa77c'; c2.lineWidth = 7 * sc;
  for (const [a, b] of ROADS) { const A = poi(a), B = poi(b); c2.beginPath(); c2.moveTo(tx(A.x), tx(A.z)); c2.quadraticCurveTo(tx((A.x + B.x) / 2 + (A.z - B.z) * 0.06), tx((A.z + B.z) / 2 + (B.x - A.x) * 0.06), tx(B.x), tx(B.z)); c2.stroke(); }
  c2.strokeStyle = '#d6c298'; c2.lineWidth = 3.2 * sc;
  for (const [a, b] of ROADS) { const A = poi(a), B = poi(b); c2.beginPath(); c2.moveTo(tx(A.x), tx(A.z)); c2.quadraticCurveTo(tx((A.x + B.x) / 2 + (A.z - B.z) * 0.06), tx((A.z + B.z) / 2 + (B.x - A.x) * 0.06), tx(B.x), tx(B.z)); c2.stroke(); }
  for (const p of POIS) { c2.fillStyle = p.style === 'casino' ? '#4a3a60' : p.style === 'magic' ? '#7a68a8' : p.style === 'love' ? '#f0c4d6' : '#c8bb9c'; c2.beginPath(); c2.arc(tx(p.x), tx(p.z), p.r * 0.55 * sc, 0, 6.2832); c2.fill(); }
  for (const l of LAKES) { c2.fillStyle = '#3aa0e0'; c2.beginPath(); c2.arc(tx(l.x), tx(l.z), l.r * sc, 0, 6.2832); c2.fill(); }
  const gtex = new THREE.CanvasTexture(cv);
  gtex.colorSpace = THREE.SRGBColorSpace;
  gtex.anisotropy = 8;
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1000, 96), new THREE.MeshLambertMaterial({ map: gtex }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  // tiled detail speckle layer
  const dc = document.createElement('canvas');
  dc.width = dc.height = 128;
  const dctx = dc.getContext('2d')!;
  for (let i = 0; i < 900; i++) { dctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,30,0,0.16)' : 'rgba(255,255,200,0.14)'; dctx.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2, 1 + Math.random() * 3); }
  const dtex = new THREE.CanvasTexture(dc);
  dtex.wrapS = dtex.wrapT = THREE.RepeatWrapping;
  dtex.repeat.set(330, 330);
  const detail = new THREE.Mesh(new THREE.CircleGeometry(MAP_R, 64), new THREE.MeshBasicMaterial({ map: dtex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  detail.rotation.x = -Math.PI / 2; detail.position.y = 0.03; group.add(detail);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshLambertMaterial({ color: 0x2486c8 }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -0.8; group.add(sea);

  // ------------------------------------------------ sky, clouds, barrier
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x3f8fe6) }, hor: { value: new THREE.Color(0xd2e8f8) }, sun: { value: new THREE.Vector3(0.45, 0.62, 0.35).normalize() } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 sun; varying vec3 vD; void main(){ float h = clamp(vD.y*1.3+0.04,0.,1.); vec3 c = mix(hor, top, pow(h,0.55)); float s = max(dot(normalize(vD),sun),0.); c += vec3(1.0,0.85,0.55)*(pow(s,700.)*3.0 + pow(s,10.)*0.22); c = mix(c, hor, 1.0 - smoothstep(-0.25,0.0,vD.y)); gl_FragColor = vec4(c,1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 24, 16), skyMat);
  sky.renderOrder = -10; sky.frustumCulled = false; group.add(sky);
  const cloudG = new THREE.Group();
  const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, fog: false, depthWrite: false });
  for (let i = 0; i < 34; i++) {
    const a = R() * 6.2832, d = 150 + R() * 900, y = 170 + R() * 120;
    for (let k = 0; k < 5; k++) { const m = new THREE.Mesh(GEO.sph, cm); m.position.set(Math.cos(a) * d + (R() - 0.5) * 60, y + (R() - 0.5) * 8, Math.sin(a) * d + (R() - 0.5) * 60); m.scale.set(50 + R() * 50, 14 + R() * 8, 36 + R() * 30); cloudG.add(m); }
  }
  group.add(cloudG);

  const bmat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { time: { value: 0 }, col: { value: new THREE.Color(0x9a5aff) }, lvl: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform float time; uniform vec3 col; uniform float lvl; varying vec2 vUv; void main(){ vec2 g = vec2(vUv.x*260.0, vUv.y*16.0 - time*0.25); vec2 f = abs(fract(g)-0.5); float line = smoothstep(0.43,0.5,max(f.x,f.y)); float fade = pow(1.0-vUv.y,1.5); float wave = 0.75+0.25*sin(time*2.0+vUv.x*80.0); float a = (0.07 + line*0.3 + fade*0.38)*wave; gl_FragColor = vec4(col*(1.5+lvl*1.2), a); }',
  });
  const barrier = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 560, 160, 1, true), bmat);
  barrier.position.y = 270; barrier.frustumCulled = false; group.add(barrier);
  const bring = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 160), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xc8a0ff).multiplyScalar(2), side: THREE.DoubleSide, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  bring.rotation.x = -Math.PI / 2; bring.position.y = 0.4; bring.frustumCulled = false; group.add(bring);
  let curR = MAP_R;
  const setBarrier = (r: number, level: number, visible = true) => {
    curR = Math.max(0.5, r);
    barrier.visible = visible;
    bring.visible = visible;
    barrier.scale.set(curR, 1, curR);
    bring.scale.set(curR, curR, 1);
    bmat.uniforms.lvl.value = level;
    (bmat.uniforms.col.value as THREE.Color).setHSL(0.74 - level * 0.7, 0.9, 0.62);
    (bring.material as THREE.MeshBasicMaterial).color.setHSL(0.74 - level * 0.7, 0.9, 0.7).multiplyScalar(2);
  };
  setBarrier(MAP_R, 0);

  // ------------------------------------------------ spots
  const chestSpots: Spot[] = [];
  const lootSpots: Spot[] = [];
  const herbSpots: Spot[] = [];
  const spotNear = (x: number, z: number, r = 2.5) => !blocked(x, z, r);
  for (const p of POIS) {
    const n = 3 + p.tier * 3 + (p.id === 'limeiro' ? 6 : 0);
    let c = 0, g = 0;
    while (c < n && g++ < 200) {
      const a = R() * 6.2832, d = 6 + R() * (p.r * 0.9);
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      if (Math.hypot(x, z) > MAP_R - 25 || !spotNear(x, z)) continue;
      chestSpots.push({ x, z, tier: p.tier }); c++;
    }
    const m = 5 + p.tier * 4;
    c = 0; g = 0;
    while (c < m && g++ < 200) {
      const a = R() * 6.2832, d = 4 + R() * (p.r + 8);
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      if (Math.hypot(x, z) > MAP_R - 25 || !spotNear(x, z, 1.5)) continue;
      lootSpots.push({ x, z, tier: Math.max(0, p.tier - (R() < 0.5 ? 1 : 0)) }); c++;
    }
  }
  for (let i = 0, g = 0; i < 90 && g < 800; g++) {
    const a = R() * 6.2832, d = Math.sqrt(R()) * (MAP_R - 60);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (biomeAt(x, z) === 5 || !spotNear(x, z)) continue;
    (i % 3 === 0 ? chestSpots : lootSpots).push({ x, z, tier: 0 }); i++;
  }
  for (let i = 0, g = 0; i < 8 && g < 300; g++) {
    const a = R() * 6.2832, d = 18 + R() * 110;
    const x = poi('bandits').x + Math.cos(a) * d, z = poi('bandits').z + Math.sin(a) * d;
    if (!spotNear(x, z)) continue;
    herbSpots.push({ x, z, tier: 0 }); i++;
  }

  const world: GreedWorld = {
    name: 'Greed Island', group, obstacles, radius: MAP_R, mapCanvas: cv, near, blocked, chestSpots, lootSpots, herbSpots,
    env: { sky: 0xcfe6f6, fog: 0xcfe4f4, fogN: 120, fogF: 640, hemiS: 0xcfe8ff, hemiG: 0x7a9a5a, hemiI: 2.0, sunC: 0xfff0d2, sunI: 2.7 },
    setFocus(x, z, range = 700) {
      sky.position.set(x, 0, z);
      for (const c of chunkGroups) c.g.visible = Math.hypot(c.cx - x, c.cz - z) < range;
    },
    setBarrier,
    update(dt, time) {
      bmat.uniforms.time.value = time;
      cloudG.rotation.y += dt * 0.003;
      for (const h of hearts) { h.rotation.y += dt * 0.6; h.position.y = 52 + Math.sin(time * 1.2) * 2; }
      for (const b of beams) b.rotation.y += dt * 0.9;
      lakeMeshes.forEach((m, i) => ((m.material as THREE.MeshBasicMaterial).opacity = 0.8 + Math.sin(time * 1.6 + i) * 0.08));
      (bring.material as THREE.MeshBasicMaterial).opacity = 0.7 + Math.sin(time * 3) * 0.2;
    },
    dispose() {
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && !Object.values(GEO).includes(m.geometry)) m.geometry?.dispose();
      });
      gtex.dispose(); dtex.dispose();
    },
  };
  return world;
}
