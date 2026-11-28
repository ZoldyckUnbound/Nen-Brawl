import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { World, Obstacle } from '../world';
import { POIS, ROADS, MAP_R, DUNGEONS, poi, type Poi } from './data';
import { buildTown, Loc, type Ctx } from './towns';
import * as T from '../terrain';

export interface Spot { x: number; z: number; tier: number }
export interface GreedWorld extends World {
  mapCanvas: HTMLCanvasElement;
  /** rough outline-only chart (the cheap map card) */
  chartCanvas: HTMLCanvasElement;
  secretSpots: { x: number; z: number; tier: number; name: string }[];
  mapW: number;
  near: (x: number, z: number) => Obstacle[];
  setFocus: (x: number, z: number, range?: number) => void;
  prime: (x: number, z: number) => void;
  vegOn: boolean;
  setBarrier: (r: number, level: number, visible?: boolean) => void;
  blocked: (x: number, z: number, r: number) => boolean;
  groundAt: (x: number, z: number) => number;
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

// ------------------------------------------------------------------ geometry kit
const prismGeo = (() => { const sh = new THREE.Shape(); sh.moveTo(-0.5, 0); sh.lineTo(0.5, 0); sh.lineTo(0, 1); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); return g; })();
const GEO: Record<string, THREE.BufferGeometry> = {
  box: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 14).translate(0, 0.5, 0),
  cone: new THREE.ConeGeometry(0.5, 1, 12).translate(0, 0.5, 0),
  roof: new THREE.ConeGeometry(0.7071, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0),
  prism: prismGeo,
  sph: new THREE.SphereGeometry(0.5, 12, 9).translate(0, 0.5, 0),
  hemi: new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  rock: new THREE.DodecahedronGeometry(0.5, 0).translate(0, 0.3, 0),
};
const MAT_L = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
const MAT_E = new THREE.MeshBasicMaterial({ color: 0xffffff });

// ------------------------------------------------------------------ vegetation geometries (vertex coloured, merged)
function part(g: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) {
  const c = g.index ? g.toNonIndexed() : g.clone();
  c.deleteAttribute('uv');
  c.scale(sx, sy, sz); c.rotateX(rx); c.rotateZ(rz); c.translate(x, y, z);
  const n = c.attributes.position.count, col = new Float32Array(n * 3), cc = new THREE.Color(color);
  for (let i = 0; i < n; i++) { const k = 0.82 + 0.3 * (c.attributes.position.getY(i) / 14); col[i * 3] = cc.r * k; col[i * 3 + 1] = cc.g * k; col[i * 3 + 2] = cc.b * k; }
  c.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return c;
}
const IC = new THREE.IcosahedronGeometry(0.5, 0), CY6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6).translate(0, 0.5, 0), CO7 = new THREE.ConeGeometry(0.5, 1, 7).translate(0, 0.5, 0);
/** smooth, stretched blobs – used for canopies and bushes so they stop reading as faceted gravel */
const ICF = new THREE.IcosahedronGeometry(0.5, 1);
const SPH8 = new THREE.SphereGeometry(0.5, 9, 6);
const mk = (parts: THREE.BufferGeometry[]) => mergeGeometries(parts, false)!;
const VEG: Record<string, THREE.BufferGeometry> = {
  oak: mk([part(CY6, 0x6b4a2a, 0, 0, 0, 0.9, 3.4, 0.9), part(IC, 0x3f8f3f, 0, 3.6, 0, 5.2, 4.2, 5.2), part(IC, 0x4aa04a, 1.3, 4.8, 0.6, 3.4, 3, 3.4), part(IC, 0x358035, -1.4, 4.4, -0.7, 3.6, 3, 3.6)]),
  oak2: mk([part(CY6, 0x5a3e24, 0, 0, 0, 1.1, 4.6, 1.1), part(IC, 0x2f7a3a, 0, 5.4, 0, 6.6, 5, 6.6), part(IC, 0x3c8c40, 1.6, 7, 0.5, 4.2, 3.4, 4.2), part(IC, 0x2a6e34, -1.8, 6.4, -0.6, 4.6, 3.6, 4.6)]),
  pine: mk([part(CY6, 0x5a3e24, 0, 0, 0, 0.8, 3, 0.8), part(CO7, 0x2c5f45, 0, 1.6, 0, 5.2, 5.6, 5.2), part(CO7, 0x356f4e, 0, 4.4, 0, 4.2, 5, 4.2), part(CO7, 0x3f7f58, 0, 7.0, 0, 3.0, 4.4, 3.0)]),
  snowpine: mk([part(CY6, 0x5a3e24, 0, 0, 0, 0.8, 3, 0.8), part(CO7, 0x2f5f4c, 0, 1.6, 0, 5.2, 5.6, 5.2), part(CO7, 0xe8f0f4, 0, 3.2, 0, 4.6, 3.2, 4.6), part(CO7, 0x356f4e, 0, 4.4, 0, 4.2, 5, 4.2), part(CO7, 0xf2f6f8, 0, 6.0, 0, 3.6, 3.2, 3.6), part(CO7, 0xf4f8fa, 0, 7.0, 0, 3.0, 4.4, 3.0)]),
  birch: mk([part(CY6, 0xe8e4d8, 0, 0, 0, 0.55, 6, 0.55), part(CY6, 0x2a2a2a, 0, 1.2, 0.03, 0.57, 0.3, 0.57), part(CY6, 0x2a2a2a, 0, 3.4, 0.03, 0.57, 0.3, 0.57), part(IC, 0x9ac848, 0, 6.6, 0, 3.6, 4.6, 3.6), part(IC, 0xb0d858, 0.9, 5.4, 0.4, 2.6, 3, 2.6)]),
  jungle: mk([part(CY6, 0x5a4630, 0, 0, 0, 1.2, 11, 1.2), part(IC, 0x2f7a2a, 0, 11, 0, 9, 3.2, 9), part(IC, 0x3a8a30, 2.4, 11.6, 1, 6.5, 2.6, 6.5), part(IC, 0x2a6a28, -2.6, 10.8, -1, 6.5, 2.8, 6.5), part(IC, 0x1f5a24, 0, 13, 0, 5, 2.6, 5)]),
  palm: mk([part(CY6, 0x8a6a40, 0, 0, 0, 0.6, 3, 0.6, 0, 0.12), part(CY6, 0x8a6a40, 0.35, 3, 0, 0.5, 3.4, 0.5, 0, 0.2), ...[0, 1, 2, 3, 4, 5].map((i) => part(CO7, 0x4fae52, 0.9 + Math.cos(i * 1.05) * 1.6, 6.4, Math.sin(i * 1.05) * 1.6, 1.2, 3.4, 0.5, 0, 0).rotateY(0)).slice(0, 0), ...[0, 1, 2, 3, 4, 5].map((i) => { const g = part(CO7, i % 2 ? 0x4fae52 : 0x3f9a46, 0, 0, 0, 1.0, 4.2, 0.35); g.rotateZ(Math.PI / 2.3); g.rotateY(i * 1.05); g.translate(0.9, 6.3, 0); return g; })]),
  cactus: mk([part(CY6, 0x4f8f4a, 0, 0, 0, 1.2, 4.6, 1.2), part(CY6, 0x4f8f4a, 1.1, 1.8, 0, 0.7, 1.9, 0.7), part(CY6, 0x4f8f4a, -1.0, 2.6, 0, 0.7, 1.6, 0.7), part(CY6, 0x4f8f4a, 0.6, 1.8, 0, 1.4, 0.6, 0.7)]),
  dead: mk([part(CY6, 0x7a6a58, 0, 0, 0, 0.7, 5, 0.7), part(CY6, 0x7a6a58, 0.9, 3, 0, 0.35, 2.6, 0.35, 0, -0.9), part(CY6, 0x7a6a58, -0.8, 3.6, 0.2, 0.3, 2.2, 0.3, 0, 0.8), part(CY6, 0x7a6a58, 0.1, 4.2, 0.8, 0.25, 1.8, 0.25, 0.8, 0)]),
  bush: mk([
    part(SPH8, 0x3f8a3a, 0, 0.62, 0, 2.5, 1.35, 2.5),
    part(SPH8, 0x4a9a44, 0.78, 0.5, 0.42, 1.7, 1.05, 1.7),
    part(SPH8, 0x357f36, -0.7, 0.46, -0.5, 1.5, 0.95, 1.5),
    part(SPH8, 0x57a850, 0.1, 1.0, -0.75, 1.15, 0.8, 1.15),
    part(SPH8, 0x468f42, -0.45, 0.95, 0.7, 0.9, 0.65, 0.9),
    part(SPH8, 0x2c6a2c, 0, 0.1, 0, 2.6, 0.5, 2.6),
    part(IC, 0xc23b52, 0.62, 1.18, 0.34, 0.16, 0.16, 0.16),
    part(IC, 0xc23b52, -0.5, 0.98, 0.52, 0.14, 0.14, 0.14),
    part(IC, 0xc23b52, 0.12, 1.28, -0.5, 0.13, 0.13, 0.13),
  ]),
  rock: mk([part(ICF, 0x8a8a92, 0, 0.6, 0, 3.4, 2.4, 3.0), part(ICF, 0x7a7a84, 1.4, 0.4, 0.8, 2.0, 1.4, 1.8), part(IC, 0x9a9aa2, -0.5, 1.25, -0.2, 1.2, 0.9, 1.1)]),
  boulder: mk([part(IC, 0x9a948a, 0, 2, 0, 9, 6, 8), part(IC, 0x8a8478, 3.4, 1.2, 1.6, 5, 3.4, 4.6), part(IC, 0xa8a296, -2.8, 1.4, -1.4, 4.4, 3, 4)]),
  spire: mk([part(CY6, 0xb0663a, 0, 0, 0, 5, 7, 5), part(CY6, 0xc8844a, 0, 7, 0, 4, 5, 4), part(CY6, 0xa85a34, 0, 12, 0, 3.2, 6, 3.2), part(CY6, 0xd8a060, 0, 18, 0, 5.6, 1.6, 5.6), part(CO7, 0xb0663a, 0, 19.6, 0, 3, 2.4, 3)]),
  stump: mk([part(CY6, 0x6b4a2a, 0, 0, 0, 1.2, 0.8, 1.2), part(CY6, 0xb08a58, 0, 0.78, 0, 1.0, 0.06, 1.0), part(CY6, 0x5a3e24, 0.9, 0, 0.2, 0.5, 0.35, 0.5)]),
  log: mk([part(CY6, 0x5a3e24, 2.2, 0.55, 0, 1.1, 4.4, 1.1, 0, Math.PI / 2), part(CY6, 0x8a6a3a, -2.18, 0.55, 0, 0.9, 0.06, 0.9, 0, Math.PI / 2), part(IC, 0x4a8a3a, 0.4, 1.05, 0.2, 1.2, 0.5, 0.9)]),
  shrub: mk([
    part(SPH8, 0x4a9a44, 0, 0.52, 0, 2.4, 1.15, 2.4),
    part(SPH8, 0x3a8a3c, 0.95, 0.4, 0.45, 1.6, 0.9, 1.6),
    part(SPH8, 0x5aaa4a, -0.85, 0.42, -0.35, 1.4, 0.8, 1.4),
    part(SPH8, 0x2f7030, 0.15, 0.82, -0.7, 1.0, 0.62, 1.0),
    part(SPH8, 0x2f7030, 0, 0.08, 0, 2.5, 0.45, 2.5),
  ]),
  flowers: mk([
    part(SPH8, 0x4f9a45, 0, 0.08, 0, 2.4, 0.34, 2.4),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      const a = i * 1.1, r0 = 0.45 + (i % 3) * 0.32;
      const g = part(CO7, 0x5aa04a, Math.cos(a) * r0, 0.1, Math.sin(a) * r0, 0.07, 0.5 + (i % 2) * 0.2, 0.07);
      const p = part(IC, [0xff7a92, 0xffd24a, 0xfdf6ea, 0xb98aff, 0xffa35a, 0x8fdcff][i % 6], Math.cos(a) * r0, 0.58 + (i % 2) * 0.2, Math.sin(a) * r0, 0.3, 0.2, 0.3);
      return [g, p];
    }).flat(),
  ]),
  reed: mk([...[0, 1, 2, 3, 4].map((i) => part(CO7, 0x7a9a4a, Math.cos(i * 1.3) * 0.5, 0, Math.sin(i * 1.3) * 0.5, 0.18, 2.6 + (i % 3) * 0.5, 0.18))]),
};
const VEG_CAP: Record<string, number> = { oak: 9000, oak2: 7000, pine: 9000, snowpine: 3000, birch: 3000, jungle: 3000, palm: 1500, cactus: 3000, dead: 2000, bush: 5000, rock: 4000, boulder: 1500, spire: 1200, stump: 2500, log: 2500, shrub: 6000, flowers: 6000, reed: 3000 };
const VEG_KEYS = Object.keys(VEG);

// ------------------------------------------------------------------ terrain shader patch (fine world-space detail)
function patchTerrain(m: THREE.MeshLambertMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWP;
float hsh(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnz(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hsh(i), hsh(i+vec2(1,0)), f.x), mix(hsh(i+vec2(0,1)), hsh(i+vec2(1,1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float dN = vnz(vWP.xz * 0.9) * 0.5 + vnz(vWP.xz * 3.1) * 0.3 + vnz(vWP.xz * 11.0) * 0.2;
float fade = 1.0 - smoothstep(60.0, 520.0, length(vWP - cameraPosition));
diffuseColor.rgb *= 1.0 + (dN - 0.5) * 0.42 * fade;
diffuseColor.rgb *= 1.0 + (vnz(vWP.xz * 0.045) - 0.5) * 0.22;`);
  };
}

const NEAR = 256, NSEG = 32, FAR = 1024, FSEG = 26;
const TILE = 300;

export function buildGreedIsland(): GreedWorld {
  const R = rng(20250);
  const group = new THREE.Group();
  const obstacles: Obstacle[] = [];
  const grid = new Map<number, Obstacle[]>();
  const CELL = 48;
  const addOb = (x: number, z: number, r: number, h = 6) => {
    const o: Obstacle = { x, z, r, h: h + T.groundAt(x, z) };
    obstacles.push(o);
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL), z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = i * 8192 + j; let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(o); }
  };

  const addDome = (x: number, z: number, y0: number, rx: number, ry: number) => {
    const o: Obstacle = { x, z, r: rx, h: y0 + ry, dome: [y0, rx, ry] };
    obstacles.push(o);
    const x0 = Math.floor((x - rx) / CELL), x1 = Math.floor((x + rx) / CELL), z0 = Math.floor((z - rx) / CELL), z1 = Math.floor((z + rx) / CELL);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = i * 8192 + j; let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(o); }
  };
  const addFlat = (x: number, z: number, r: number, top: number) => {
    const o: Obstacle = { x, z, r, h: top, flat: top };
    obstacles.push(o);
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL), z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = i * 8192 + j; let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(o); }
  };

  // ------------------------------------------------ plateaus + roads feed the height-field
  const flats: T.Flat[] = POIS.map((p) => ({ x: p.x, z: p.z, r: p.r, h: Math.max(T.naturalAt(p.x, p.z), p.style === 'lighthouse' ? 3.5 : 2.6) }));
  for (const f of flats) if (f.h > 70) f.h = Math.min(f.h, 70);
  T.setFlats(flats);
  const segs: { x1: number; z1: number; x2: number; z2: number; w: number }[] = [];
  for (const [a, b] of ROADS) {
    const A = poi(a), B = poi(b), L = Math.hypot(B.x - A.x, B.z - A.z), nx = -(B.z - A.z) / L, nz = (B.x - A.x) / L;
    let px = A.x, pz = A.z;
    const n = Math.max(6, Math.round(L / 260));
    const bend = (R() - 0.5) * L * 0.18;
    for (let i = 1; i <= n; i++) {
      const t = i / n, w = Math.sin(Math.PI * t) * bend + (i < n ? (R() - 0.5) * 90 : 0);
      const x = A.x + (B.x - A.x) * t + nx * w, z = A.z + (B.z - A.z) * t + nz * w;
      segs.push({ x1: px, z1: pz, x2: x, z2: z, w: 7.5 }); px = x; pz = z;
    }
  }
  // ------------------------------------------------ harbours & causeways
  // Some towns are peninsulas (Soufrabi, the port, Dorias' bay): the shortest road between them and the next
  // town runs over open water. Rather than paint a road on the seabed we lift the ground into a stone causeway
  // and keep the dry stretches as ordinary road. Every point of the island – roads included – is then walkable.
  const pierSegs: typeof segs = [];
  const isWet = (x: number, z: number) => T.naturalAt(x, z) < 1.4;
  for (const sg of segs) {
    const L = Math.hypot(sg.x2 - sg.x1, sg.z2 - sg.z1);
    const n = Math.max(2, Math.ceil(L / 18));
    let run: typeof segs = [];
    const flush = () => { if (run.length) { pierSegs.push(...run); run = []; } };
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const ax = sg.x1 + (sg.x2 - sg.x1) * t0, az = sg.z1 + (sg.z2 - sg.z1) * t0;
      const bx = sg.x1 + (sg.x2 - sg.x1) * t1, bz = sg.z1 + (sg.z2 - sg.z1) * t1;
      const wet = isWet((ax + bx) / 2, (az + bz) / 2);
      if (wet) run.push({ x1: ax, z1: az, x2: bx, z2: bz, w: 9.5 });
      else flush();
    }
    flush();
  }
  T.setPierSegs(pierSegs);
  T.setRoadSegs(segs);
  const groundAt = T.groundAt;
  T.setGround(groundAt, (x, z) => groundAt(x, z) < T.DEEP);

  // ------------------------------------------------ town instancing (chunked, distance-culled)
  interface Item { x: number; y: number; z: number; sx: number; sy: number; sz: number; ry: number; c: THREE.Color }
  const tchunks = new Map<string, { cx: number; cz: number; items: Record<string, Item[]> }>();
  const claimGrid = new Map<number, { x: number; z: number; r: number }[]>();
  let curGy = 0;
  const indoorSpots: { x: number; z: number }[] = [];
  /** every street lamp / lantern in the world – drives the pooled point lights (see setFocus) */
  const lampSpots: { x: number; y: number; z: number; col: number }[] = [];
  const anim: ((t: number) => void)[] = [];
  let lampX = 1e9, lampZ = 1e9;
  const tgroup = new THREE.Group();
  group.add(tgroup);
  const addItem = (layer: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry: number, color: number, glow = 0) => {
    const kx = Math.floor(x / TILE), kz = Math.floor(z / TILE), key = kx + ',' + kz;
    let ch = tchunks.get(key);
    if (!ch) tchunks.set(key, (ch = { cx: (kx + 0.5) * TILE, cz: (kz + 0.5) * TILE, items: {} }));
    const L = glow ? layer + 'E' : layer;
    (ch.items[L] ??= []).push({ x, y: y + curGy, z, sx, sy, sz, ry, c: new THREE.Color(color).multiplyScalar(glow || 1) });
  };
  const sea = { ang: 0, dist: 300 };
  const ctx: Ctx = {
    add: addItem, circle: (x, z, r, h, flat) => { if (flat) addFlat(x, z, r, T.groundAt(x, z) + h); else addOb(x, z, r, h); }, group: tgroup, anim, R, gy: 0,
    indoor: (x, z) => indoorSpots.push({ x, z }),
    lampAdd: (x, y, z, col) => lampSpots.push({ x, y: y + curGy, z, col }),
    claim: (x, z, r) => {
      const kx = Math.floor(x / 48), kz = Math.floor(z / 48);
      for (let i = kx - 2; i <= kx + 2; i++) for (let j = kz - 2; j <= kz + 2; j++) { const a = claimGrid.get(i * 8192 + j); if (a) for (const c of a) if (Math.hypot(c.x - x, c.z - z) < c.r + r) return false; }
      const k = kx * 8192 + kz; let a = claimGrid.get(k); if (!a) claimGrid.set(k, (a = [])); a.push({ x, z, r }); return true;
    },
    tree: (x, z, s, kind) => { addItem(kind === 1 ? 'pineT' : 'oakT', x, 0, z, s, s, s, R() * 6, 0xffffff); addOb(x, z, 0.45 * s, 8 * s); },
    geo: GEO, matL: MAT_L, matE: MAT_E, sea,
  };
  for (const p of POIS) {
    const f = flats.find((q) => q.x === p.x && q.z === p.z)!;
    curGy = f.h; ctx.gy = f.h;
    // direction to the open sea
    let bestA = 0, bestD = 1e9;
    for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; const d = T.sdf(p.x + Math.sin(a) * 400, p.z + Math.cos(a) * 400); if (d < bestD) { bestD = d; bestA = a; } }
    let dist = 400; while (dist < 2500 && groundAt(p.x + Math.sin(bestA) * dist, p.z + Math.cos(bestA) * dist) > -0.2) dist += 20;
    sea.ang = bestA; sea.dist = dist;
    ctx.claim(p.x, p.z, 8);
    buildTown(ctx, p);
  }
  curGy = 0;
  // ------------------------------------------------ rare sites: peaks, hidden coves, heartwoods, canyon vaults, dungeons
  const secretSpots: { x: number; z: number; tier: number; name: string }[] = [];
  {
    const far = (x: number, z: number, d: number) => secretSpots.every((q) => Math.hypot(q.x - x, q.z - z) > d) && POIS.every((q) => Math.hypot(q.x - x, q.z - z) > q.r * 1.4 + 120);
    for (const d of DUNGEONS) secretSpots.push({ x: d.x, z: d.z - 14, tier: 3, name: d.name });
    const R2 = rng(777);
    const cands: { x: number; z: number; h: number; k: string }[] = [];
    for (let i = 0; i < 3200; i++) {
      const x = (R2() * 2 - 1) * 6500, z = (R2() * 2 - 1) * 7000, h = groundAt(x, z);
      if (h < 2 || T.sdf(x, z) < 90) continue;
      const slope = T.slopeAt(x, z, 6);
      if (h > 140 && slope < 0.55) cands.push({ x, z, h, k: 'peak' });
      else if (T.sdf(x, z) < 200 && h < 5 && slope < 0.18) cands.push({ x, z, h, k: 'cove' });
      else if (T.forestAt(x, z) > 0.7 && slope < 0.28) cands.push({ x, z, h, k: 'heart' });
      else if (T.badAt(x, z) > 0.55 && h < 30 && slope < 0.35) cands.push({ x, z, h, k: 'vault' });
    }
    const NAMES: Record<string, string[]> = { peak: ['Skyreach Shrine', 'Frostcrown Altar', 'Windtooth Ruin', 'Stormwatch Cairn', 'Eagle Throne'], cove: ["Smuggler's Cove", 'Moonlit Cache', "Wreckers' Hollow", 'Tidewatch Grotto'], heart: ['Heartwood Hollow', 'Elder Grove', 'Mossglade Circle', 'Thousand-Year Stump'], vault: ['Canyon Vault', 'Sunscar Tomb', 'Dustwalker Crypt'] };
    const want: [string, number][] = [['peak', 5], ['cove', 4], ['heart', 4], ['vault', 3]];
    for (const [k, n] of want) {
      let c = 0;
      const list = cands.filter((q) => q.k === k).sort((a, b) => (k === 'peak' ? b.h - a.h : R2() - 0.5));
      for (const q of list) { if (c >= n) break; if (!far(q.x, q.z, 900)) continue; secretSpots.push({ x: q.x, z: q.z, tier: k === 'vault' || k === 'peak' ? 3 : 2, name: NAMES[k][c % NAMES[k].length] }); c++; }
    }
    secretSpots.forEach((q, qi) => {
      curGy = groundAt(q.x, q.z);
      const L = new Loc(ctx, q.x, q.z, R2() * 6);
      const crystal = q.tier === 3 ? 0xff8a4a : 0x7ad0ff;
      L.cyl(0, 0, 0, 24, 0.5, 24, 0x8a8478); L.cyl(0, 0.5, 0, 15, 0.2, 15, 0xa8a090);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * 6.2832, hgt = 5 + ((i * 7) % 5) * 1.2, broken = i % 3 === 0;
        L.cyl(Math.cos(a) * 9.5, 0.5, Math.sin(a) * 9.5, 1.6, broken ? hgt * 0.45 : hgt, 1.6, 0xb4ac9c);
        if (!broken) L.box(Math.cos(a) * 9.5, 0.5 + hgt, Math.sin(a) * 9.5, 2.2, 0.7, 2.2, 0x9a9488);
        const [wx, wz] = L.w(Math.cos(a) * 9.5, Math.sin(a) * 9.5); ctx.circle(wx, wz, 0.9, broken ? hgt * 0.45 : hgt);
      }
      for (let i = 0; i < 3; i++) { const a = (i / 3) * 6.2832 + 0.5; L.cone(Math.cos(a) * 4, 0.7, Math.sin(a) * 4, 1.2, 3.6, 1.2, crystal, 2.2); }
      L.box(0, 0.7, 6.4, 5, 0.5, 1.2, 0x9a9488); L.cyl(0, 0.7, -6, 1, 7 + (qi % 3), 1, 0x7a7468);
      if (q.tier === 3) { L.box(-3.4, 0.5, 12, 1.4, 9, 1.4, 0x8a8478); L.box(3.4, 0.5, 12, 1.4, 9, 1.4, 0x8a8478); L.box(0, 9.5, 12, 8.6, 1.4, 1.6, 0x7a7468); L.sph(0, 1.0, 12, 2.4, 2.4, 2.4, crystal, 1.8); }
    });
    curGy = 0;
  }
  // town ground slabs sink under their own plateau (items y already includes gy)

  // flatten emissive layers into InstancedMeshes per tile
  const tileGroups: { g: THREE.Group; cx: number; cz: number }[] = [];
  const dummy = new THREE.Object3D();
  const instKey = (k: string) => (k.endsWith('E') ? k.slice(0, -1) : k);
  for (const ch of tchunks.values()) {
    const g = new THREE.Group();
    for (const [layer, items] of Object.entries(ch.items)) {
      const emissive = layer.endsWith('E');
      let base = instKey(layer);
      let geo = GEO[base];
      let mat: THREE.Material = emissive ? MAT_E : MAT_L;
      if (base === 'oakT') { geo = VEG.oak; mat = VEG_MAT; }
      if (base === 'pineT') { geo = VEG.pine; mat = VEG_MAT; }
      if (!geo) { base = 'box'; geo = GEO.box; }
      const im = new THREE.InstancedMesh(geo, mat, items.length);
      im.castShadow = false; im.receiveShadow = false;
      const isVeg = base === 'oakT' || base === 'pineT';
      items.forEach((it, i) => { dummy.position.set(it.x, it.y, it.z); dummy.rotation.set(0, it.ry, 0); dummy.scale.set(it.sx, it.sy, it.sz); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, isVeg ? new THREE.Color(0xffffff).multiplyScalar(0.85 + R() * 0.3) : it.c); });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.frustumCulled = false;
      g.add(im);
    }
    g.visible = false; group.add(g);
    tileGroups.push({ g, cx: ch.cx, cz: ch.cz });
  }
  // fix: re-add town chunk y for plateau when items were added with curGy (done at add time)

  // ------------------------------------------------ chunked terrain + vegetation
  const terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  patchTerrain(terrainMat);
  const idxCache = new Map<number, THREE.BufferAttribute>();
  const indexFor = (segs: number) => {
    let a = idxCache.get(segs);
    if (!a) { const idx: number[] = []; const w = segs + 1; for (let j = 0; j < segs; j++) for (let i = 0; i < segs; i++) { const p = j * w + i; idx.push(p, p + w, p + 1, p + 1, p + w, p + w + 1); } a = new THREE.BufferAttribute(new Uint32Array(idx), 1); idxCache.set(segs, a); }
    return a;
  };
  const rgb = [0, 0, 0];
  function makeTerrain(x0: number, z0: number, size: number, segs: number, yOff: number) {
    const pad = segs + 3, step = size / segs, hs = new Float32Array(pad * pad);
    for (let j = 0; j < pad; j++) for (let i = 0; i < pad; i++) hs[j * pad + i] = groundAt(x0 + (i - 1) * step, z0 + (j - 1) * step);
    const w = segs + 1, pos = new Float32Array(w * w * 3), col = new Float32Array(w * w * 3), nor = new Float32Array(w * w * 3);
    for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
      const x = x0 + i * step, z = z0 + j * step, h = hs[(j + 1) * pad + i + 1];
      const hx = hs[(j + 1) * pad + i + 2] - hs[(j + 1) * pad + i], hz = hs[(j + 2) * pad + i + 1] - hs[j * pad + i + 1];
      const nx = -hx / (2 * step), nz = -hz / (2 * step), nl = Math.hypot(nx, 1, nz);
      const k = (j * w + i) * 3;
      pos[k] = x; pos[k + 1] = h + yOff; pos[k + 2] = z;
      nor[k] = nx / nl; nor[k + 1] = 1 / nl; nor[k + 2] = nz / nl;
      T.colorAt(x, z, h, Math.hypot(nx, nz), rgb);
      col[k] = rgb[0]; col[k + 1] = rgb[1]; col[k + 2] = rgb[2];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(indexFor(segs));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(x0 + size / 2, 0, z0 + size / 2), size * 0.9 + 400);
    const m = new THREE.Mesh(g, terrainMat);
    m.receiveShadow = true; m.frustumCulled = false;
    return m;
  }
  const nearMeshes = new Map<string, THREE.Mesh>(), farMeshes = new Map<string, THREE.Mesh>();
  const terrainGroup = new THREE.Group(); group.add(terrainGroup);

  // vegetation data per chunk (also drives tree/rock collision)
  interface CD { veg: Record<string, number[]> }
  const cdata = new Map<string, CD>();
  const inTown = (x: number, z: number) => { for (const p of POIS) if (Math.hypot(x - p.x, z - p.z) < p.r * 1.12) return true; return false; };
  /** collision profile of every plant / rock: slim trunks, climbable ellipsoid rocks */
  const TRUNK: Record<string, number> = { oak: 0.5, oak2: 0.58, pine: 0.42, snowpine: 0.42, birch: 0.3, jungle: 0.64, palm: 0.34, cactus: 0.62, dead: 0.38, spire: 2.7, stump: 0 };
  const LUMPS: Record<string, [number, number, number, number, number][]> = {
    rock: [[0, 0.6, 0, 1.55, 1.1], [1.4, 0.4, 0.8, 0.85, 0.62]],
    boulder: [[0, 2, 0, 3.9, 2.7], [3.4, 1.2, 1.6, 2.1, 1.5], [-2.8, 1.4, -1.4, 1.8, 1.35]],
  };
  const ss = T.sstep;
  function genChunk(kx: number, kz: number): CD {
    const key = kx + ',' + kz;
    let cd = cdata.get(key);
    if (cd) return cd;
    cd = { veg: {} }; cdata.set(key, cd);
    const r = rng(kx * 73856093 ^ kz * 19349663 ^ 777);
    const sp = 9.5;
    const push = (t: string, x: number, h: number, z: number, s: number) => {
      const yaw = r() * 6.28;
      (cd!.veg[t] ??= []).push(x, h, z, yaw, s, 0.85 + r() * 0.3);
      const tr = TRUNK[t];
      if (tr) addOb(x, z, tr * s, 8 * s);
      const lumps = LUMPS[t];
      if (lumps) {
        const co = Math.cos(yaw), si = Math.sin(yaw);
        for (const [dx, cy, dz, rx, ry] of lumps) {
          const ox = x + (dx * co + dz * si) * s, oz = z + (-dx * si + dz * co) * s;
          addDome(ox, oz, h + cy * s, rx * s, ry * s);
        }
      }
      if (t === 'stump') addFlat(x, z, 0.62 * s, h + 0.8 * s);
      if (t === 'log') { const co = Math.cos(yaw), si = Math.sin(yaw); for (const d of [-1.5, 0, 1.5]) addFlat(x + (d * co) * s, z + (-d * si) * s, 0.6 * s, h + 0.95 * s); }
    };
    for (let j = 0; j < NEAR / sp; j++) for (let i = 0; i < NEAR / sp; i++) {
      const x = kx * NEAR + (i + 0.1 + r() * 0.8) * sp, z = kz * NEAR + (j + 0.1 + r() * 0.8) * sp;
      const q = r();
      const h = groundAt(x, z);
      if (h < 0.9 || T.sdf(x, z) < -50) continue;
      if (inTown(x, z)) continue;
      const rdist = T.roadDist(x, z), vr = T.riverDist(x, z);
      if (rdist < 6) continue;
      const hy = h - 0.15;
      const slope = Math.abs(groundAt(x + 2, z) - h) / 2 + Math.abs(groundAt(x, z + 2) - h) / 2;
      const f = T.forestAt(x, z), bd = T.badAt(x, z), warm = T.warmth(z);
      // low-frequency fields give natural groves, clearings, stands of a single species and rock outcrops instead of uniform scatter
      const grove = T.fbm(x / 46, z / 46, 61), clear = T.fbm(x / 120 + 7, z / 120, 63), stand = T.fbm(x / 210, z / 210, 65), age = T.fbm(x / 64, z / 64, 67);
      const sz = 0.78 + age * 1.0 + r() * 0.22;
      if (vr < 40 && vr > 14 && h < 14 && q < 0.5) { push('reed', x, hy, z, 0.8 + r() * 0.6); continue; }
      if (vr < 22) { if (q < 0.04) push('rock', x, hy, z, 0.5 + r() * 0.7); continue; }
      if (bd > 0.35) {
        const mesa = T.fbm(x / 95, z / 95, 71);
        if (mesa > 0.66 && slope < 0.7 && q < 0.12 * bd) push('spire', x, hy, z, 0.55 + r() * 1.2);
        else if (q < 0.045 * bd && grove > 0.45) push('cactus', x, hy, z, 0.8 + r() * 0.8);
        else if (q < 0.075 * bd) push('dead', x, hy, z, 0.8 + r() * 0.7);
        else if (q < 0.2 * bd && (slope > 0.25 || grove > 0.55)) { push('rock', x, hy, z, 0.7 + r() * 1.5); if (r() < 0.35) push('rock', x + r() * 4 - 2, h - 0.15, z + r() * 4 - 2, 0.5 + r() * 0.8); }
        else if (q < 0.225 * bd && slope > 0.3) push('boulder', x, hy, z, 0.6 + r() * 0.8);
        continue;
      }
      if (h < 3.4) { if (q < 0.1 * ss(0.3, 0.6, grove)) push('palm', x, hy, z, 0.9 + r() * 0.5); else if (q > 0.97) push('rock', x, hy, z, 0.4 + r() * 0.6); continue; }
      if (slope > 0.85) { if (q < 0.22) push('boulder', x, hy, z, 0.6 + r() * 0.9); continue; }
      if (h > 215) { if (q < 0.09) push(r() < 0.3 ? 'boulder' : 'rock', x, hy, z, 0.8 + r() * 1.6); continue; }
      const outcrop = ss(0.25, 0.8, slope) * 0.6 + ss(70, 190, h) * 0.5;
      const dens = f * ss(0.3, 0.6, grove) * (1 - 0.85 * ss(0.62, 0.78, clear));
      if (q < dens * 0.97) {
        if (h > 140) push('snowpine', x, hy, z, sz);
        else if (warm < 0.45 || h > 70) push(stand < 0.6 ? 'pine' : stand < 0.82 ? 'pine' : 'birch', x, hy, z, sz);
        else if (warm > 0.8 && stand > 0.45 && q < dens * 0.4) push('jungle', x, hy, z, sz);
        else push(stand < 0.34 ? 'oak' : stand < 0.62 ? 'oak2' : stand < 0.8 ? 'oak' : 'birch', x, hy, z, sz);
        continue;
      }
      if (f > 0.15 && q > 0.97 - dens * 0.2) { const k = r(); if (k < 0.34) push('stump', x, hy, z, 0.8 + r() * 0.7); else if (k < 0.6) push('log', x, hy, z, 0.8 + r() * 0.6); else push('shrub', x, hy, z, 0.8 + r() * 0.8); continue; }
      if (q > 0.93 - f * 0.12 && f > 0.05) { push(r() < 0.55 ? 'bush' : 'shrub', x, hy, z, 0.7 + r() * 0.8); continue; }
      if (q < 0.045 * outcrop) { push(r() < 0.18 && slope > 0.3 ? 'boulder' : 'rock', x, hy, z, 0.6 + r() * 1.4); if (r() < 0.5) push('rock', x + r() * 5 - 2.5, h - 0.15, z + r() * 5 - 2.5, 0.45 + r() * 0.7); continue; }
      // open meadow: sparse lone trees and wildflower drifts
      const meadow = T.fbm(x / 58, z / 58, 69);
      if (f < 0.1 && h < 90) {
        if (meadow > 0.6 && q < 0.35) { for (let n = 0; n < 3; n++) push('flowers', x + r() * 5 - 2.5, h - 0.15, z + r() * 5 - 2.5, 0.8 + r() * 0.8); continue; }
        if (q > 0.992) { push(warm > 0.5 ? 'oak2' : 'oak', x, hy, z, 1.0 + r() * 0.7); continue; }
        if (q < 0.012) { push('bush', x, hy, z, 0.7 + r() * 0.6); continue; }
      }
    }
    return cd;
  }
  const vegMeshes: Record<string, THREE.InstancedMesh> = {};
  for (const k of VEG_KEYS) { const im = new THREE.InstancedMesh(VEG[k], VEG_MAT, VEG_CAP[k]); im.count = 0; im.frustumCulled = false; im.castShadow = false; vegMeshes[k] = im; group.add(im); }
  let vegSig = '';
  function vegTick(x: number, z: number, budget = 2) {
    if (!world.vegOn) return;
    const cx = Math.floor(x / NEAR), cz = Math.floor(z / NEAR);
    let missing = false;
    for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
      if (i * i + j * j > 11) continue;
      if (!cdata.has(cx + i + ',' + (cz + j))) { if (budget-- > 0) genChunk(cx + i, cz + j); else missing = true; }
    }
    const sig = cx + ',' + cz;
    if (missing || sig === vegSig) return;
    vegSig = sig;
    const counts: Record<string, number> = {};
    for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
      if (i * i + j * j > 11) continue;
      const cd = genChunk(cx + i, cz + j);
      for (const k of VEG_KEYS) {
        const a = cd.veg[k]; if (!a) continue;
        const im = vegMeshes[k]; let n = counts[k] ?? 0;
        for (let q = 0; q < a.length && n < VEG_CAP[k]; q += 6, n++) {
          dummy.position.set(a[q], a[q + 1], a[q + 2]); dummy.rotation.set(0, a[q + 3], 0); dummy.scale.setScalar(a[q + 4]); dummy.updateMatrix();
          im.setMatrixAt(n, dummy.matrix); im.setColorAt(n, TMP.setScalar(a[q + 5]));
        }
        counts[k] = n;
      }
    }
    for (const k of VEG_KEYS) { const im = vegMeshes[k]; im.count = counts[k] ?? 0; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  }

  const queue: { kind: 'n' | 'f'; kx: number; kz: number; d: number }[] = [];
  let fx = 1e9, fz = 1e9;
  function refocus(x: number, z: number) {
    if (Math.hypot(x - fx, z - fz) < 24) return;
    fx = x; fz = z;
    const cx = Math.floor(x / NEAR), cz = Math.floor(z / NEAR), fcx = Math.floor(x / FAR), fcz = Math.floor(z / FAR);
    const NR = 4, FR = 4;
    queue.length = 0;
    const want = new Set<string>();
    for (let j = -NR; j <= NR; j++) for (let i = -NR; i <= NR; i++) {
      const k = cx + i + ',' + (cz + j); want.add(k);
      if (!nearMeshes.has(k)) queue.push({ kind: 'n', kx: cx + i, kz: cz + j, d: i * i + j * j });
    }
    for (const [k, m] of nearMeshes) if (!want.has(k)) { terrainGroup.remove(m); m.geometry.dispose(); nearMeshes.delete(k); }
    const wantF = new Set<string>();
    for (let j = -FR; j <= FR; j++) for (let i = -FR; i <= FR; i++) {
      const k = fcx + i + ',' + (fcz + j); wantF.add(k);
      if (!farMeshes.has(k)) queue.push({ kind: 'f', kx: fcx + i, kz: fcz + j, d: 100 + i * i + j * j });
    }
    for (const [k, m] of farMeshes) if (!wantF.has(k)) { terrainGroup.remove(m); m.geometry.dispose(); farMeshes.delete(k); }
    queue.sort((a, b) => a.d - b.d);
    for (const [k, m] of farMeshes) { const [kx, kz] = k.split(',').map(Number); m.visible = Math.hypot((kx + 0.5) * FAR - x, (kz + 0.5) * FAR - z) > 3 * NEAR + 520; }
  }
  function pump(n: number) {
    while (n-- > 0 && queue.length) {
      const q = queue.shift()!;
      if (q.kind === 'n') {
        // a half-tile overlap into every neighbouring chunk: the fine mesh and the coarse mesh sampling the
        // same analytic height are never exactly equal, and without the skirt that tiny difference opened a
        // hairline crack (a visible "broken strip" of sky or old mesh) wherever two tiles met
        const m = makeTerrain(q.kx * NEAR - 4, q.kz * NEAR - 4, NEAR + 8, NSEG + 1, 0); terrainGroup.add(m); nearMeshes.set(q.kx + ',' + q.kz, m);
      } else {
        const m = makeTerrain(q.kx * FAR - 8, q.kz * FAR - 8, FAR + 16, FSEG + 1, -4); m.visible = Math.hypot((q.kx + 0.5) * FAR - fx, (q.kz + 0.5) * FAR - fz) > 3 * NEAR + 520; terrainGroup.add(m); farMeshes.set(q.kx + ',' + q.kz, m);
      }
    }
  }
  const tmpList: Obstacle[] = [];
  const near = (x: number, z: number) => {
    const kx = Math.floor(x / NEAR), kz = Math.floor(z / NEAR);
    genChunk(kx, kz);
    const ox = x - kx * NEAR, oz = z - kz * NEAR;
    if (ox < 8) genChunk(kx - 1, kz); else if (ox > NEAR - 8) genChunk(kx + 1, kz);
    if (oz < 8) genChunk(kx, kz - 1); else if (oz > NEAR - 8) genChunk(kx, kz + 1);
    tmpList.length = 0;
    const i = Math.floor(x / CELL), j = Math.floor(z / CELL);
    for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) { const l = grid.get(a * 8192 + b); if (l) for (const o of l) tmpList.push(o); }
    return tmpList;
  };
  const blocked = (x: number, z: number, r: number) => {
    if (T.groundAt(x, z) < T.DEEP + 0.2) return true;
    for (const o of near(x, z)) if (Math.hypot(x - o.x, z - o.z) < o.r + r) return true;
    return false;
  };

  // ------------------------------------------------ water: sea, river ribbons
  const nc = document.createElement('canvas'); nc.width = nc.height = 128;
  { const c = nc.getContext('2d')!; const im = c.createImageData(128, 128); for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const a = Math.sin(x / 128 * 6.283 * 3 + Math.sin(y / 128 * 6.283 * 2) * 1.6) * 0.5 + Math.sin(y / 128 * 6.283 * 4 + x / 20) * 0.5; const i = (y * 128 + x) * 4; im.data[i] = 128 + a * 40; im.data[i + 1] = 128 + Math.cos(x / 9 + y / 13) * 40; im.data[i + 2] = 255; im.data[i + 3] = 255; } c.putImageData(im, 0, 0); }
  const ntex = new THREE.CanvasTexture(nc); ntex.wrapS = ntex.wrapT = THREE.RepeatWrapping; ntex.repeat.set(220, 220);
  const seaMat = new THREE.MeshPhongMaterial({ color: 0x1f8fd0, transparent: true, opacity: 0.8, shininess: 120, specular: 0xbfe6ff, normalMap: ntex, normalScale: new THREE.Vector2(0.35, 0.35), depthWrite: false });
  const sea2 = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), seaMat);
  sea2.rotation.x = -Math.PI / 2; sea2.position.y = T.SEA_Y; sea2.renderOrder = 2; group.add(sea2);
  const deepFloor = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), new THREE.MeshBasicMaterial({ color: 0x0b3a5c })); deepFloor.rotation.x = -Math.PI / 2; deepFloor.position.y = -14; group.add(deepFloor);
  const riverMat = new THREE.MeshPhongMaterial({ color: 0x3aa0d8, transparent: true, opacity: 0.78, shininess: 100, specular: 0xffffff, normalMap: ntex, normalScale: new THREE.Vector2(0.3, 0.3), depthWrite: false });
  for (const line of T.RIVER_LINES) {
    const pts: [number, number][] = [];
    for (let i = 0; i < line.length - 1; i++) for (let k = 0; k < 10; k++) { const t = k / 10; pts.push([line[i][0] + (line[i + 1][0] - line[i][0]) * t, line[i][1] + (line[i + 1][1] - line[i][1]) * t]); }
    pts.push(line[line.length - 1]);
    const pos: number[] = [], idx: number[] = [], uv: number[] = [];
    pts.forEach(([x, z], i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l, hw = 11 + Math.sin(i * 0.7) * 2;
      for (const s of [-1, 1]) { const px = x + nx * hw * s, pz = z + nz * hw * s; pos.push(px, Math.max(groundAt(x, z) + 1.35, T.SEA_Y + 0.05), pz); uv.push(s > 0 ? 1 : 0, i * 0.3); }
      if (i < pts.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, riverMat); m.renderOrder = 2; m.frustumCulled = false; group.add(m);
  }

  // ------------------------------------------------ causeway decks: pale stone walkways over the water.
  // The height-field already lifts the seabed into a solid pier; these thin, slatted decks sit on top of it so a
  // harbour road reads as a harbour road (and its lamps line it) instead of a line of wet sand in the sea.
  {
    const deckMat = new THREE.MeshLambertMaterial({ color: 0xb9b3a4 });
    const railMat = new THREE.MeshLambertMaterial({ color: 0x6f6a60 });
    const pillars: THREE.Matrix4[] = [];
    const dummyD = new THREE.Object3D();
    for (const sg of pierSegs) {
      const L = Math.hypot(sg.x2 - sg.x1, sg.z2 - sg.z1);
      if (L < 0.5) continue;
      const ry = Math.atan2(sg.x2 - sg.x1, sg.z2 - sg.z1);
      const mx = (sg.x1 + sg.x2) / 2, mz = (sg.z1 + sg.z2) / 2;
      const gy = T.groundAt(mx, mz);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(sg.w, 0.5, L + 1.2), deckMat);
      deck.position.set(mx, gy + 0.1, mz); deck.rotation.y = ry; deck.receiveShadow = true; group.add(deck);
      // low kerbs on both sides
      for (const sd of [-1, 1]) {
        const kerb = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, L + 1.2), railMat);
        kerb.position.set(mx + Math.cos(ry) * sd * (sg.w / 2 - 0.3), gy + 0.45, mz - Math.sin(ry) * sd * (sg.w / 2 - 0.3));
        kerb.rotation.y = ry; group.add(kerb);
      }
      // a pile at either end and one in the middle
      for (let t = 0; t <= 1.001; t += 0.5) {
        const px = sg.x1 + (sg.x2 - sg.x1) * t, pz = sg.z1 + (sg.z2 - sg.z1) * t;
        for (const sd of [-1, 1]) {
          dummyD.position.set(px + Math.cos(ry) * sd * (sg.w / 2 - 0.7), T.groundAt(px, pz) - 4, pz - Math.sin(ry) * sd * (sg.w / 2 - 0.7));
          dummyD.scale.set(0.9, 9, 0.9); dummyD.updateMatrix(); pillars.push(dummyD.matrix.clone());
        }
      }
    }
    if (pillars.length) {
      const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.62, 1, 6), railMat, pillars.length);
      im.frustumCulled = false;
      pillars.forEach((m, i) => im.setMatrixAt(i, m));
      group.add(im);
    }
  }

  // ------------------------------------------------ sky, clouds, barrier
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x2f7fe0) }, hor: { value: new THREE.Color(0xcfe6f6) }, sun: { value: new THREE.Vector3(0.45, 0.55, 0.35).normalize() } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 sun; varying vec3 vD; void main(){ vec3 d = normalize(vD); float h = clamp(d.y*1.25+0.03,0.,1.); vec3 c = mix(hor, top, pow(h,0.5)); float s = max(dot(d,sun),0.); c += vec3(1.0,0.86,0.6)*pow(s,900.)*3.0 + vec3(1.0,0.8,0.5)*pow(s,10.)*0.18; c = mix(c, hor, smoothstep(0.0,-0.25,d.y)); gl_FragColor = vec4(c,1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(5200, 32, 20), skyMat);
  sky.renderOrder = -11; sky.frustumCulled = false; group.add(sky);
  const cloudG = new THREE.Group();
  const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.86, fog: false, depthWrite: false });
  for (let i = 0; i < 70; i++) {
    const a = R() * 6.2832, d = 400 + R() * 7600, y = 520 + R() * 380;
    const cl = new THREE.Group(); cl.position.set(Math.cos(a) * d, y, Math.sin(a) * d);
    for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(GEO.sph, cm); m.position.set((R() - 0.5) * 300, (R() - 0.5) * 30, (R() - 0.5) * 200); m.scale.set(220 + R() * 240, 60 + R() * 40, 160 + R() * 160); cl.add(m); }
    cloudG.add(cl);
  }
  group.add(cloudG);

  const bmat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { time: { value: 0 }, col: { value: new THREE.Color(0x9a5aff) }, lvl: { value: 0 }, circ: { value: 1000 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform float time; uniform vec3 col; uniform float lvl; uniform float circ; varying vec2 vUv; void main(){ vec2 g = vec2(vUv.x*circ, vUv.y*48.0 - time*0.5); vec2 f = abs(fract(g)-0.5); float line = smoothstep(0.44,0.5,max(f.x,f.y)); float fade = pow(1.0-vUv.y,1.5); float pulse = 0.6+0.4*sin(time*2.0+vUv.y*18.0+vUv.x*40.0); float a = (line*0.6+0.14)*fade*(0.65+0.35*pulse); gl_FragColor = vec4(col*(1.1+lvl)*1.5, a); }',
  });
  const barrier = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1500, 220, 1, true), bmat);
  barrier.position.y = 650; barrier.frustumCulled = false; group.add(barrier);
  const bring = new THREE.Mesh(new THREE.RingGeometry(0.994, 1, 220), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xc8a0ff).multiplyScalar(2), side: THREE.DoubleSide, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  bring.rotation.x = -Math.PI / 2; bring.position.y = 3; bring.frustumCulled = false; group.add(bring);
  const setBarrier = (r: number, level: number, visible = true) => {
    const cr = Math.max(0.5, r);
    barrier.visible = visible; bring.visible = visible;
    barrier.scale.set(cr, 1, cr); bring.scale.set(cr, cr, 1);
    bmat.uniforms.lvl.value = level; bmat.uniforms.circ.value = (2 * Math.PI * cr) / 26;
    (bmat.uniforms.col.value as THREE.Color).setHSL(0.74 - level * 0.7, 0.9, 0.62);
    (bring.material as THREE.MeshBasicMaterial).color.setHSL(0.74 - level * 0.7, 0.9, 0.7).multiplyScalar(2);
  };
  setBarrier(MAP_R, 0, false);

  // ------------------------------------------------ pooled town lighting: 6 real point lights that re-home to the
  // nearest lamps (or flying lanterns) as the player moves. Each lamp therefore throws actual light on the
  // road and walls around it – the glow, the lit flagstones and the shadows all stay anchored in the world
  // and can never change just because the camera moved.
  const LAMP_POOL = 6;
  const pool = { list: [] as THREE.PointLight[], idx: -1, t: 0, last: [] as number[] };
  for (let i = 0; i < LAMP_POOL; i++) {
    const l = new THREE.PointLight(0xffd9a0, 0, 34, 1.7);
    l.castShadow = false;
    group.add(l);
    pool.list.push(l);
  }
  const NEAR_LAMP: { s: { x: number; y: number; z: number; col: number }; d: number }[] = [];
  function assignLights(x: number, z: number) {
    NEAR_LAMP.length = 0;
    for (const s of lampSpots) {
      const d = Math.hypot(s.x - x, s.z - z);
      if (d > 210) continue;
      NEAR_LAMP.push({ s, d });
    }
    NEAR_LAMP.sort((a, b) => a.d - b.d);
    for (let i = 0; i < pool.list.length; i++) {
      const p = pool.list[i];
      const e = NEAR_LAMP[i];
      if (!e) { p.intensity = 0; continue; }
      const fall = 1 - Math.min(1, e.d / 190);
      p.position.set(e.s.x, e.s.y + 3.4, e.s.z);
      p.color.setHex(e.s.col);
      // inverse-square-ish falloff baked into a friendly level: strong close, gone past ~120 m
      p.intensity = 26 * fall * fall + 7 * fall;
      p.distance = 44;
    }
  }

  // ------------------------------------------------ world atlas (detailed) + island chart (outline only)
  const MS = 704, MW = T.WORLD_W;
  const cv = document.createElement('canvas'); cv.width = cv.height = MS;
  const chartCv = document.createElement('canvas'); chartCv.width = chartCv.height = 512;
  {
    const c2 = cv.getContext('2d')!;
    const hm = new Float32Array(MS * MS);
    for (let py = 0; py < MS; py++) for (let px = 0; px < MS; px++) hm[py * MS + px] = groundAt((px / MS - 0.5) * MW, (py / MS - 0.5) * MW);
    const img = c2.createImageData(MS, MS);
    const cl = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
    for (let py = 0; py < MS; py++) for (let px = 0; px < MS; px++) {
      const x = (px / MS - 0.5) * MW, z = (py / MS - 0.5) * MW, h = hm[py * MS + px];
      const hl = hm[py * MS + Math.max(0, px - 1)], hr = hm[py * MS + Math.min(MS - 1, px + 1)], hu = hm[Math.max(0, py - 1) * MS + px], hd = hm[Math.min(MS - 1, py + 1) * MS + px];
      const shade = cl(1 + ((hl - hr) * 0.9 + (hu - hd) * 0.9) * 0.016, 0.62, 1.42);
      let r: number, g: number, b: number;
      if (h < T.DEEP) { const k = cl((h + 9) / 8, 0, 1); r = 12 + k * 34; g = 56 + k * 96; b = 104 + k * 96; }
      else if (h < 2.4) { r = 226; g = 210; b = 152; }
      else if (T.badAt(x, z) > 0.35) { const pk = T.pinkAt(x, z) > 0.3; const band = Math.floor(h / 6) % 3; r = 190 + band * 10 + (pk ? 34 : 0); g = 116 + band * 8 - (pk ? 34 : 0); b = 74 + (pk ? 44 : 0); }
      else if (h > 220) { r = 242; g = 246; b = 250; }
      else if (h > 130) { r = 132; g = 130; b = 126; }
      else if (T.forestAt(x, z) > 0.3) { r = 36; g = 92; b = 44; }
      else if (h > 45) { r = 108; g = 142; b = 72; }
      else { r = 100; g = 156; b = 68; }
      if (h > 2.4 && T.riverDist(x, z) < 26) { r = 70; g = 150; b = 210; }
      // contour lines every 30 m on land
      if (h > 2.4 && (Math.floor(h / 30) !== Math.floor(hr / 30) || Math.floor(h / 30) !== Math.floor(hd / 30))) { r *= 0.86; g *= 0.86; b *= 0.86; }
      const i = (py * MS + px) * 4;
      img.data[i] = Math.min(255, r * shade); img.data[i + 1] = Math.min(255, g * shade); img.data[i + 2] = Math.min(255, b * shade); img.data[i + 3] = 255;
    }
    c2.putImageData(img, 0, 0);
    const tx = (x: number) => (x / MW + 0.5) * MS;
    c2.lineCap = 'round'; c2.lineJoin = 'round';
    c2.strokeStyle = 'rgba(70,160,226,0.95)'; c2.lineWidth = 2.2;
    for (const line of T.RIVER_LINES) { c2.beginPath(); line.forEach(([x, z], i) => (i ? c2.lineTo(tx(x), tx(z)) : c2.moveTo(tx(x), tx(z)))); c2.stroke(); }
    c2.strokeStyle = 'rgba(86,62,34,0.9)'; c2.lineWidth = 1.7;
    c2.beginPath(); for (const s of segs) { c2.moveTo(tx(s.x1), tx(s.z1)); c2.lineTo(tx(s.x2), tx(s.z2)); } c2.stroke();
    c2.strokeStyle = 'rgba(236,216,170,0.95)'; c2.lineWidth = 0.9;
    c2.beginPath(); for (const s of segs) { c2.moveTo(tx(s.x1), tx(s.z1)); c2.lineTo(tx(s.x2), tx(s.z2)); } c2.stroke();
  }
  {
    // rough island chart: parchment, ink coastline, nothing else
    const CS = 512, c3 = chartCv.getContext('2d')!, im = c3.createImageData(CS, CS);
    for (let py = 0; py < CS; py++) for (let px = 0; px < CS; px++) {
      const x = (px / CS - 0.5) * MW, z = (py / CS - 0.5) * MW, d = T.sdf(x, z);
      const land = T.sstep(-70, 70, d), ink = Math.exp(-Math.pow(d / 130, 2)), paper = 0.9 + T.fbm(x / 420, z / 420, 81) * 0.2;
      let r = 20 + (1 - land) * 4, g = 36 + (1 - land) * 6, b = 52 + (1 - land) * 8;
      if (land > 0) { const pr = 214 * paper, pg = 190 * paper, pb = 140 * paper; r = r * (1 - land) + pr * land; g = g * (1 - land) + pg * land; b = b * (1 - land) + pb * land; }
      const k = ink * (d > 0 ? 0.28 : 0.1);
      r -= r * k; g -= g * k; b -= b * k;
      if (Math.abs(d) < 34) { const e = 1 - Math.abs(d) / 34; r = r * (1 - e * 0.8) + 60 * e * 0.8; g = g * (1 - e * 0.8) + 40 * e * 0.8; b = b * (1 - e * 0.8) + 22 * e * 0.8; }
      const i = (py * CS + px) * 4; im.data[i] = r; im.data[i + 1] = g; im.data[i + 2] = b; im.data[i + 3] = 255;
    }
    c3.putImageData(im, 0, 0);
  }

  // ------------------------------------------------ rare sites (the only places chests exist) + gathering spots
  // Nothing lies around for free: chests only exist at hard-to-reach sites and are sealed until their guardians fall.
  const spotOk = (x: number, z: number, r = 2.5) => groundAt(x, z) > 1.6 && !blocked(x, z, r);
  const chestSpots: Spot[] = [], lootSpots: Spot[] = [], herbSpots: Spot[] = [];
  for (const s of secretSpots) chestSpots.push({ x: s.x, z: s.z, tier: s.tier });
  const bp = poi('bandits');
  for (let i = 0, g = 0; i < 14 && g < 600; g++) { const a = R() * 6.2832, d = 30 + R() * 260; const x = bp.x + Math.cos(a) * d, z = bp.z + Math.sin(a) * d; if (!spotOk(x, z) || T.forestAt(x, z) > 0.6) continue; herbSpots.push({ x, z, tier: 0 }); i++; }

  const ranges: { g: THREE.Group; cx: number; cz: number }[] = tileGroups;
  const world: GreedWorld = {
    name: 'Greed Island', group, obstacles, radius: MAP_R, mapCanvas: cv, chartCanvas: chartCv, secretSpots, mapW: MW, vegOn: true, near, blocked, chestSpots, lootSpots, herbSpots, groundAt,
    env: { sky: 0xc4dff3, fog: 0xc6e0f2, fogN: 900, fogF: 5200, hemiS: 0xcfe8ff, hemiG: 0x7a9a5a, hemiI: 2.0, sunC: 0xfff0d2, sunI: 2.8 },
    prime(x, z) { refocus(x, z); pump(9999); vegSig = ''; vegTick(x, z, 9999); for (const t of ranges) t.g.visible = Math.hypot(t.cx - x, t.cz - z) < 2600; },
    setFocus(x, z, range = 2800) {
      pool.t += 0.0001;
      if (lampX > 1e8 || Math.hypot(x - lampX, z - lampZ) > 12) { lampX = x; lampZ = z; assignLights(x, z); }
      sea2.position.set(Math.round(x / 64) * 64, T.SEA_Y, Math.round(z / 64) * 64); deepFloor.position.set(x, -14, z);
      // the dome rides with the camera target so the horizon never depends on where the player is standing
      sky.position.set(x, 320, z);
      refocus(x, z); pump(3); vegTick(x, z);
      for (const c of ranges) c.g.visible = Math.hypot(c.cx - x, c.cz - z) < range;
    },
    setBarrier,
    update(dt, time) {
      // a slow, per-lamp flicker keeps the pooled lights feeling like fireflies / gas lanterns rather than a flat wash
      for (let i = 0; i < pool.list.length; i++) {
        const p = pool.list[i];
        if (p.intensity <= 0) continue;
        const e = 0.92 + Math.sin(time * 5.1 + i * 2.3) * 0.05 + Math.sin(time * 13.7 + i) * 0.03;
        const k = e / (pool.last[i] ?? 1);
        p.intensity *= k * (p.intensity > 40 ? 0.995 : 1.0);
        pool.last[i] = e;
      }
      bmat.uniforms.time.value = time;
      cloudG.rotation.y += dt * 0.002;
      ntex.offset.set(time * 0.012, time * 0.008);
      for (const f of anim) f(time);
      (bring.material as THREE.MeshBasicMaterial).opacity = 0.7 + Math.sin(time * 3) * 0.2;
    },
    dispose() {
      group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !Object.values(GEO).includes(m.geometry) && !Object.values(VEG).includes(m.geometry)) m.geometry?.dispose(); });
      T.setGround(() => 0, null); T.setFlats([]); T.setRoadSegs([]);
    },
  };
  return world;
}

const VEG_MAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const TMP = new THREE.Color();
export type { Poi };
