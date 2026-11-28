import * as THREE from 'three';
import type { Fighter } from './Fighter';

/**
 * Procedural, fully animated Greed Island creatures (walk cycles, breathing, wind-up / strike poses,
 * hit reactions). They replace the humanoid rig on every monster and summon.
 */
export interface Creature { group: THREE.Group; update: (dt: number, f: Fighter) => void }

const lam = (c: number, e = 0) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, emissive: e ? c : 0, emissiveIntensity: e });
const bas = (c: number, mul = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(mul) });
type G = THREE.BufferGeometry;
const BOX = new THREE.BoxGeometry(1, 1, 1), SPH = new THREE.SphereGeometry(0.5, 12, 9), CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10), CONE = new THREE.ConeGeometry(0.5, 1, 8);
function mesh(parent: THREE.Object3D, g: G, m: THREE.Material, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) {
  const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; parent.add(o); return o;
}
const pivot = (parent: THREE.Object3D, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

interface Ctx { t: number; phase: number; move: number; atk: number; windup: number; strike: number; hurt: number; dead: boolean; air: boolean }
const ATK_ANIMS = new Set(['slamR', 'jabR', 'leap', 'castFwd', 'crouch', 'slamL', 'jabL']);
function mkCtx(): Ctx { return { t: 0, phase: 0, move: 0, atk: -1, windup: 0, strike: 0, hurt: 0, dead: false, air: false }; }
function tick(c: Ctx, dt: number, f: Fighter) {
  c.t += dt;
  const sp = Math.min(1.4, f.speedNow / Math.max(1, f.baseSpeed || 8));
  c.move += (sp - c.move) * Math.min(1, dt * 8);
  c.phase += dt * (3 + f.speedNow * 0.9);
  c.atk = f.anim && ATK_ANIMS.has(f.anim.name) && f.lock > 0 ? clamp(f.anim.t / Math.max(0.1, f.anim.dur), 0, 1) : -1;
  c.windup = c.atk < 0 ? 0 : clamp(c.atk / 0.55, 0, 1);
  c.strike = c.atk < 0 ? 0 : clamp((c.atk - 0.5) / 0.3, 0, 1) * (1 - clamp((c.atk - 0.85) / 0.15, 0, 1));
  c.hurt = Math.max(0, (f.st.hurtT ?? 0) > 0 ? 1 : 0);
  c.dead = f.dead; c.air = !f.onGround;
}

// ------------------------------------------------------------------ quadrupeds
interface QuadOpts {
  len: number; h: number; w: number; legL: number; legW: number; color: number; belly?: number; accent?: number; headR: number; snout: number;
  ears?: 'point' | 'round' | 'none'; tail?: 'bushy' | 'long' | 'thin' | 'none'; mane?: number; horns?: number; spikes?: number; eye?: number; wings?: number; scales?: boolean; antenna?: boolean;
}
function quad(o: QuadOpts): Creature {
  const group = new THREE.Group();
  const body = pivot(group, 0, o.legL + o.h * 0.5, 0);
  const mc = lam(o.color), bc = lam(o.belly ?? o.color), ac = lam(o.accent ?? o.color);
  mesh(body, BOX, mc, 0, 0, 0, o.w, o.h, o.len);
  mesh(body, SPH, mc, 0, 0.05, o.len * 0.42, o.w * 1.12, o.h * 1.15, o.len * 0.42);
  mesh(body, SPH, mc, 0, 0.0, -o.len * 0.42, o.w * 1.05, o.h * 1.08, o.len * 0.4);
  mesh(body, BOX, bc, 0, -o.h * 0.38, 0, o.w * 0.9, o.h * 0.35, o.len * 0.8);
  if (o.mane) for (let i = 0; i < 7; i++) mesh(body, CONE, lam(o.mane), 0, o.h * 0.55, o.len * (0.36 - i * 0.11), o.w * 0.5, o.h * 0.5, o.w * 0.5).rotation.x = -0.4;
  if (o.spikes) for (let i = 0; i < 8; i++) { const s = mesh(body, CONE, lam(o.spikes), (i % 2 ? 1 : -1) * o.w * 0.18, o.h * 0.58, o.len * (0.4 - i * 0.11), o.w * 0.22, o.h * 0.55, o.w * 0.22); s.rotation.z = (i % 2 ? -1 : 1) * 0.25; }
  const neck = pivot(body, 0, o.h * 0.3, o.len * 0.5);
  mesh(neck, BOX, mc, 0, o.h * 0.15, o.len * 0.1, o.w * 0.6, o.h * 0.6, o.len * 0.3).rotation.x = -0.3;
  const head = pivot(neck, 0, o.h * 0.35, o.len * 0.25);
  mesh(head, SPH, mc, 0, 0, 0, o.headR * 1.5, o.headR * 1.3, o.headR * 1.6);
  const jaw = pivot(head, 0, -o.headR * 0.4, o.headR * 0.5);
  mesh(head, BOX, bc, 0, -o.headR * 0.12, o.headR * 1.0 + o.snout * 0.4, o.headR * 0.9, o.headR * 0.65, o.snout);
  mesh(jaw, BOX, ac, 0, -o.headR * 0.12, o.snout * 0.5, o.headR * 0.75, o.headR * 0.25, o.snout * 0.95);
  for (let i = 0; i < 4; i++) { mesh(jaw, CONE, bas(0xffffff), (i % 2 ? 1 : -1) * o.headR * 0.28, o.headR * 0.18, o.snout * (0.4 + (i >> 1) * 0.4), o.headR * 0.12, o.headR * 0.3, o.headR * 0.12); }
  mesh(head, SPH, bas(0x111111), 0, -o.headR * 0.02, o.headR * 1.0 + o.snout * 0.9, o.headR * 0.28, o.headR * 0.22, o.headR * 0.28);
  for (const s of [-1, 1]) {
    mesh(head, SPH, bas(0xffffff), s * o.headR * 0.55, o.headR * 0.2, o.headR * 0.75, o.headR * 0.34);
    mesh(head, SPH, bas(o.eye ?? 0xffc23a, 1.5), s * o.headR * 0.6, o.headR * 0.2, o.headR * 0.9, o.headR * 0.2);
    if (o.ears === 'point') mesh(head, CONE, mc, s * o.headR * 0.55, o.headR * 0.85, o.headR * 0.1, o.headR * 0.4, o.headR * 0.8, o.headR * 0.3).rotation.z = -s * 0.2;
    if (o.ears === 'round') mesh(head, SPH, mc, s * o.headR * 0.65, o.headR * 0.8, o.headR * 0.05, o.headR * 0.55, o.headR * 0.55, o.headR * 0.25);
    if (o.horns) { const hm = mesh(head, CONE, lam(o.horns), s * o.headR * 0.5, o.headR * 0.9, -o.headR * 0.1, o.headR * 0.32, o.headR * 1.6, o.headR * 0.32); hm.rotation.z = -s * 0.5; hm.rotation.x = -0.3; }
  }
  const legs: THREE.Group[] = [];
  const shins: THREE.Group[] = [];
  for (const [sx, sz] of [[1, 1], [-1, -1], [-1, 1], [1, -1]]) {
    const p = pivot(body, sx * o.w * 0.42, -o.h * 0.3, sz * o.len * 0.36);
    mesh(p, BOX, mc, 0, -o.legL * 0.25, 0, o.legW * 1.2, o.legL * 0.55, o.legW * 1.2);
    const sh = pivot(p, 0, -o.legL * 0.5, 0);
    mesh(sh, BOX, mc, 0, -o.legL * 0.25, 0, o.legW, o.legL * 0.55, o.legW);
    mesh(sh, BOX, ac, 0, -o.legL * 0.52, o.legW * 0.4, o.legW * 1.3, o.legW * 0.4, o.legW * 1.9);
    legs.push(p); shins.push(sh);
  }
  const tailSegs: THREE.Group[] = [];
  if (o.tail && o.tail !== 'none') {
    let par: THREE.Object3D = pivot(body, 0, o.h * 0.2, -o.len * 0.5);
    const n = o.tail === 'long' ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const s = o.tail === 'bushy' ? o.w * (0.55 - i * 0.08) : o.w * (0.32 - i * 0.04);
      const L = o.tail === 'long' ? o.len * 0.22 : o.len * 0.2;
      mesh(par, o.tail === 'bushy' ? SPH : BOX, i === n - 1 && o.tail === 'bushy' ? bc : mc, 0, 0, -L * 0.5, s, s, L * 1.1);
      const nx = pivot(par, 0, 0, -L); tailSegs.push(nx as THREE.Group); par = nx;
    }
  }
  let wL: THREE.Group | null = null, wR: THREE.Group | null = null;
  if (o.wings) {
    const mk = (s: number) => {
      const w = pivot(body, s * o.w * 0.4, o.h * 0.4, o.len * 0.15);
      const wm = lam(o.wings!);
      mesh(w, BOX, mc, s * o.len * 0.3, 0, 0, o.len * 0.6, o.h * 0.1, o.h * 0.1);
      const mem = mesh(w, BOX, wm, s * o.len * 0.35, 0, -o.len * 0.2, o.len * 0.7, o.h * 0.04, o.len * 0.45); (mem.material as THREE.Material).side = THREE.DoubleSide;
      return w;
    };
    wL = mk(-1); wR = mk(1);
  }
  const c = mkCtx();
  return {
    group,
    update(dt, f) {
      tick(c, dt, f);
      const sw = Math.sin(c.phase) * 0.8 * c.move, sw2 = Math.cos(c.phase) * 0.8 * c.move;
      legs[0].rotation.x = sw; legs[1].rotation.x = sw; legs[2].rotation.x = -sw2 * 0.8; legs[3].rotation.x = -sw2 * 0.8;
      shins[0].rotation.x = Math.max(0, -sw) * 1.1; shins[1].rotation.x = Math.max(0, -sw) * 1.1; shins[2].rotation.x = Math.max(0, sw2) * 1.1; shins[3].rotation.x = Math.max(0, sw2) * 1.1;
      body.position.y = o.legL + o.h * 0.5 + Math.abs(Math.sin(c.phase)) * 0.12 * c.move * o.legL + Math.sin(c.t * 2) * 0.03;
      body.rotation.x = -c.windup * 0.35 * (1 - c.strike) + c.strike * 0.25 - (c.air ? 0.25 : 0);
      body.position.z = c.strike * o.len * 0.25;
      neck.rotation.x = c.windup * 0.5 * (1 - c.strike) - c.strike * 0.6;
      jaw.rotation.x = c.strike * 0.8 + (c.windup * 0.4) + Math.sin(c.t * 6) * 0.03;
      head.rotation.y = Math.sin(c.t * 0.9) * 0.15 * (1 - c.move);
      tailSegs.forEach((s, i) => { s.rotation.y = Math.sin(c.t * (3 + c.move * 4) - i * 0.9) * 0.35; s.rotation.x = 0.1; });
      if (wL && wR) { const fl = Math.sin(c.t * (c.air ? 12 : 3)) * (c.air ? 0.8 : 0.15) - 0.1; wL.rotation.z = -fl; wR.rotation.z = fl; }
      group.scale.setScalar(1 + c.hurt * 0.04 * Math.sin(c.t * 60));
    },
  };
}

// ------------------------------------------------------------------ biped giants (cyclops, golem, panda)
function biped(kind: 'cyclops' | 'golem' | 'panda', tint: number): Creature {
  const group = new THREE.Group();
  const skin = kind === 'cyclops' ? 0xc9a26a : kind === 'golem' ? 0x8c8fa3 : 0xf4f4f4;
  const dark = kind === 'cyclops' ? 0x8a6a40 : kind === 'golem' ? 0x5a5d70 : 0x222222;
  const sk = lam(skin), dk = lam(dark);
  const hips = pivot(group, 0, 1.15, 0);
  const torso = pivot(hips, 0, 0.35, 0);
  mesh(torso, SPH, sk, 0, 0.55, 0, 1.25, 1.2, 0.9);
  mesh(torso, SPH, sk, 0, 0.1, 0.12, 1.05, 0.8, 0.85);
  mesh(torso, BOX, dk, 0, 0.1, 0, 1.1, 0.18, 0.95);
  if (kind === 'cyclops') { mesh(torso, BOX, lam(0x6a4a2a), 0, 0.2, 0.0, 1.15, 0.12, 0.95); mesh(torso, SPH, dk, 0, 0.75, 0.35, 0.3); }
  if (kind === 'golem') for (let i = 0; i < 5; i++) mesh(torso, BOX, bas(0x6ad0ff, 1.4), (i - 2) * 0.2, 0.7, 0.45, 0.07, 0.3, 0.05);
  const head = pivot(torso, 0, 1.18, 0.05);
  mesh(head, SPH, sk, 0, 0.1, 0.05, 0.75, 0.7, 0.72);
  let eyeMat: THREE.MeshBasicMaterial | null = null;
  if (kind === 'cyclops') {
    mesh(head, SPH, bas(0xfff6e0), 0, 0.15, 0.34, 0.42, 0.38, 0.2);
    eyeMat = bas(0xff3a2a, 1.6); mesh(head, SPH, eyeMat, 0, 0.15, 0.43, 0.2, 0.2, 0.1); mesh(head, SPH, bas(0x000000), 0, 0.15, 0.48, 0.09, 0.09, 0.05);
    mesh(head, BOX, dk, 0, -0.12, 0.34, 0.4, 0.06, 0.06);
    for (const s of [-1, 1]) mesh(head, CONE, lam(0xe9e2cf), s * 0.2, -0.1, 0.36, 0.06, 0.14, 0.06).rotation.x = Math.PI;
    mesh(head, CONE, lam(0xe9e2cf), 0, 0.5, 0.1, 0.12, 0.28, 0.12);
  } else if (kind === 'golem') {
    eyeMat = bas(0x6ad0ff, 2); mesh(head, BOX, eyeMat, 0, 0.12, 0.34, 0.45, 0.07, 0.05);
    mesh(head, CONE, lam(0x5a5d70), 0, 0.5, 0, 0.3, 0.4, 0.3);
  } else {
    for (const s of [-1, 1]) { mesh(head, SPH, lam(0x222222), s * 0.3, 0.38, 0, 0.25); mesh(head, SPH, lam(0x222222), s * 0.18, 0.14, 0.33, 0.18, 0.22, 0.1); mesh(head, SPH, bas(0xffffff), s * 0.18, 0.15, 0.4, 0.07); }
    mesh(head, SPH, lam(0x222222), 0, 0.02, 0.38, 0.14, 0.1, 0.1);
  }
  const arms: { sh: THREE.Group; el: THREE.Group }[] = [];
  for (const s of [-1, 1]) {
    const sh = pivot(torso, s * 0.78, 0.95, 0);
    mesh(sh, SPH, kind === 'golem' ? dk : sk, 0, 0, 0, 0.5);
    mesh(sh, BOX, sk, 0, -0.4, 0, 0.36, 0.8, 0.36);
    const el = pivot(sh, 0, -0.8, 0);
    mesh(el, BOX, sk, 0, -0.35, 0, 0.32, 0.7, 0.32);
    mesh(el, SPH, kind === 'panda' ? dk : sk, 0, -0.78, 0, 0.5);
    arms.push({ sh, el });
  }
  const club = pivot(arms[1].el, 0, -0.78, 0);
  if (kind === 'cyclops') {
    mesh(club, CYL, lam(0x6a4a2a), 0, 0.5, 0, 0.18, 1.8, 0.18);
    mesh(club, CYL, lam(0x7a5a34), 0, 1.7, 0, 0.5, 1.3, 0.5);
    for (let i = 0; i < 6; i++) { const a = i * 1.047; mesh(club, CONE, lam(0xb0b0b8), Math.cos(a) * 0.27, 1.5 + (i % 2) * 0.5, Math.sin(a) * 0.27, 0.12, 0.28, 0.12).rotation.z = -Math.cos(a) * 1.4; }
    club.rotation.x = Math.PI * 0.5;
  } else if (kind === 'golem') { mesh(club, BOX, lam(0x5a5d70), 0, -0.3, 0, 0.6, 0.6, 0.6); }
  const legs: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const lg = pivot(hips, s * 0.38, 0, 0);
    mesh(lg, BOX, dk, 0, -0.4, 0, 0.45, 0.85, 0.45);
    const kn = pivot(lg, 0, -0.8, 0);
    mesh(kn, BOX, dk, 0, -0.35, 0, 0.4, 0.7, 0.4);
    mesh(kn, BOX, lam(0x3a2a1a), 0, -0.75, 0.15, 0.5, 0.2, 0.75);
    legs.push(lg);
  }
  const c = mkCtx();
  return {
    group,
    update(dt, f) {
      tick(c, dt, f);
      const sw = Math.sin(c.phase * 0.75) * 0.7 * c.move;
      legs[0].rotation.x = sw; legs[1].rotation.x = -sw;
      hips.position.y = 1.15 + Math.abs(Math.cos(c.phase * 0.75)) * 0.1 * c.move + Math.sin(c.t * 1.8) * 0.02;
      torso.rotation.z = Math.sin(c.phase * 0.75) * 0.05 * c.move;
      torso.rotation.x = c.windup * -0.35 * (1 - c.strike) + c.strike * 0.5;
      head.rotation.x = c.strike * 0.3; head.rotation.y = Math.sin(c.t * 0.8) * 0.2 * (1 - c.move);
      const up = c.windup * (1 - c.strike);
      if (c.atk >= 0) { // two-handed overhead slam / swing
        arms[0].sh.rotation.x = -2.6 * up + 1.0 * c.strike; arms[1].sh.rotation.x = -2.8 * up + 1.1 * c.strike;
        arms[0].el.rotation.x = -0.4; arms[1].el.rotation.x = -0.5 * up;
        club.rotation.x = Math.PI * 0.5 - up * 1.2 + c.strike * 1.4;
      } else {
        arms[0].sh.rotation.x = -sw * 1.1; arms[1].sh.rotation.x = sw * 1.1 - 0.2;
        arms[0].el.rotation.x = -0.3; arms[1].el.rotation.x = -0.4;
        club.rotation.x = Math.PI * 0.5 - 0.15 + Math.sin(c.t * 1.6) * 0.04;
      }
      arms[0].sh.rotation.z = 0.15; arms[1].sh.rotation.z = -0.15;
      if (eyeMat) eyeMat.color.setScalar(1).multiply(new THREE.Color(kind === 'cyclops' ? 0xff3a2a : 0x6ad0ff)).multiplyScalar(1.4 + Math.sin(c.t * 3) * 0.3 + c.windup * 0.8);
      void tint;
      group.scale.setScalar(1 + c.hurt * 0.035 * Math.sin(c.t * 60));
    },
  };
}

// ------------------------------------------------------------------ insects
function insect(kind: 'beetle' | 'locust'): Creature {
  const group = new THREE.Group();
  const shellC = kind === 'beetle' ? 0xf4f1e2 : 0xdff3ea;
  const shell = lam(shellC), dk = lam(kind === 'beetle' ? 0x3a3428 : 0x4a6a5a), glow = bas(0xffd24a, 1.5);
  const body = pivot(group, 0, 1.1, 0);
  const thorax = mesh(body, SPH, dk, 0, 0, 0.7, 1.0, 0.8, 1.0);
  const abd = pivot(body, 0, 0.1, -0.5);
  mesh(abd, SPH, dk, 0, 0, -0.2, 1.4, 1.0, 1.9);
  const elytra: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const e = pivot(abd, s * 0.12, 0.45, 0.5);
    mesh(e, SPH, shell, s * 0.5, 0.0, -0.9, 1.0, 0.6, 2.2);
    if (kind === 'locust') for (let i = 0; i < 5; i++) mesh(e, SPH, bas(0xffffff, 1.2), s * 0.5, 0.28, -0.4 - i * 0.35, 0.2, 0.1, 0.2);
    elytra.push(e);
  }
  const head = pivot(body, 0, 0.1, 1.45);
  mesh(head, SPH, dk, 0, 0, 0, 0.85, 0.7, 0.8);
  const mand: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    mesh(head, SPH, glow, s * 0.28, 0.12, 0.32, 0.2);
    const m = pivot(head, s * 0.18, -0.05, 0.4);
    const len = kind === 'beetle' ? 1.5 : 0.55;
    mesh(m, CONE, lam(0x6a4a2a), s * 0.05, 0, len * 0.5, 0.22, len, 0.22).rotation.x = Math.PI / 2;
    if (kind === 'beetle') mesh(m, CONE, lam(0x6a4a2a), s * 0.2, 0.15, len * 0.9, 0.12, 0.5, 0.12).rotation.z = -s * 0.8;
    mand.push(m);
  }
  if (kind === 'beetle') { mesh(head, CONE, lam(0x6a4a2a), 0, 0.5, 0.2, 0.18, 1.0, 0.18).rotation.x = -0.5; }
  for (const s of [-1, 1]) { const a = mesh(head, CYL, dk, s * 0.2, 0.45, 0.4, 0.04, 0.9, 0.04); a.rotation.z = -s * 0.5; a.rotation.x = 0.7; }
  const legs: { p: THREE.Group; k: THREE.Group }[] = [];
  for (let i = 0; i < 6; i++) {
    const s = i % 2 ? 1 : -1, row = Math.floor(i / 2);
    const big = kind === 'locust' && row === 2;
    const p = pivot(body, s * 0.45, -0.2, 0.9 - row * 0.8);
    mesh(p, BOX, dk, s * 0.4, 0.1, 0, big ? 0.9 : 0.8, 0.1, 0.1).rotation.z = s * -0.3;
    const k = pivot(p, s * 0.85, 0.15, 0);
    mesh(k, BOX, dk, s * 0.05, -0.5, 0, 0.1, big ? 1.8 : 1.1, 0.1);
    mesh(k, BOX, dk, s * 0.05, -1.05, 0.1, 0.12, 0.1, 0.35);
    legs.push({ p, k });
  }
  const c = mkCtx();
  return {
    group,
    update(dt, f) {
      tick(c, dt, f);
      legs.forEach((l, i) => { const ph = c.phase * 1.2 + (i % 3) * 2.1 + (i % 2) * Math.PI; l.p.rotation.y = Math.sin(ph) * 0.45 * c.move * (i % 2 ? 1 : -1); l.k.rotation.z = (i % 2 ? 1 : -1) * (0.5 + Math.max(0, Math.cos(ph)) * 0.5 * c.move); });
      body.position.y = 1.1 + Math.sin(c.t * 2.2) * 0.03 + (c.air ? 0.3 : 0);
      body.rotation.x = c.windup * 0.3 * (1 - c.strike) - c.strike * 0.3;
      mand.forEach((m, i) => { m.rotation.y = (i ? -1 : 1) * (0.1 + c.windup * 0.5 - c.strike * 0.7); });
      elytra.forEach((e, i) => { const open = (c.air || c.windup > 0.2) ? 0.9 : Math.sin(c.t * 1.5) * 0.02; e.rotation.z = (i ? 1 : -1) * open * (kind === 'beetle' ? 0.6 : 0.9); });
      head.rotation.x = c.windup * 0.5 * (1 - c.strike) - c.strike * 0.4;
      abd.rotation.x = Math.sin(c.t * 3) * 0.04;
      void thorax;
      group.scale.setScalar(1 + c.hurt * 0.04 * Math.sin(c.t * 60));
    },
  };
}

// ------------------------------------------------------------------ puffball, scorpion, lizard, horse, dragon, mermaid
function puffball(): Creature {
  const group = new THREE.Group();
  const core = pivot(group, 0, 1.8, 0);
  mesh(core, SPH, lam(0xf2d4ff), 0, 0, 0, 2.2);
  const spikes: THREE.Mesh[] = [];
  for (let i = 0; i < 34; i++) {
    const y = 1 - (i / 33) * 2, r = Math.sqrt(1 - y * y), a = i * 2.399;
    const v = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    const s = mesh(core, CONE, lam(i % 3 ? 0xffb0e8 : 0xd08aff), v.x * 1.05, v.y * 1.05, v.z * 1.05, 0.22, 0.75, 0.22);
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v); spikes.push(s);
  }
  for (const s of [-1, 1]) { mesh(core, SPH, bas(0xffffff), s * 0.38, 0.2, 1.0, 0.42); mesh(core, SPH, bas(0x220033), s * 0.38, 0.2, 1.2, 0.24); }
  mesh(core, SPH, bas(0xff5a8a), 0, -0.22, 1.08, 0.3, 0.14, 0.14);
  const c = mkCtx();
  return {
    group,
    update(dt, f) {
      tick(c, dt, f);
      core.position.y = 1.8 + Math.sin(c.t * 2.4) * 0.25 + c.move * 0.15;
      const puff = 1 + c.windup * 0.35 * (1 - c.strike) - c.strike * 0.18 + Math.sin(c.t * 3) * 0.03;
      core.scale.setScalar(puff);
      core.rotation.y += dt * (0.4 + c.windup * 6); core.rotation.z = Math.sin(c.t * 1.3) * 0.12;
      spikes.forEach((s, i) => { s.scale.y = 0.75 * (1 + c.windup * 0.4 + Math.sin(c.t * 5 + i) * 0.05); });
      group.scale.setScalar(1 + c.hurt * 0.05 * Math.sin(c.t * 60));
    },
  };
}
function scorpion(): Creature {
  const group = new THREE.Group();
  const sh = lam(0xc08a50), dk = lam(0x6a3a20);
  const body = pivot(group, 0, 0.7, 0);
  mesh(body, SPH, sh, 0, 0, 0, 1.4, 0.7, 2.0);
  for (let i = 0; i < 4; i++) mesh(body, BOX, dk, 0, 0.3, 0.6 - i * 0.45, 1.0 - i * 0.1, 0.12, 0.2);
  const claws: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const a = pivot(body, s * 0.6, 0.0, 1.0);
    mesh(a, BOX, sh, s * 0.3, 0, 0.5, 0.3, 0.3, 1.0).rotation.y = s * 0.2;
    mesh(a, SPH, sh, s * 0.45, 0, 1.2, 0.7, 0.4, 0.9);
    mesh(a, CONE, dk, s * 0.65, 0, 1.75, 0.25, 0.7, 0.25).rotation.x = Math.PI / 2;
    claws.push(a);
  }
  const tail: THREE.Group[] = []; let par: THREE.Object3D = pivot(body, 0, 0.1, -0.9);
  for (let i = 0; i < 5; i++) { mesh(par, SPH, sh, 0, 0.15, -0.1, 0.5 - i * 0.04, 0.5 - i * 0.04, 0.6); const n = pivot(par, 0, 0.25, -0.4); n.rotation.x = -0.55; tail.push(n); par = n; }
  mesh(par, CONE, bas(0xff3a2a, 1.2), 0, 0.1, 0.1, 0.22, 0.7, 0.22).rotation.x = -2.2;
  for (const s of [-1, 1]) mesh(body, SPH, bas(0xff2a1a, 1.5), s * 0.3, 0.3, 1.0, 0.16);
  const legs: THREE.Group[] = [];
  for (let i = 0; i < 8; i++) { const s = i % 2 ? 1 : -1, r = i >> 1; const p = pivot(body, s * 0.6, -0.1, 0.5 - r * 0.45); mesh(p, BOX, dk, s * 0.55, -0.15, 0, 1.1, 0.08, 0.08).rotation.z = s * 0.5; legs.push(p); }
  const c = mkCtx();
  return {
    group,
    update(dt, f) {
      tick(c, dt, f);
      legs.forEach((l, i) => { l.rotation.y = Math.sin(c.phase * 1.3 + i * 1.7) * 0.4 * c.move; });
      body.position.y = 0.7 + Math.sin(c.t * 3) * 0.02;
      tail.forEach((n, i) => { n.rotation.x = -0.55 - c.windup * 0.5 * (1 - c.strike) + c.strike * 0.7 + Math.sin(c.t * 2 + i) * 0.05; });
      claws.forEach((a, i) => { a.rotation.y = (i ? -1 : 1) * (-c.windup * 0.4 + c.strike * 0.5) + Math.sin(c.t * 2 + i) * 0.05; });
      group.scale.setScalar(1 + c.hurt * 0.04 * Math.sin(c.t * 60));
    },
  };
}
function bubbleHorse(): Creature {
  const q = quad({ len: 2.6, h: 0.95, w: 0.8, legL: 1.4, legW: 0.2, color: 0xfff2f2, belly: 0xffe0e6, accent: 0xff7a8a, headR: 0.42, snout: 0.6, ears: 'point', tail: 'long', mane: 0xff4a64, eye: 0x3a2a9a });
  const bub: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) { const m = mesh(q.group, SPH, new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff6a7a : 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }), 0, 2, 0, 0.5 + (i % 3) * 0.2); bub.push(m); }
  const base = q.update; let t = 0;
  q.update = (dt, f) => { base(dt, f); t += dt; bub.forEach((b, i) => { const a = t * (0.8 + i * 0.07) + i * 0.63; b.position.set(Math.cos(a) * (1.5 + i * 0.1), 1.6 + Math.sin(t * 1.4 + i) * 0.5 + (i % 4) * 0.25, Math.sin(a) * (1.3 + i * 0.08)); }); };
  return q;
}
function mermaid(): Creature {
  const group = new THREE.Group();
  const s = lam(0xffd9c0), sc = lam(0x35c8e0), hair = lam(0x3a7aff);
  const root = pivot(group, 0, 1.5, 0);
  mesh(root, SPH, s, 0, 0.5, 0, 0.55, 0.8, 0.4); mesh(root, SPH, bas(0xff5ab0, 1.1), 0, 0.55, 0.06, 0.58, 0.3, 0.42);
  const head = pivot(root, 0, 1.05, 0); mesh(head, SPH, s, 0, 0, 0, 0.42); mesh(head, SPH, hair, 0, 0.08, -0.08, 0.5, 0.5, 0.42);
  for (const x of [-1, 1]) mesh(head, SPH, bas(0x1a2a6a), x * 0.1, 0.02, 0.18, 0.07);
  const tail = pivot(root, 0, 0, 0); mesh(tail, CONE, sc, 0, -0.6, 0, 0.55, 1.5, 0.45).rotation.x = Math.PI;
  const fin = pivot(tail, 0, -1.4, 0); mesh(fin, CONE, lam(0x86f0ff), -0.3, -0.2, 0, 0.3, 0.8, 0.1).rotation.z = 0.8; mesh(fin, CONE, lam(0x86f0ff), 0.3, -0.2, 0, 0.3, 0.8, 0.1).rotation.z = -0.8;
  const c = mkCtx();
  return { group, update(dt, f) { tick(c, dt, f); root.position.y = 1.5 + Math.sin(c.t * 2) * 0.2; tail.rotation.z = Math.sin(c.t * 3) * 0.2; fin.rotation.z = Math.sin(c.t * 5) * 0.4; head.rotation.x = c.windup * -0.2; } };
}

export function buildCreature(model: string, tint: number): Creature {
  switch (model) {
    case 'cyclops': return biped('cyclops', tint);
    case 'golem': return biped('golem', tint);
    case 'panda': return biped('panda', tint);
    case 'beetle': return insect('beetle');
    case 'locust': return insect('locust');
    case 'puffball': return puffball();
    case 'scorpion': return scorpion();
    case 'horse': return bubbleHorse();
    case 'mermaid': return mermaid();
    case 'wolf': return quad({ len: 1.5, h: 0.55, w: 0.5, legL: 0.75, legW: 0.15, color: tint === 0xd8dde8 ? 0xe8ecf4 : 0x80858f, belly: 0xd6d9de, accent: 0x4a4e58, headR: 0.3, snout: 0.38, ears: 'point', tail: 'bushy', eye: 0xffc23a });
    case 'rat': return quad({ len: 1.0, h: 0.4, w: 0.38, legL: 0.3, legW: 0.1, color: 0x9a8a7a, belly: 0xd6c4b0, accent: 0xff9aa8, headR: 0.22, snout: 0.3, ears: 'round', tail: 'thin', eye: 0xff3a2a, antenna: true });
    case 'lizard': return quad({ len: 3.4, h: 1.0, w: 1.1, legL: 0.9, legW: 0.3, color: 0x34343e, belly: 0x6a5a68, accent: 0x1c1c22, headR: 0.55, snout: 1.1, ears: 'none', tail: 'long', spikes: 0x7a3a8a, eye: 0xff5a2a });
    case 'beast': return quad({ len: 2.2, h: 0.9, w: 0.9, legL: 1.0, legW: 0.28, color: 0x4f7a4a, belly: 0x8aa860, accent: 0x2a4a2a, headR: 0.5, snout: 0.6, ears: 'point', tail: 'bushy', mane: 0x2f5a2f, horns: 0xe8e0c0, eye: 0xffe23a, spikes: 0x6aaa4a });
    case 'dino': return quad({ len: 2.0, h: 0.8, w: 0.7, legL: 1.0, legW: 0.25, color: 0x6aaa4a, belly: 0xd8e8a0, accent: 0x3a6a2a, headR: 0.45, snout: 0.8, ears: 'none', tail: 'long', spikes: 0xe0a030, eye: 0xff4a2a });
    case 'dragon': return quad({ len: 2.0, h: 0.8, w: 0.7, legL: 0.8, legW: 0.22, color: 0xd04a3a, belly: 0xf0c080, accent: 0x7a2018, headR: 0.45, snout: 0.6, ears: 'none', tail: 'long', horns: 0xf0e0b0, wings: 0xff8a4a, spikes: 0xffd24a, eye: 0xffe23a });
    default: return quad({ len: 1.6, h: 0.6, w: 0.55, legL: 0.8, legW: 0.16, color: tint, headR: 0.3, snout: 0.35, ears: 'point', tail: 'bushy' });
  }
}

/** swap the humanoid rig of a fighter for a creature model */
export function attachCreature(f: Fighter, model: string, tint: number) {
  const cr = buildCreature(model, tint);
  for (const c of f.root.children) c.visible = false;
  f.root.add(cr.group);
  CREATURES.set(f, cr);
  f.st.isCreature = 1;
}
const CREATURES = new WeakMap<Fighter, Creature>();
export function updateCreature(f: Fighter, dt: number) {
  const cr = CREATURES.get(f);
  if (cr) cr.update(dt, f);
}
