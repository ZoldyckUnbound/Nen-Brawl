/**
 * Moveset toolkit – the building blocks every reworked hunter kit is made of.
 * Each helper mirrors a Blox-Fruits move archetype (cone strike, dash-through, projectile fan, lingering field,
 * mark & detonate, counter stance, blink, pull / push) so kits stay readable and balanced against each other.
 */
import * as THREE from 'three';
import type { Game, ProjShape } from '../Game';
import type { Fighter } from '../Fighter';
import type { DmgOpts, SkillDef } from '../defs';
import { gy } from '../terrain';
import { sfx } from '../audio';

export const Y = new THREE.Vector3(0, 1, 0);
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/** point on the real ground below v (works on Greed Island's hills as well as the flat arenas) */
export const gnd = (v: THREE.Vector3) => new THREE.Vector3(v.x, gy(v.x, v.z), v.z);
export const rotY = (d: THREE.Vector3, a: number) => d.clone().applyAxisAngle(Y, a);
export const dist = (a: Fighter, b: Fighter) => Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
export const WHITE = 0xffffff;

export interface Kit {
  skills: SkillDef[];
  form?: SkillDef[];
  notes: string[];
  /** extra passive hooks merged into the character definition */
  onDealt?: (g: Game, att: Fighter, vic: Fighter, amt: number, o: DmgOpts) => void;
  update?: (g: Game, c: Fighter, dt: number) => void;
  dmg?: number;
  hp?: number;
  speed?: number;
  /** multiplier on how fast the signature meter fills */
  gain?: number;
}

export const skill = (key: string, name: string, cost: number, cd: number, ai: [number, number], desc: string, cast: SkillDef['cast'], extra: Partial<SkillDef> = {}): SkillDef => ({ key, name, cost, cd, ai, desc, cast, ...extra });

/** wind-up: face the cursor / target, lock the caster, play the pose */
export function prep(g: Game, c: Fighter, anim: string, t = 0.2, lock = t + 0.16, col = 0xffffff) {
  const A = g.aim(c);
  c.faceNow(A.yaw);
  c.lock = lock;
  c.setAnim(anim, t + 0.18);
  c.boostT = Math.max(c.boostT, 0.35);
  c.boostColor = col;
  sfx('charge');
  return A;
}

/** melee cone strike with slash VFX */
export function cut(g: Game, c: Fighter, o: { range: number; half?: number; dmg: number; col: number; kb?: number; stun?: number; launch?: number; heavy?: boolean; slam?: boolean; bleed?: number; root?: number; slow?: [number, number]; x?: boolean; onHit?: (v: Fighter) => void; extra?: DmgOpts }): Fighter[] {
  const f = c.forward();
  const p = c.chestPos().addScaledVector(f, 1.5);
  g.fx.slashArc(p, f, rnd(-0.7, 0.7), o.range * 0.55, 0.55, o.col, 0.2);
  if (o.x || o.heavy) g.fx.slashX(p, f, o.col, o.range * 0.7, 0.3);
  const v = g.hitArc(c, o.range, o.half ?? 0.1, o.dmg, {
    color: o.col, skill: true, heavy: o.heavy, kb: o.kb, stun: o.stun, launch: o.launch, slam: o.slam, root: o.root,
    slow: o.slow?.[0], slowMul: o.slow?.[1], bleed: o.bleed, bleedDps: o.bleed ? 5 : undefined, onHit: o.onHit, ...o.extra,
  });
  if (v.length) { sfx(o.heavy ? 'heavy' : 'hit'); g.shake(o.heavy ? 0.3 : 0.12); }
  return v;
}

/** ground / air explosion */
export function blast(g: Game, c: Fighter, at: THREE.Vector3, r: number, dmg: number, col: number, o: DmgOpts = {}, vfx = true): Fighter[] {
  if (vfx) {
    g.fx.shockwave(gnd(at), col, r, 0.5);
    g.fx.explosion(at.clone().setY(Math.max(at.y, gy(at.x, at.z)) + 1), col, r * 0.55, 0.45);
    if (r > 4) g.fx.debris(gnd(at), Math.min(26, Math.round(r * 2)), r * 0.8);
  }
  return g.hitSphere(at, r, c, dmg, { color: col, skill: true, ...o });
}

/** move the caster along dir while hitting everyone passed through (once each) */
export function rush(g: Game, c: Fighter, dir: THREE.Vector3, len: number, T: number, col: number, dmg: number, o: DmgOpts = {}, ticks = 4, rad = 3.2, safe = true): Set<Fighter> {
  const hit = new Set<Fighter>();
  const d = dir.clone().setY(0).normalize();
  g.dashF(c, d, len, T);
  if (safe) c.invuln = Math.max(c.invuln, T + 0.05);
  g.fx.afterimage(c.pos, c.yaw, col);
  g.fx.speedLines(c.chestPos(), d, col, 8, 5, 0.3);
  g.trail(c, 1, col, T + 0.25, 0.7);
  g.trail(c, 3, col, T + 0.25, 0.6);
  for (let i = 1; i <= ticks; i++) {
    g.after((T * i) / ticks, c, () => {
      const vs = g.hitSphere(c.chestPos(), rad, c, dmg / ticks, { color: col, skill: true, exclude: [...hit], dirx: d.x, dirz: d.z, ...o });
      for (const v of vs) hit.add(v);
    });
  }
  return hit;
}

export interface ShotP { pos?: THREE.Vector3; dir: THREE.Vector3; speed: number; r: number; dmg: number; life?: number; col: number; size: number; shape: ProjShape; pierce?: boolean; grav?: number; homing?: { target: Fighter; rate: number }; boomerang?: boolean; noGround?: boolean; opts?: DmgOpts; onHit?: (v: Fighter, p: THREE.Vector3) => void; onEnd?: (p: THREE.Vector3, why: 'life' | 'hit' | 'ground') => void }
export function shot(g: Game, c: Fighter, P: ShotP) {
  g.shoot({
    owner: c, pos: P.pos ?? c.handPos(), dir: P.dir.clone().normalize(), speed: P.speed, radius: P.r, dmg: P.dmg, life: P.life ?? 1.6, color: P.col, size: P.size, shape: P.shape,
    pierce: P.pierce, grav: P.grav, homing: P.homing, boomerang: P.boomerang, noGround: P.noGround, opts: { color: P.col, skill: true, ...P.opts }, onHit: P.onHit, onEnd: P.onEnd,
  });
}
/** a spread of n projectiles around the aim direction */
export function fan(g: Game, c: Fighter, n: number, spread: number, P: Omit<ShotP, 'dir'>, base?: THREE.Vector3) {
  const A = g.aim(c);
  const dir = (base ?? A.dir).clone();
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? 0 : (i / (n - 1) - 0.5) * spread;
    shot(g, c, { ...P, pos: P.pos ?? c.handPos(), dir: rotY(dir, a).add(V3(0, rnd(-0.015, 0.015), 0)) });
  }
}

/** lingering field: ticks every `every` seconds on enemies inside (and optionally allies) */
export function field(g: Game, c: Fighter, pos: THREE.Vector3, r: number, t: number, col: number, o: { dps?: number; every?: number; slow?: [number, number]; heal?: number; root?: number; stun?: number; pull?: number; dmgOpts?: DmgOpts; onTick?: (v: Fighter) => void; ring?: boolean } = {}) {
  const every = o.every ?? 0.5;
  const center = pos.clone();
  g.fx.ring(gnd(center), col, 1, r, 0.6);
  g.addZone({
    pos: center, r, t, owner: c,
    tick: (gg, z) => {
      if (z.accum < every) return;
      z.accum = 0;
      gg.fx.ring(gnd(center), col, r * 0.5, r, 0.5);
      gg.fx.aura(V3(center.x + rnd(-r, r) * 0.6, gy(center.x, center.z), center.z + rnd(-r, r) * 0.6), col, 2, 3, 0.8);
      for (const v of gg.fighters) {
        if (v.dead || v.team === 'none' || Math.hypot(v.pos.x - center.x, v.pos.z - center.z) > r) continue;
        if (v.team === c.team) { if (o.heal) gg.heal(v, v.maxHp * o.heal * every, true); continue; }
        if (o.dps) gg.damage(c, v, o.dps * every, { dot: true, noCrit: true, noMeter: true, color: col, skill: true, ...o.dmgOpts });
        if (o.slow) gg.applySlow(v, every + 0.3, o.slow[1]);
        if (o.root) v.root_ = Math.max(v.root_, o.root);
        if (o.stun) gg.stunFighter(v, o.stun);
        if (o.pull) { const dx = center.x - v.pos.x, dz = center.z - v.pos.z, d = Math.hypot(dx, dz); if (d > 1.2) gg.knock(v, dx / d, dz / d, Math.min(o.pull, d - 0.6), 0.25); }
        o.onTick?.(v);
      }
    },
  });
}

/** telegraphed strike at a spot: warning ring, then fn() fires after `delay` */
export function delayed(g: Game, c: Fighter, at: THREE.Vector3, r: number, delay: number, col: number, fn: () => void) {
  g.fx.telegraph(gnd(at), r, col, delay);
  g.after(delay, c, fn);
}

export function pullTo(g: Game, c: Fighter, center: THREE.Vector3, r: number, d: number, T = 0.25) {
  for (const v of g.enemies(c)) {
    const dx = center.x - v.pos.x, dz = center.z - v.pos.z, l = Math.hypot(dx, dz);
    if (l < r && l > 1) g.knock(v, dx / l, dz / l, Math.min(d, l - 0.8), T);
  }
}
export function pushFrom(g: Game, c: Fighter, center: THREE.Vector3, r: number, d: number, T = 0.28) {
  for (const v of g.enemies(c)) {
    const dx = v.pos.x - center.x, dz = v.pos.z - center.z, l = Math.hypot(dx, dz) || 1;
    if (l < r) g.knock(v, dx / l, dz / l, d, T);
  }
}

/** place the caster at p (clamped to the playable area, y snaps to ground) */
export function tele(g: Game, c: Fighter, p: THREE.Vector3) {
  g.fx.afterimage(c.pos, c.yaw, 0xffffff, 0.4, 0.5);
  c.pos.x = p.x;
  c.pos.z = p.z;
  g.clampPos(c.pos);
}
export function behind(t: Fighter, gap = 2.1) {
  return V3(t.pos.x - Math.sin(t.yaw) * gap, 0, t.pos.z - Math.cos(t.yaw) * gap);
}
export function toward(a: Fighter, p: THREE.Vector3) {
  return Math.atan2(p.x - a.pos.x, p.z - a.pos.z);
}

/** sequence of timed steps (cancelled if the caster is interrupted) */
export function seq(g: Game, c: Fighter, steps: [number, () => void][]) {
  for (const [t, fn] of steps) g.after(t, c, fn);
}

/** marks: tag an enemy with a counter that other moves can read / detonate */
export function mark(v: Fighter, key: string, n = 1, max = 5, t = 7) {
  v.st[key] = Math.min(max, (v.st[key] ?? 0) + n);
  v.st[key + 'T'] = t;
}
export function marks(v: Fighter, key: string) { return (v.st[key + 'T'] ?? 0) > 0 ? v.st[key] ?? 0 : 0; }
export function clearMark(v: Fighter, key: string) { v.st[key] = 0; v.st[key + 'T'] = 0; }
/** tick every mark key on every enemy (call from update) */
export function decayMarks(g: Game, c: Fighter, keys: string[], dt: number) {
  for (const e of g.enemies(c)) for (const k of keys) { if ((e.st[k + 'T'] ?? 0) > 0) e.st[k + 'T'] -= dt; else if (e.st[k]) e.st[k] = 0; }
}

/** temporary damage-dealt multiplier (read by the kit's dmgBonus) */
export function empower(g: Game, c: Fighter, t: number, mult: number, label: string, col: number) {
  c.st.empT = t;
  c.st.empM = mult;
  g.popup(c, label, '#' + col.toString(16).padStart(6, '0'), 20);
  g.fx.ring(gnd(c.pos), col, 1, 7, 0.5);
}
export const empMult = (c: Fighter) => ((c.st.empT ?? 0) > 0 ? c.st.empM ?? 1 : 1);

/** counter stance: the first hit within `t` seconds is evaded and answered by fn(attacker). Works through the kit's evade hook. */
export const counterFns = new WeakMap<Fighter, (att: Fighter) => void>();
export function stance(g: Game, c: Fighter, t: number, col: number, label: string, fn?: (att: Fighter) => void) {
  if (fn) counterFns.set(c, fn);
  c.st.ctrT = t;
  c.st.ctrCol = col;
  c.st.ctrArmed = 1;
  g.fx.dome(c.chestPos(), 3.2, col, t, 0.18);
  g.popup(c, label, '#' + col.toString(16).padStart(6, '0'), 16);
}
export function dmgNum(base: number, ch: number, add: number) { return base + add * ch; }

/** cheap tri-state charge stage: 1 tap, 2 half, 3 full */
export const stage = (ch: number) => (ch >= 0.95 ? 3 : ch >= 0.4 ? 2 : 1);

/** ground point under the cursor (or the aimed enemy) clamped to `max` metres from the caster */
export function spot(g: Game, c: Fighter, max: number): THREE.Vector3 {
  const A = g.aim(c);
  const p = A.target ? A.target.pos.clone() : A.ground.clone();
  const dx = p.x - c.pos.x, dz = p.z - c.pos.z, d = Math.hypot(dx, dz);
  if (d > max) { p.x = c.pos.x + (dx / d) * max; p.z = c.pos.z + (dz / d) * max; }
  p.y = gy(p.x, p.z);
  return p;
}
