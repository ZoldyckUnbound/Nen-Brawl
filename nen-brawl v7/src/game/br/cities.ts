/**
 * City planner for Greed Island.
 *
 * Every major town is laid out like a real settlement instead of scattered houses:
 *   plaza  →  radial boulevards  →  ring roads  →  frontage lots facing the streets  →  second rows  →  infill / parks / outskirts
 * Districts shift from tall civic buildings in the core to cottages and gardens at the edge. Each town style then adds
 * its own landmarks, wall, lighting and magic so the cities of the 2011 anime (Antokiba's tournament city, Masadora's
 * wizard spires, Limeiro's royal capital, Aiai's city of love, Dorias' neon casinos, Soufrabi's port) read at a glance.
 */
import * as THREE from 'three';
import type { Poi } from './data';
import {
  Loc, type Ctx, type Pal, PALS, cottage, timber, townhouse, shop, inn, clockTower, church, dome, wizardTower, windmill, barn, farmField, pier, ship,
  castleKeep, casino, cityWall, heartSculpture, fountain, lamp, crate, barrel, banner, bench, gardenPlot, lighthouse, hut,
} from './towns';

const TAU = Math.PI * 2;
type Bld = { f: (x: number, z: number, ry: number) => void; rad: number };

interface Style {
  pal: Pal; spokes: number; rot: number; plazaR: number; rings: number[]; roadW: number; roadCol: number; plazaCol: number; cobble: number;
  core: Bld[]; mid: Bld[]; outer: Bld[]; lampCol: number; second: number;
}

const pickR = <T,>(C: Ctx, a: T[]) => a[Math.floor(C.R() * a.length)];

/** straight paved strip between two points */
function strip(C: Ctx, x1: number, z1: number, x2: number, z2: number, w: number, col: number, y = 0.06) {
  const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz);
  if (L < 0.5) return;
  const ry = Math.atan2(dx, dz);
  C.add('box', (x1 + x2) / 2, y, (z1 + z2) / 2, w + 1.4, 0.12, L + 0.6, ry, 0x5e5a50);   // curb
  C.add('box', (x1 + x2) / 2, y + 0.07, (z1 + z2) / 2, w, 0.12, L + 0.6, ry, col);       // paving
}

function stall(C: Ctx, x: number, z: number, ry: number) {
  const b = new Loc(C, x, z, ry);
  const col = pickR(C, [0xd23a3a, 0x3a6ad2, 0x3aa86a, 0xd2a33a, 0x8a3ad2]);
  b.box(0, 0, 0, 4.2, 1.0, 1.6, 0x7a5632);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sx * 2, 0, sz * 1.2, 0.18, 2.9, 0.18, 0x4a3a2a);
  for (let i = 0; i < 7; i++) b.box(-2.1 + i * 0.7, 2.7 - i * 0.02, 0.1, 0.7, 0.12, 3.0, i % 2 ? 0xf4f0e6 : col);
  for (let i = 0; i < 4; i++) b.sph(-1.5 + i, 1.2, 0, 0.5, 0.5, 0.5, pickR(C, [0xff5a5a, 0xffc23a, 0x7ad65a, 0xff9a3a]));
  C.circle(x, z, 2.2, 3);
}
function park(C: Ctx, x: number, z: number, r: number, pond = true) {
  const l = new Loc(C, x, z, 0);
  l.cyl(0, 0, 0, r * 2, 0.1, r * 2, 0x5aa04a);
  l.cyl(0, 0.1, 0, r * 1.2, 0.08, r * 1.2, 0x6ab45a);
  if (pond) { l.cyl(0, 0.1, 0, r * 0.7, 0.1, r * 0.7, 0x3a90c8, 0.4); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; l.sph(Math.cos(a) * r * 0.36, 0.1, Math.sin(a) * r * 0.36, 0.7, 0.4, 0.7, 0x5a7a4a); } C.circle(x, z, r * 0.34, 0.4); }
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + 0.3, d = r * (0.62 + C.R() * 0.28); C.tree(x + Math.cos(a) * d, z + Math.sin(a) * d, 0.9 + C.R() * 0.6, 0); }
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.8; bench(C, x + Math.cos(a) * r * 0.5, z + Math.sin(a) * r * 0.5, a + Math.PI / 2); }
}
function floatingLantern(C: Ctx, x: number, z: number, y: number, col: number) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(2.2) }));
  const ph = C.R() * 6;
  m.position.set(x, C.gy + y, z); C.group.add(m);
  C.anim.push((t) => { m.position.y = C.gy + y + Math.sin(t * 1.3 + ph) * 0.8; m.rotation.y = t * 0.8 + ph; });
}
function colosseum(C: Ctx, x: number, z: number) {
  const t = new Loc(C, x, z, 0);
  C.claim(x, z, 66);
  t.cyl(0, 0, 0, 96, 0.5, 96, 0xcfc29e); t.cyl(0, 0.5, 0, 78, 0.14, 78, 0xd8c08a); t.cyl(0, 0.64, 0, 30, 0.1, 30, 0xb8a070);
  for (let tier = 0; tier < 3; tier++) for (let i = 0; i < 44; i++) {
    const a = (i / 44) * TAU, r = 42 + tier * 3.2, h = 7 + tier * 6;
    t.cyl(Math.cos(a) * r, 0, Math.sin(a) * r, 4.4, h, 4.4, tier === 1 ? 0xd4c8a8 : 0xe0d4b8);
    t.add('box', Math.cos(a) * r, h, Math.sin(a) * r, 5.4, 1.2, 5.4, a, 0xc8bca0);
    const [wx, wz] = t.w(Math.cos(a) * r, Math.sin(a) * r);
    if (tier === 0 && !(i > 9 && i < 13)) C.circle(wx, wz, 2.6, 18);
  }
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + 0.4; banner(C, ...t.w(Math.cos(a) * 46, Math.sin(a) * 46), pickR(C, [0xd23a3a, 0xffd24a, 0x3a6ad2]), 28); }
}

// ---------------------------------------------------------------- the planner
function plan(C: Ctx, p: Poi, S: Style, R: number) {
  const L = new Loc(C, p.x, p.z, 0);
  C.claim(p.x, p.z, S.plazaR + 6);
  // cobbled core + plaza inlay
  L.cyl(0, 0, 0, R * S.cobble * 2, 0.08, R * S.cobble * 2, 0xc6bca6);
  L.cyl(0, 0.08, 0, S.plazaR * 2.1, 0.14, S.plazaR * 2.1, S.plazaCol);
  L.cyl(0, 0.2, 0, S.plazaR * 1.5, 0.1, S.plazaR * 1.5, S.plazaCol === 0xb4ae9e ? 0xc8c2b0 : S.plazaCol + 0x101010);
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; L.add('box', Math.cos(a) * S.plazaR * 0.78, 0.26, Math.sin(a) * S.plazaR * 0.78, 1.6, 0.06, S.plazaR * 0.5, S.rot + a, i % 2 ? 0x8f8878 : 0xd8d0bc); }
  const lots = (fn: Bld[]) => pickR(C, fn);
  const zoneOf = (x: number, z: number) => Math.min(1, Math.hypot(x - p.x, z - p.z) / R);
  const tryLot = (x: number, z: number, ry: number) => {
    const zn = zoneOf(x, z), b = zn < 0.34 ? lots(S.core) : zn < 0.7 ? lots(S.mid) : lots(S.outer);
    if (zn > 0.97 || !C.claim(x, z, b.rad)) return false;
    b.f(x, z, ry); return true;
  };
  const faceStreet = (nx: number, nz: number, side: number) => Math.atan2(-side * nx, -side * nz);
  // radial boulevards
  const dirs: [number, number][] = [];
  for (let i = 0; i < S.spokes; i++) {
    const a = S.rot + (i / S.spokes) * TAU, dx = Math.cos(a), dz = Math.sin(a), nx = -dz, nz = dx;
    dirs.push([dx, dz]);
    const t0 = S.plazaR + 4, t1 = R * 0.97;
    strip(C, p.x + dx * t0, p.z + dz * t0, p.x + dx * t1, p.z + dz * t1, S.roadW, S.roadCol);
    for (let t = t0 + 10; t < t1; t += 22) { for (const s of [-1, 1]) lamp(C, p.x + dx * t + nx * s * (S.roadW / 2 + 1.4), p.z + dz * t + nz * s * (S.roadW / 2 + 1.4), S.lampCol); }
    for (let t = t0 + 14; t < t1 - 8; t += 12 + C.R() * 6) for (const s of [-1, 1]) {
      const off = S.roadW / 2 + 3.2 + 8;
      tryLot(p.x + dx * t + nx * s * off, p.z + dz * t + nz * s * off, faceStreet(nx, nz, s));
    }
  }
  // ring roads
  for (const fr of S.rings) {
    const rr = R * fr, n = Math.max(24, Math.round((TAU * rr) / 26));
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU;
      strip(C, p.x + Math.cos(a0) * rr, p.z + Math.sin(a0) * rr, p.x + Math.cos(a1) * rr, p.z + Math.sin(a1) * rr, S.roadW - 1.5, S.roadCol);
    }
    const stepA = 13 / rr;
    for (let a = C.R() * stepA; a < TAU; a += stepA * (0.95 + C.R() * 0.4)) {
      const nx = Math.cos(a), nz = Math.sin(a);
      for (const s of [-1, 1]) { const off = rr + s * (S.roadW / 2 + 3 + 8); tryLot(p.x + nx * off, p.z + nz * off, faceStreet(nx, nz, s)); }
      if (Math.floor(a / stepA) % 3 === 0) lamp(C, p.x + nx * (rr + S.roadW / 2 + 1.2), p.z + nz * (rr + S.roadW / 2 + 1.2), S.lampCol);
    }
  }
  // second rows, parks and infill
  const nPark = 3 + Math.floor(R / 150);
  for (let i = 0, g = 0; i < nPark && g < 80; g++) {
    const a = C.R() * TAU, d = R * (0.3 + C.R() * 0.5), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
    if (C.claim(x, z, 24)) { park(C, x, z, 20, C.R() < 0.6); i++; }
  }
  const nInfill = Math.round(R * S.second * 3.4);
  for (let k = 0, g = 0; k < nInfill && g < nInfill * 16; g++) {
    const a = C.R() * TAU, d = S.plazaR + 16 + Math.sqrt(C.R()) * (R * 0.94 - S.plazaR - 16), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
    const zn = zoneOf(x, z), b = zn < 0.4 ? lots(S.mid) : lots(S.outer);
    if (!C.claim(x, z, b.rad)) continue;
    b.f(x, z, Math.atan2(p.x - x, p.z - z) + (C.R() < 0.5 ? 0 : Math.PI / 2) + (C.R() - 0.5) * 0.4); k++;
  }
  // street dressing: trees, barrels, crates, planters
  for (let i = 0, g = 0; i < R * 0.5 && g < R * 8; g++) {
    const a = C.R() * TAU, d = S.plazaR + 8 + C.R() * (R * 0.9 - S.plazaR), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
    if (!C.claim(x, z, 2.4)) continue;
    const q = C.R();
    if (q < 0.5) C.tree(x, z, 0.9 + C.R() * 0.7, C.R() < 0.4 ? 1 : 0); else if (q < 0.7) barrel(C, x, z); else if (q < 0.9) crate(C, x, z, 0.8 + C.R() * 0.5); else bench(C, x, z, C.R() * TAU);
    i++;
  }
  // market stalls around the plaza
  for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU + 0.12, d = S.plazaR * 0.95; if (C.claim(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, 3)) stall(C, p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, a + Math.PI / 2); }
}

// ---------------------------------------------------------------- per style
export function buildCity(C: Ctx, p: Poi): boolean {
  const pal = PALS[p.style] ?? PALS.village;
  const cot = (rad = 8): Bld => ({ f: (x, z, ry) => cottage(C, x, z, ry, pal, 0.9 + C.R() * 0.3), rad });
  const tim = (rad = 10): Bld => ({ f: (x, z, ry) => timber(C, x, z, ry, pal, 2 + Math.floor(C.R() * 2)), rad });
  const twn = (rad = 8.4): Bld => ({ f: (x, z, ry) => townhouse(C, x, z, ry, pal), rad });
  const shp = (rad = 9): Bld => ({ f: (x, z, ry) => shop(C, x, z, ry, pal), rad });
  const inx = (rad = 12): Bld => ({ f: (x, z, ry) => inn(C, x, z, ry, pal), rad });
  const R = p.r;
  const base: Omit<Style, 'core' | 'mid' | 'outer'> = { pal, spokes: 8, rot: 0.2, plazaR: 38, rings: [0.36, 0.68], roadW: 9, roadCol: 0x8a8272, plazaCol: 0xb4ae9e, cobble: 0.8, lampCol: 0xffe29a, second: 1.1 };
  const L = new Loc(C, p.x, p.z, 0);
  switch (p.style) {
    case 'market': { // Antokiba – city of prizes: tournament colosseum, clock tower, grand market
      plan(C, p, { ...base, spokes: 8, plazaR: 44, core: [twn(), shp(), shp(), inx(), twn()], mid: [tim(), twn(), shp(), cot(), tim()], outer: [cot(), cot(), tim(), cot()] }, R);
      fountain(C, p.x, p.z, 7);
      colosseum(C, p.x, p.z - R * 0.62);
      strip(C, p.x, p.z - 44, p.x, p.z - R * 0.62 + 50, 14, 0xb8a888);
      const civ: [(x: number, z: number, ry: number) => void, number][] = [[(x, z, ry) => clockTower(C, x, z, ry, 36), 14], [(x, z, ry) => church(C, x, z, ry, 0.9), 22], [(x, z, ry) => dome(C, x, z, ry, 0xe8d8b0, 0xc2603f, 12), 18], [(x, z, ry) => inn(C, x, z, ry, pal), 14]];
      civ.forEach(([fn, rad], i) => { const a = (i / 4) * TAU + 0.78, d = 76; const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; if (C.claim(x, z, rad + 4)) fn(x, z, Math.atan2(p.x - x, p.z - z)); });
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; banner(C, p.x + Math.cos(a) * 52, p.z + Math.sin(a) * 52, [0xd23a3a, 0xffd24a, 0x3a6ad2][i % 3], 12); }
      return true;
    }
    case 'village': { // Rubicuta – farming town ringed by fields, windmills and barns
      plan(C, p, { ...base, spokes: 5, plazaR: 28, rings: [0.5], roadW: 7, plazaCol: 0xb8a888, cobble: 0.5, lampCol: 0xffd890, second: 0.9, core: [inx(), cot(), shp(), cot()], mid: [cot(), cot(), tim(), barn2(C)], outer: [cot(), barn2(C), cot()] }, R);
      fountain(C, p.x, p.z, 4, 0x7ad0ff);
      for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.4, x = p.x + Math.cos(a) * R * 0.6, z = p.z + Math.sin(a) * R * 0.6; if (C.claim(x, z, 14)) windmill(C, x, z, a); }
      for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + 0.15, d = R + 40 + (i % 2) * 40; const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; if (C.claim(x, z, 24)) farmField(C, x, z, a + Math.PI / 2, 34 + C.R() * 16, 24 + C.R() * 14); }
      return true;
    }
    case 'magic': { // Masadora – wizard spires, domes, arcane inlay, floating lanterns, the only Spell Card Shop
      const wt = (h: number, rad = 11): Bld => ({ f: (x, z, ry) => wizardTower(C, x, z, ry, h + C.R() * 14, pickR(C, [0x7a5ac8, 0x6a4ab8, 0x8a6ad8]), pickR(C, [0xb58cff, 0x6ad0ff, 0xff8ae8])), rad });
      const dm = (r: number): Bld => ({ f: (x, z, ry) => dome(C, x, z, ry, 0xd8c8f0, 0x7a4ac8, r), rad: r * 1.4 });
      plan(C, p, { ...base, spokes: 7, rot: 0.5, plazaR: 46, roadCol: 0xa89ccc, plazaCol: 0xa89ccc, lampCol: 0xc8a8ff, core: [wt(22), dm(7), twn(), wt(30, 12)], mid: [wt(14), twn(), tim(), dm(6), cot()], outer: [cot(), tim(), wt(10), cot()], second: 1.0 }, R);
      L.cyl(0, 0, 0, 22, 1.4, 22, 0x8a7ab8); L.cyl(0, 1.4, 0, 15, 0.4, 15, 0xd8c8f0); L.cyl(0, 1.8, 0, 3, 18, 3, 0x7a5ac8); L.sph(0, 19.6, 0, 3, 3, 3, 0xb58cff, 2.6);
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xd8b8ff).multiplyScalar(2.2) })); orb.position.set(p.x, C.gy + 27, p.z); C.group.add(orb);
      C.anim.push((t) => { orb.rotation.y = t; orb.position.y = C.gy + 27 + Math.sin(t * 1.5) * 1.6; });
      C.circle(p.x, p.z, 2.4, 18);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; const x = p.x + Math.cos(a) * 32, z = p.z + Math.sin(a) * 32; const o = new Loc(C, x, z, a); o.box(0, 0, 0, 1.4, 8 + (i % 3) * 2.4, 1.4, 0x6a5aa8); o.box(0, 8 + (i % 3) * 2.4, 0, 0.9, 1.8, 0.9, 0xb58cff, 2); C.circle(x, z, 1, 10); }
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; L.add('box', Math.cos(a) * 24, 1.62, Math.sin(a) * 24, 0.6, 0.06, 30, a + 1.57, 0xb58cff, 1.6); }
      for (let i = 0; i < 46; i++) { const a = C.R() * TAU, d = 20 + C.R() * (R * 0.85); floatingLantern(C, p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, 6 + C.R() * 16, pickR(C, [0xb58cff, 0x6ad0ff, 0xff8ae8, 0xffd24a])); }
      return true;
    }
    case 'castle': { // Limeiro – walled royal capital under the keep
      const keepZ = p.z - R * 0.56;
      C.claim(p.x, keepZ, 80); castleKeep(C, p.x, keepZ, 0);
      const bs: Style = { ...base, spokes: 8, plazaR: 42, rot: Math.PI / 8, rings: [0.38, 0.7], roadW: 10, roadCol: 0xb4ac98, plazaCol: 0xc4bca8, lampCol: 0xffe8a8, core: [twn(), shp(), inx(), twn(), twn()], mid: [tim(), twn(), shp(), tim()], outer: [cot(), tim(), cot()], second: 1.0 };
      plan(C, { ...p, z: p.z + 28 } as Poi, bs, R * 0.9);
      cityWall(C, p.x, p.z, R * 1.08, 24, [1, 7, 13, 19], 20); // gates sit on four of the eight boulevards
      fountain(C, p.x, p.z + 28, 8);
      strip(C, p.x, keepZ + 60, p.x, p.z - 18, 16, 0xc8c0a8);
      for (let i = 0; i < 14; i++) banner(C, p.x + (i % 2 ? 11 : -11), keepZ + 70 + i * 14, [0x2a52a8, 0xffd24a][i % 2], 14);
      const civ: [(x: number, z: number, ry: number) => void, number][] = [[(x, z, ry) => church(C, x, z, ry, 1.1), 26], [(x, z, ry) => clockTower(C, x, z, ry, 42), 15], [(x, z, ry) => dome(C, x, z, ry, 0xe4dcc8, 0x2a52a8, 13), 20], [(x, z, ry) => inn(C, x, z, ry, PALS.market), 14]];
      civ.forEach(([fn, rad], i) => { const a = (i / 4) * TAU + 0.8, d = 108; const x = p.x + Math.cos(a) * d, z = p.z + 28 + Math.sin(a) * d; if (Math.hypot(x - p.x, z - keepZ) > 96 && C.claim(x, z, rad + 4)) fn(x, z, Math.atan2(p.x - x, p.z + 28 - z)); });
      return true;
    }
    case 'love': { // Aiai – city of love: pastel streets, heart plaza, rose gardens
      plan(C, p, { ...base, spokes: 6, rot: 0.5, plazaR: 40, plazaCol: 0xf2c4d6, roadCol: 0xf0cadc, lampCol: 0xff8ac8, rings: [0.4, 0.7], core: [twn(), shp(), cot(), { f: (x, z, ry) => dome(C, x, z, ry, 0xffe0ec, 0xff5aa8, 8), rad: 12 }], mid: [cot(), twn(), tim(), shp()], outer: [cot(), cot(), tim()], second: 1.0 }, R);
      heartSculpture(C, p.x, p.z, 1.3);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.3, x = p.x + Math.cos(a) * R * 0.52, z = p.z + Math.sin(a) * R * 0.52; if (C.claim(x, z, 10)) gardenPlot(C, x, z, a); }
      for (let i = 0; i < 40; i++) { const a = C.R() * TAU, d = 20 + C.R() * R * 0.85; floatingLantern(C, p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, 5 + C.R() * 12, pickR(C, [0xff8ac8, 0xffb0d8, 0xffe0ec])); }
      return true;
    }
    case 'casino': { // Dorias – neon strip with the grand casino
      const neon = (rad = 9): Bld => ({ f: (x, z, ry) => { townhouse(C, x, z, ry, PALS.casino ?? pal); const n = new Loc(C, x, z, ry); n.box(0, 11, 5.6, 5.4, 0.5, 0.3, pickR(C, [0xff4fd8, 0x3af0ff, 0xffe14a]), 2.6); }, rad });
      const cas = (): Bld => ({ f: (x, z, ry) => casino(C, x, z, ry, pickR(C, [0x2a1a58, 0x581a3a, 0x1a3a58])), rad: 26 });
      plan(C, p, { ...base, spokes: 7, rot: 0.3, plazaR: 44, plazaCol: 0x3a244a, roadCol: 0x2f2440, lampCol: 0xff4fd8, core: [neon(), neon(), cas(), shp()], mid: [neon(), cas(), twn(), neon()], outer: [twn(), cot(), neon()], second: 1.0 }, R);
      L.cyl(0, 0.3, 0, 90, 0.14, 90, 0x2a1a3a); for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; L.disc(Math.cos(a) * 30, Math.sin(a) * 30, 1.2, 0xff4fd8, 0.4); L.sph(Math.cos(a) * 40, 0.3, Math.sin(a) * 40, 1.1, 1.1, 1.1, [0xff4fd8, 0x3af0ff, 0xffe14a][i % 3], 2.2); }
      casino(C, p.x, p.z - 60, Math.PI, 0x4a1a6a); C.claim(p.x, p.z - 60, 48);
      for (let i = 0; i < 6; i++) { const a = i * 1.04 + 0.5; wizardTower(C, p.x + Math.cos(a) * 80, p.z + Math.sin(a) * 80, a, 30, 0x3a2a68, 0xff4fd8); }
      for (let i = 0; i < 50; i++) { const a = C.R() * TAU, d = 20 + C.R() * R * 0.85; floatingLantern(C, p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, 4 + C.R() * 10, pickR(C, [0xff4fd8, 0x3af0ff, 0xffe14a])); }
      return true;
    }
    case 'port': case 'port2': { // Soufrabi / Greed Island Port – dockside cities facing the sea
      const sd = C.sea, ang = sd.ang;
      const big = p.style === 'port';
      plan(C, p, { ...base, spokes: big ? 7 : 5, rot: ang + Math.PI, plazaR: big ? 40 : 30, plazaCol: 0xb4aa94, roadCol: 0xa89e88, lampCol: 0xffe0a0, rings: big ? [0.4, 0.72] : [0.5], core: [twn(), shp(), inx(), twn()], mid: [tim(), twn(), shp(), cot()], outer: [cot(), tim(), cot()], second: big ? 1.0 : 0.8 }, R);
      const d0 = Math.max(120, sd.dist - 40);
      const S0 = new Loc(C, p.x + Math.sin(ang) * d0, p.z + Math.cos(ang) * d0, ang);
      const np = big ? 3 : 2;
      for (let i = -np; i <= np; i++) { const [px, pz] = S0.w(i * 55, 0); pier(C, px, pz, ang, big ? 100 : 80, 7); }
      for (let i = -np; i <= np; i++) { const [px, pz] = S0.w(i * 55 + 27, 125 + (i % 2) * 22); ship(C, px, pz, ang + Math.PI / 2 + (i % 2) * 0.1, 1 + (Math.abs(i) % 3) * 0.25, [0xf2ead8, 0xe8d8a8, 0xd8e0f0][Math.abs(i) % 3]); }
      for (let i = 0; i < 12; i++) { const [cx, cz] = S0.w(-130 + i * 24, -10); crate(C, cx, cz, 1 + (i % 2) * 0.4); const [bx, bz] = S0.w(-124 + i * 24, -18); barrel(C, bx, bz); }
      for (let i = -1; i <= 1; i++) { const [wx, wz] = S0.w(i * 70, -52); if (!C.claim(wx, wz, 18)) continue; const w = new Loc(C, wx, wz, ang); w.box(0, 0, 0, 30, 9, 16, 0x8a6a4a); w.gable(0, 9, 0, 32, 6, 16, 0x4a5a6a, false); w.box(0, 0, 8.05, 8, 7, 0.3, 0x2a1c10); w.solid(30, 16, 14, 8); }
      if (!big) { const lx = p.x + Math.sin(ang) * (d0 + 30), lz = p.z + Math.cos(ang) * (d0 + 30); lighthouse(C, lx, lz, 46); }
      return true;
    }
    default: return false;
  }
}
const barn2 = (C: Ctx): Bld => ({ f: (x, z, ry) => barn(C, x, z, ry), rad: 14 });
export const _cityKit = { hut };
