import * as THREE from 'three';
import type { Game } from '../Game';
import type { Fighter } from '../Fighter';

export const Y = new THREE.Vector3(0, 1, 0);
export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const flat = (v: THREE.Vector3) => new THREE.Vector3(v.x, 0, v.z);
export const grnd = (v: THREE.Vector3) => new THREE.Vector3(v.x, 0, v.z);

/** common wind-up: face the cursor, lock the caster and play an animation. Returns the aim. */
export function begin(g: Game, c: Fighter, anim: string, dur: number, lock = dur) {
  const a = g.aim(c);
  c.faceNow(a.yaw);
  c.lock = lock;
  c.setAnim(anim, dur);
  return a;
}

export function dist2(a: Fighter, b: Fighter) {
  return Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
}

export function nearestEnemy(g: Game, c: Fighter, max = 999) {
  return g.target(c, max);
}

/** rotate a flat direction around Y */
export function rot(d: THREE.Vector3, ang: number) {
  return d.clone().applyAxisAngle(Y, ang);
}

/** place `c` at `p` (clamped to the arena) */
export function teleport(g: Game, c: Fighter, p: THREE.Vector3) {
  c.pos.x = p.x;
  c.pos.z = p.z;
  g.clampPos(c.pos);
}

/** point beside a target, on the side the caster currently is */
export function besideTarget(c: Fighter, t: Fighter, gap = 2) {
  const dx = c.pos.x - t.pos.x;
  const dz = c.pos.z - t.pos.z;
  const l = Math.hypot(dx, dz) || 1;
  return new THREE.Vector3(t.pos.x + (dx / l) * gap, 0, t.pos.z + (dz / l) * gap);
}

export function aroundTarget(t: Fighter, ang: number, gap = 2) {
  return new THREE.Vector3(t.pos.x + Math.cos(ang) * gap, 0, t.pos.z + Math.sin(ang) * gap);
}

export function faceTarget(c: Fighter, t: Fighter) {
  c.faceNow(Math.atan2(t.pos.x - c.pos.x, t.pos.z - c.pos.z));
}

import type { M1Def, M1Step } from '../defs';

/** terse M1 step builder */
export const S = (anim: string, dmg: number, dur: number, hit: number, range: number, o: Partial<M1Step> = {}): M1Step => ({
  anim, dmg, dur, hit, range, arc: 0.2, kb: 0.8, ...o,
});
export const m1 = (recovery: number, window: number, steps: M1Step[]): M1Def => ({ recovery, window, steps });
