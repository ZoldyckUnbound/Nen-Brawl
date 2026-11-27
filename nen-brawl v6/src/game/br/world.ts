import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { World, Obstacle } from '../world';
import { POIS, ROADS, MAP_R, poi, type Poi } from './data';
import { buildTown, type Ctx } from './towns';
import * as T from '../terrain';

export interface Spot { x: number; z: number; tier: number }
export interface GreedWorld extends World {
  mapCanvas: HTMLCanvasElement;
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
  const c = g.clone().toNonIndexed();
  c.deleteAttribute('uv');
  c.scale(sx, sy, sz); c.rotateX(rx); c.rotateZ(rz); c.translate(x, y, z);
  const n = c.attributes.position.count, col = new Float32Array(n * 3), cc = new THREE.Color(color);
  for (let i = 0; i < n; i++) { const k = 0.82 + 0.3 * (c.attributes.position.getY(i) / 14); col[i * 3] = cc.r * k; col[i * 3 + 1] = cc.g * k; col[i * 3 + 2] = cc.b * k; }
  c.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return c;
}
const IC = new THREE.IcosahedronGeometry(0.5, 0), CY6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6).translate(0, 0.5, 0), CO7 = new THREE.ConeGeometry(0.5, 1, 7).translate(0, 0.5, 0);
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
  bush: mk([part(IC, 0x3f8a3a, 0, 0.5, 0, 2.2, 1.5, 2.2), part(IC, 0x4a9a44, 0.7, 0.45, 0.4, 1.6, 1.2, 1.6), part(IC, 0xff6a8a, 0.4, 1.1, 0.5, 0.4, 0.4, 0.4)]),
  rock: mk([part(IC, 0x8a8a92, 0, 0.6, 0, 3.4, 2.4, 3.0), part(IC, 0x7a7a84, 1.4, 0.4, 0.8, 2.0, 1.4, 1.8)]),
  boulder: mk([part(IC, 0x9a948a, 0, 2, 0, 9, 6, 8), part(IC, 0x8a8478, 3.4, 1.2, 1.6, 5, 3.4, 4.6), part(IC, 0xa8a296, -2.8, 1.4, -1.4, 4.4, 3, 4)]),
  spire: mk([part(CY6, 0xb0663a, 0, 0, 0, 5, 7, 5), part(CY6, 0xc8844a, 0, 7, 0, 4, 5, 4), part(CY6, 0xa85a34, 0, 12, 0, 3.2, 6, 3.2), part(CY6, 0xd8a060, 0, 18, 0, 5.6, 1.6, 5.6), part(CO7, 0xb0663a, 0, 19.6, 0, 3, 2.4, 3)]),
};
const VEG_CAP: Record<string, number> = { oak: 9000, oak2: 7000, pine: 9000, snowpine: 3000, birch: 3000, jungle: 3000, palm: 1500, cactus: 3000, dead: 2000, bush: 5000, rock: 4000, boulder: 1500, spire: 1200 };
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
  T.setRoadSegs(segs);
  const groundAt = T.groundAt;
  T.setGround(groundAt, (x, z) => groundAt(x, z) < T.DEEP);

  // ------------------------------------------------ town instancing (chunked, distance-culled)
  interface Item { x: number; y: number; z: number; sx: number; sy: number; sz: number; ry: number; c: THREE.Color }
  const tchunks = new Map<string, { cx: number; cz: number; items: Record<string, Item[]> }>();
  const claimed: { x: number; z: number; r: number }[] = [];
  let curGy = 0;
  const indoorSpots: { x: number; z: number }[] = [];
  const anim: ((t: number) => void)[] = [];
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
    add: addItem, circle: (x, z, r, h) => addOb(x, z, r, h), group: tgroup, anim, R, gy: 0,
    indoor: (x, z) => indoorSpots.push({ x, z }),
    claim: (x, z, r) => { if (claimed.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + r)) return false; claimed.push({ x, z, r }); return true; },
    tree: (x, z, s, kind) => { addItem(kind === 1 ? 'pineT' : 'oakT', x, 0, z, s, s, s, R() * 6, 0xffffff); addOb(x, z, 0.9 * s, 8 * s); },
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
  // town ground slabs sink under their own plateau (items y already includes gy)

  // flatten emissive layers into InstancedMeshes per tile
  const tileGroups: { g: THREE.Group; cx: number; cz: number }[] = [];
  const dummy = new THREE.Object3D();
  const instKey = (k: string) => (k.endsWith('E') ? k.slice(0, -1) : k);
  for (const ch of tchunks.values()) {
    const g = new THREE.Group();
    for (const [layer, items] of Object.entries(ch.items)) {
      let base = instKey(layer);
      let geo = GEO[base];
      let mat: THREE.Material = layer.endsWith('E') ? MAT_E : MAT_L;
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
  function genChunk(kx: number, kz: number): CD {
    const key = kx + ',' + kz;
    let cd = cdata.get(key);
    if (cd) return cd;
    cd = { veg: {} }; cdata.set(key, cd);
    const r = rng(kx * 73856093 ^ kz * 19349663 ^ 777);
    const sp = 11;
    const push = (t: string, x: number, h: number, z: number, s: number, rad: number, oh: number) => {
      (cd!.veg[t] ??= []).push(x, h, z, r() * 6.28, s, 0.85 + r() * 0.3);
      if (rad > 0) addOb(x, z, rad * s, oh * s);
    };
    for (let j = 0; j < NEAR / sp; j++) for (let i = 0; i < NEAR / sp; i++) {
      const x = kx * NEAR + (i + 0.1 + r() * 0.8) * sp, z = kz * NEAR + (j + 0.1 + r() * 0.8) * sp;
      const q = r();
      const h = groundAt(x, z);
      if (h < 0.9 || T.sdf(x, z) < -50) continue;
      if (inTown(x, z)) continue;
      if (T.roadDist(x, z) < 6 || T.riverDist(x, z) < 22) continue;
      const hy = h - 0.15;
      const slope = Math.abs(groundAt(x + 2, z) - h) / 2 + Math.abs(groundAt(x, z + 2) - h) / 2;
      const f = T.forestAt(x, z), bd = T.badAt(x, z), warm = T.warmth(z);
      if (bd > 0.35) {
        if (q < 0.05 * bd) push('cactus', x, hy, z, 0.8 + r() * 0.8, 0.7, 5);
        else if (q < 0.075 * bd) push('dead', x, hy, z, 0.8 + r() * 0.7, 0.4, 5);
        else if (q < 0.095 * bd && slope < 0.6) push('spire', x, hy, z, 0.6 + r() * 1.3, 2.4, 20);
        else if (q < 0.2 * bd) push('rock', x, hy, z, 0.7 + r() * 1.6, 1.4, 2.4);
        else if (q < 0.215 * bd) push('boulder', x, hy, z, 0.6 + r() * 0.8, 4, 6);
        continue;
      }
      if (h < 3.4) { if (q < 0.07) push('palm', x, hy, z, 0.9 + r() * 0.5, 0.5, 7); continue; }
      if (slope > 0.85) { if (q < 0.25) push('boulder', x, hy, z, 0.6 + r() * 0.9, 4, 6); continue; }
      if (h > 215) { if (q < 0.1) push('rock', x, hy, z, 0.8 + r() * 1.8, 1.4, 2.4); continue; }
      if (f > 0.12 && q < f * 0.95) {
        const k = r();
        if (h > 140) push('snowpine', x, hy, z, 0.9 + r() * 0.9, 0.8, 9);
        else if (warm < 0.45 || h > 70) push(k < 0.8 ? 'pine' : 'birch', x, hy, z, 0.9 + r() * 0.9, 0.8, 9);
        else if (warm > 0.8 && k < 0.35) push('jungle', x, hy, z, 0.9 + r() * 0.7, 1.1, 14);
        else push(k < 0.45 ? 'oak' : k < 0.8 ? 'oak2' : 'birch', x, hy, z, 0.9 + r() * 0.9, 0.9, 8);
      } else if (q > 0.93 - f * 0.1) {
        const k = r();
        if (k < 0.5) push('bush', x, hy, z, 0.7 + r() * 0.7, 0, 0);
        else if (k < 0.8) push(h > 90 ? 'pine' : 'oak', x, hy, z, 0.9 + r() * 0.7, 0.9, 8);
        else push('rock', x, hy, z, 0.6 + r() * 1.2, 1.4, 2.4);
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
        const m = makeTerrain(q.kx * NEAR, q.kz * NEAR, NEAR, NSEG, 0); terrainGroup.add(m); nearMeshes.set(q.kx + ',' + q.kz, m);
      } else {
        const m = makeTerrain(q.kx * FAR, q.kz * FAR, FAR, FSEG, -4); m.visible = Math.hypot((q.kx + 0.5) * FAR - fx, (q.kz + 0.5) * FAR - fz) > 3 * NEAR + 520; terrainGroup.add(m); farMeshes.set(q.kx + ',' + q.kz, m);
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

  // ------------------------------------------------ sky, clouds, barrier
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x2f7fe0) }, hor: { value: new THREE.Color(0xcfe6f6) }, sun: { value: new THREE.Vector3(0.45, 0.55, 0.35).normalize() } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 sun; varying vec3 vD; void main(){ vec3 d = normalize(vD); float h = clamp(d.y*1.25+0.03,0.,1.); vec3 c = mix(hor, top, pow(h,0.5)); float s = max(dot(d,sun),0.); c += vec3(1.0,0.86,0.6)*pow(s,900.)*3.0 + vec3(1.0,0.8,0.5)*pow(s,10.)*0.18; c = mix(c, hor, smoothstep(0.0,-0.25,d.y)); gl_FragColor = vec4(c,1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 24, 16), skyMat);
  sky.renderOrder = -10; sky.frustumCulled = false; group.add(sky);
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

  // ------------------------------------------------ minimap / world map
  const MS = 512, MW = T.WORLD_W;
  const cv = document.createElement('canvas'); cv.width = cv.height = MS;
  {
    const c2 = cv.getContext('2d')!;
    const hm = new Float32Array(MS * MS);
    for (let py = 0; py < MS; py++) for (let px = 0; px < MS; px++) hm[py * MS + px] = groundAt((px / MS - 0.5) * MW, (py / MS - 0.5) * MW);
    const img = c2.createImageData(MS, MS);
    for (let py = 0; py < MS; py++) for (let px = 0; px < MS; px++) {
      const x = (px / MS - 0.5) * MW, z = (py / MS - 0.5) * MW, h = hm[py * MS + px];
      const hl = hm[py * MS + Math.max(0, px - 1)], hr = hm[py * MS + Math.min(MS - 1, px + 1)], hu = hm[Math.max(0, py - 1) * MS + px], hd = hm[Math.min(MS - 1, py + 1) * MS + px];
      const shade = Math.max(0.55, Math.min(1.35, 1 + ((hl - hr) * 0.9 + (hu - hd) * 0.9) * 0.012));
      let r: number, g: number, b: number;
      if (h < T.DEEP) { const k = Math.max(0, Math.min(1, (h + 9) / 8)); r = 14 + k * 30; g = 60 + k * 90; b = 110 + k * 90; }
      else if (h < 2.4) { r = 224; g = 208; b = 150; }
      else if (T.badAt(x, z) > 0.35) { r = 196 + (T.pinkAt(x, z) > 0.3 ? 30 : 0); g = 122 - (T.pinkAt(x, z) > 0.3 ? 30 : 0); b = 76 + (T.pinkAt(x, z) > 0.3 ? 40 : 0); }
      else if (h > 220) { r = 240; g = 244; b = 248; }
      else if (h > 130) { r = 128; g = 126; b = 122; }
      else if (T.forestAt(x, z) > 0.3) { r = 40; g = 96; b = 46; }
      else if (h > 45) { r = 106; g = 140; b = 70; }
      else { r = 98; g = 154; b = 66; }
      const i = (py * MS + px) * 4;
      img.data[i] = Math.min(255, r * shade); img.data[i + 1] = Math.min(255, g * shade); img.data[i + 2] = Math.min(255, b * shade); img.data[i + 3] = 255;
    }
    c2.putImageData(img, 0, 0);
    const tx = (x: number) => (x / MW + 0.5) * MS;
    c2.lineCap = 'round'; c2.lineJoin = 'round';
    c2.strokeStyle = 'rgba(58,160,224,0.95)'; c2.lineWidth = 2;
    for (const line of T.RIVER_LINES) { c2.beginPath(); line.forEach(([x, z], i) => (i ? c2.lineTo(tx(x), tx(z)) : c2.moveTo(tx(x), tx(z)))); c2.stroke(); }
    c2.strokeStyle = 'rgba(214,194,152,0.95)'; c2.lineWidth = 1.4;
    c2.beginPath(); for (const s of segs) { c2.moveTo(tx(s.x1), tx(s.z1)); c2.lineTo(tx(s.x2), tx(s.z2)); } c2.stroke();
    for (const p of POIS) { c2.fillStyle = 'rgba(30,20,10,.55)'; c2.beginPath(); c2.arc(tx(p.x), tx(p.z), Math.max(2, (p.r / MW) * MS * 0.7), 0, 6.2832); c2.fill(); }
  }

  // ------------------------------------------------ spots
  const chestSpots: Spot[] = [], lootSpots: Spot[] = [], herbSpots: Spot[] = [];
  const spotOk = (x: number, z: number, r = 2.5) => groundAt(x, z) > 1.6 && !blocked(x, z, r);
  for (const p of POIS) {
    const n = 4 + p.tier * 3 + (p.id === 'limeiro' ? 8 : 0);
    let c = 0, g = 0;
    while (c < n && g++ < 300) { const a = R() * 6.2832, d = 8 + R() * (p.r * 0.85); const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; if (!spotOk(x, z)) continue; chestSpots.push({ x, z, tier: p.tier }); c++; }
    const m = 6 + p.tier * 4; c = 0; g = 0;
    while (c < m && g++ < 300) { const a = R() * 6.2832, d = 6 + R() * (p.r + 20); const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; if (!spotOk(x, z, 1.5)) continue; lootSpots.push({ x, z, tier: Math.max(0, p.tier - (R() < 0.5 ? 1 : 0)) }); c++; }
  }
  for (const s of indoorSpots) if (spotOk(s.x, s.z, 1.2) || true) chestSpots.push({ x: s.x, z: s.z, tier: 2 });
  for (let i = 0, g = 0; i < 230 && g < 4000; g++) {
    const x = (R() * 2 - 1) * 6400, z = (R() * 2 - 1) * 6900;
    if (!spotOk(x, z) || inTown(x, z)) continue;
    const t = T.badAt(x, z) > 0.4 || groundAt(x, z) > 90 ? 1 : 0;
    (i % 3 === 0 ? chestSpots : lootSpots).push({ x, z, tier: t }); i++;
  }
  const bp = poi('bandits');
  for (let i = 0, g = 0; i < 12 && g < 400; g++) { const a = R() * 6.2832, d = 20 + R() * 220; const x = bp.x + Math.cos(a) * d, z = bp.z + Math.sin(a) * d; if (!spotOk(x, z)) continue; herbSpots.push({ x, z, tier: 0 }); i++; }

  const ranges: { g: THREE.Group; cx: number; cz: number }[] = tileGroups;
  const world: GreedWorld = {
    name: 'Greed Island', group, obstacles, radius: MAP_R, mapCanvas: cv, mapW: MW, vegOn: true, near, blocked, chestSpots, lootSpots, herbSpots, groundAt,
    env: { sky: 0xc4dff3, fog: 0xc6e0f2, fogN: 260, fogF: 4400, hemiS: 0xcfe8ff, hemiG: 0x7a9a5a, hemiI: 2.0, sunC: 0xfff0d2, sunI: 2.8 },
    prime(x, z) { refocus(x, z); pump(9999); vegSig = ''; vegTick(x, z, 9999); for (const t of ranges) t.g.visible = Math.hypot(t.cx - x, t.cz - z) < 2600; },
    setFocus(x, z, range = 2800) {
      sky.position.set(x, 0, z);
      sea2.position.set(Math.round(x / 64) * 64, T.SEA_Y, Math.round(z / 64) * 64); deepFloor.position.set(x, -14, z);
      refocus(x, z); pump(3); vegTick(x, z);
      for (const c of ranges) c.g.visible = Math.hypot(c.cx - x, c.cz - z) < range;
    },
    setBarrier,
    update(dt, time) {
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
