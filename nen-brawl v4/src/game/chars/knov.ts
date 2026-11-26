import * as THREE from 'three';
import type { CharDef, SkillDef } from '../defs';
import type { Game } from '../Game';
import type { Fighter } from '../Fighter';
import { sfx } from '../audio';
import { begin, grnd, m1, S, rnd } from './kit';

const PT = 0x7a8cff;
const UPV = new THREE.Vector3(0, 1, 0);

function swallow(g: Game, c: Fighter, v: Fighter, hold: number, dmg: number) {
  // victim vanishes into the Nen dimension and is spat out of another door
  v.root.visible = false;
  v.invuln = Math.max(v.invuln, hold + 0.1);
  v.stun = Math.max(v.stun, hold);
  v.lock = Math.max(v.lock, hold);
  v.forced = null;
  const from = grnd(v.pos);
  g.later(hold, () => {
    v.root.visible = true;
    if (v.dead) return;
    const a = rnd(0, Math.PI * 2);
    const d = rnd(9, 14);
    v.pos.x = from.x + Math.cos(a) * d;
    v.pos.z = from.z + Math.sin(a) * d;
    g.clampPos(v.pos);
    v.pos.y = 0.4;
    v.vy = 8;
    v.onGround = false;
    g.fx.portal(v.pos.clone().setY(1.4), new THREE.Vector3(Math.cos(a), 0.2, Math.sin(a)).multiplyScalar(-1), 2.4, PT, 0.5);
    g.fx.burst(v.chestPos(), PT, 16, 9, 0.4);
    g.damage(c, v, dmg, { pierce: true, heavy: true, stun: 0.6, kb: 5, color: PT, noCrit: true, skill: true });
    g.popup(v, 'EJECTED', '#aab4ff', 20);
    sfx('boom');
  });
}

/** Z – Scream: Window to the Void */
function scream(g: Game, c: Fighter) {
  const A = g.aim(c);
  c.faceNow(A.yaw);
  c.lock = 1.1;
  c.setAnim('grab', 0.9);
  sfx('charge');
  const hp = c.chestPos().addScaledVector(A.flat, 1.3);
  g.fx.portal(hp, A.flat, 1.3, PT, 0.6);
  g.fx.gather(hp, PT, 2, 8);
  const t = A.target ?? g.target(c, 14);
  g.after(0.3, c, () => {
    if (!t || t.dead) {
      g.popup(c, 'NO TARGET', '#aab4ff', 18);
      return;
    }
    const d = new THREE.Vector3(t.pos.x - c.pos.x, 0, t.pos.z - c.pos.z);
    const L = d.length();
    d.normalize();
    g.fx.afterimage(c.pos, c.yaw, PT);
    g.dashF(c, d, Math.max(0, Math.min(L - 2.2, 11)), 0.12);
  });
  g.after(0.5, c, () => {
    if (!t || t.dead) return;
    c.faceNow(Math.atan2(t.pos.x - c.pos.x, t.pos.z - c.pos.z));
    if (Math.hypot(t.pos.x - c.pos.x, t.pos.z - c.pos.z) > 6.5) return g.popup(c, 'TOO FAR', '#aab4ff', 18);
    // portal wraps around the waist
    const wp = t.chestPos();
    g.fx.vring(wp, UPV, PT, 0.8, 2.6, 0.55);
    g.fx.portal(wp, UPV, 2.1, PT, 0.55);
    g.stunFighter(t, 0.55, true);
    t.root_ = Math.max(t.root_, 0.55);
    g.popup(t, 'SCREAM', '#aab4ff', 22);
    g.later(0.5, () => {
      if (t.dead) return;
      g.popup(c, 'CLOSE!', '#ffffff', 26);
      g.fx.explosion(t.chestPos(), 0x2a2a6a, 3, 0.4);
      g.fx.impact(t.chestPos(), PT, 2.4);
      g.fx.vring(t.chestPos(), UPV, 0xffffff, 3, 0.2, 0.25);
      g.shake(0.55);
      sfx('boom');
      g.hitSphere(grnd(t.pos), 3.2, c, 40, { kb: 6, stun: 0.5, heavy: true, color: PT, noCrit: true, skill: true, pierce: false });
    });
  });
}

/** X – Hide and Seek: open a door beneath the enemy */
function trap(g: Game, c: Fighter) {
  const A = begin(g, c, 'point', 0.5, 0.5);
  sfx('charge');
  const t = A.target;
  const p = t ? grnd(t.pos) : grnd(A.ground);
  const dd = p.clone().sub(grnd(c.pos));
  if (dd.length() > 24) p.copy(grnd(c.pos)).addScaledVector(dd.normalize(), 24);
  g.fx.telegraph(p, 3.8, PT, 0.65);
  g.fx.portal(p.clone().setY(0.2), UPV, 3.8, PT, 1.0);
  g.later(0.65, () => {
    const hits = g.enemies(c).filter((e) => !e.dead && Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < 4.1 && e.pos.y < 3);
    g.fx.vring(p.clone().setY(0.3), UPV, 0xffffff, 4, 0.5, 0.35);
    g.shake(0.25);
    sfx('smoke');
    for (const v of hits) {
      g.popup(v, 'HIDE & SEEK', '#aab4ff', 22);
      g.fx.pillar(grnd(v.pos), PT, 1.8, 8, 0.5);
      swallow(g, c, v, 1.3, 26);
    }
  });
}

/** C – Doors: a linked pair of portals; enemies stepping through one come out of the other */
function doors(g: Game, c: Fighter) {
  const A = begin(g, c, 'castFwd', 0.45, 0.45);
  sfx('charge');
  const a = grnd(c.pos).addScaledVector(A.flat, 1.8);
  const b = A.target ? grnd(A.target.pos).addScaledVector(A.flat, -4.5) : grnd(A.ground);
  const dd = b.clone().sub(grnd(c.pos));
  if (dd.length() > 24) b.copy(grnd(c.pos)).addScaledVector(dd.normalize(), 24);
  const life = 4.5;
  g.fx.portal(a.clone().setY(1.7), A.flat.clone().negate(), 2.0, PT, life);
  g.fx.portal(b.clone().setY(1.7), A.flat.clone(), 2.0, 0xaab4ff, life);
  g.fx.beam(a.clone().setY(1.7), b.clone().setY(1.7), PT, 0.15, 0.5);
  const cool = new Map<Fighter, number>();
  g.later(0.35, () => {
    // Knov hops through right away
    g.fx.afterimage(c.pos, c.yaw, PT);
    c.pos.x = b.x + A.flat.x * 2;
    c.pos.z = b.z + A.flat.z * 2;
    g.clampPos(c.pos);
    c.invuln = Math.max(c.invuln, 0.25);
    g.fx.burst(c.chestPos(), PT, 16, 8, 0.4);
    sfx('dash');
  });
  g.addZone({
    pos: a, r: 2.2, t: life, owner: c,
    tick: (gg, z, dt) => {
      for (const [k, v] of cool) if (v - dt <= 0) cool.delete(k); else cool.set(k, v - dt);
      for (const e of gg.enemies(c)) {
        if (e.dead || cool.has(e) || e.pos.y > 3) continue;
        const inA = Math.hypot(e.pos.x - a.x, e.pos.z - a.z) < 2.2;
        const inB = Math.hypot(e.pos.x - b.x, e.pos.z - b.z) < 2.2;
        if (!inA && !inB) continue;
        const dest = inA ? b : a;
        gg.fx.burst(e.chestPos(), PT, 12, 7, 0.3);
        e.pos.x = dest.x + rnd(-1, 1);
        e.pos.z = dest.z + rnd(-1, 1);
        gg.clampPos(e.pos);
        gg.stunFighter(e, 0.35, true);
        gg.damage(c, e, 9, { color: PT, noCrit: true, skill: true, kb: 2 });
        gg.fx.burst(e.chestPos(), PT, 12, 7, 0.3);
        gg.popup(e, 'PORTAL', '#aab4ff', 18);
        cool.set(e, 1.2);
        sfx('zap');
      }
      void z;
    },
  });
}

/** V – Master Key: Fourth-Dimension Condominium */
function condo(g: Game, c: Fighter) {
  const A = g.aim(c);
  const t = A.target ?? g.target(c, 34);
  c.faceNow(A.yaw);
  c.lock = 2.4;
  c.invuln = Math.max(c.invuln, 1.0);
  c.setAnim('summon', 1.1);
  sfx('charge');
  g.popup(c, 'FOURTH-DIMENSION CONDOMINIUM', '#aab4ff', 24);
  g.flash('#4a5aff', 0.3);
  g.fx.dome(grnd(c.pos), 5, PT, 1.2, 0.2);
  g.fx.gather(c.chestPos(), PT, 3, 14);
  if (!t) return;
  const center = grnd(t.pos);
  g.after(0.6, c, () => {
    if (t.dead) return;
    g.stunFighter(t, 1.9, true);
    t.root_ = Math.max(t.root_, 1.9);
    g.fx.dome(center, 6, PT, 2.0, 0.22);
    g.fx.ring(center, PT, 1, 7, 0.5);
  });
  const n = 7;
  for (let i = 0; i < n; i++) {
    g.after(0.8 + i * 0.2, c, () => {
      if (t.dead) return;
      const a = (i / n) * Math.PI * 2 + 0.4;
      const cc = grnd(t.pos);
      const pp = cc.clone().add(new THREE.Vector3(Math.cos(a) * 5.5, 2.4 + (i % 3) * 0.9, Math.sin(a) * 5.5));
      const nrm = t.chestPos().sub(pp).normalize();
      g.fx.portal(pp, nrm, 1.5, PT, 0.55);
      g.later(0.22, () => {
        if (t.dead) return;
        const dir = t.chestPos().sub(pp).normalize();
        g.fx.beam(pp, t.chestPos(), 0xffffff, 0.5, 0.2);
        g.fx.beam(pp, t.chestPos(), PT, 1.1, 0.25);
        g.fx.impact(t.chestPos(), PT, 1.2, dir);
        sfx('slash');
        g.shake(0.2);
        g.damage(c, t, 11, { pierce: true, kb: 0.5, color: PT, noCrit: true, skill: true, dirx: dir.x, dirz: dir.z });
      });
    });
  }
  g.after(0.8 + n * 0.2 + 0.4, c, () => {
    const cc = grnd(t.pos);
    g.popup(c, 'CLOSE!', '#ffffff', 28);
    g.fx.vring(t.chestPos(), UPV, 0xffffff, 6, 0.2, 0.4);
    g.fx.explosion(t.chestPos(), 0x2a2a8a, 5, 0.5);
    g.fx.shockwave(cc, PT, 9, 0.6);
    g.shake(0.7);
    sfx('boom');
    g.hitSphere(cc, 6, c, 32, { kb: 12, stun: 0.8, launch: 8, heavy: true, color: PT, noCrit: true, skill: true });
  });
}

/** F – Portal Step: short-range teleport through a pair of portals */
function step(g: Game, c: Fighter) {
  const A = g.aim(c);
  let dx = c.moveInput.x;
  let dz = c.moveInput.y;
  if (dx * dx + dz * dz < 0.01) {
    dx = A.flat.x;
    dz = A.flat.z;
  }
  const l = Math.hypot(dx, dz) || 1;
  dx /= l;
  dz /= l;
  c.faceNow(Math.atan2(dx, dz));
  c.lock = 0.35;
  c.invuln = Math.max(c.invuln, 0.4);
  const from = grnd(c.pos);
  const dir = new THREE.Vector3(dx, 0, dz);
  g.fx.portal(from.clone().setY(1.5), dir.clone().negate(), 1.5, PT, 0.5);
  sfx('dash');
  g.after(0.1, c, () => {
    g.fx.burst(c.chestPos(), PT, 14, 8, 0.3);
    c.ghost = 0.2;
    c.pos.x += dx * 13;
    c.pos.z += dz * 13;
    g.clampPos(c.pos);
    g.fx.portal(grnd(c.pos).setY(1.5), dir, 1.5, PT, 0.5);
    g.fx.burst(c.chestPos(), PT, 14, 8, 0.3);
    g.fx.speedLines(c.chestPos(), dir, PT, 8, 5, 0.25);
    const hits = g.hitSphere(grnd(c.pos), 3.6, c, 9, { kb: 5, stun: 0.2, color: PT, skill: true });
    hits.forEach((v) => g.fx.impact(v.chestPos(), PT, 1));
  });
}

const SKILLS: SkillDef[] = [
  { key: 'Z', name: 'Scream: Window to the Void', cost: 0, cd: 11, ai: [2, 9], desc: 'Close the gap, wrap a portal around the enemy and snap it shut: "CLOSE!" A huge, near-silent burst of void damage. Misses if they dash away.', cast: (g, c) => scream(g, c) },
  { key: 'X', name: 'Hide and Seek: Trapdoor', cost: 0, cd: 12, ai: [3, 22], desc: 'Open a door under the target. Anyone caught is swallowed into the Nen mansion for 1.3s, then ejected elsewhere on the field, hurt.', cast: (g, c) => trap(g, c) },
  { key: 'C', name: 'Hide and Seek: Doors', cost: 0, cd: 14, ai: [5, 26], desc: 'Open a linked pair of portals and hop through. For 4.5s any enemy stepping into one comes out of the other, stunned and hurt.', cast: (g, c) => doors(g, c) },
  {
    key: 'V', name: 'Fourth-Dimension Condominium', cost: 55, cd: 70, ai: [0, 28], can: (_g, c) => !c.form,
    desc: "ULTIMATE (55 energy): Knov's Master Key. Trap the target, ring them with seven portals that spear them from every angle, then slam the doors shut.",
    cast: (g, c) => condo(g, c),
  },
  { key: 'F', name: 'Portal Step', cost: 0, cd: 5, ai: [6, 20], desc: 'Slip through a portal and reappear 13m away, blasting anyone near the exit.', cast: (g, c) => step(g, c) },
];

export const KNOV: CharDef = {
  kind: 'knov', name: 'Knov', title: 'KNOV', typ: 'Emission · Portal tactician', color: PT, css: '#9aa8ff', hp: 400, speed: 10.6,
  blurb: 'A calculating infiltrator. His portals open anywhere, and nothing escapes once he says "Close".',
  meter: { name: 'KEY', color: '#9aa8ff', start: 0, max: 100 },
  passive: { name: 'Master Key', desc: 'Landing hits builds Key. At full Key you deal +10% damage until a skill connects. Dashing and portal-stepping grant a brief burst of speed.' },
  gainHit: 0.8, gainHurt: 0.3,
  skills: SKILLS,
  dmgBonus: (c) => (c.meter >= 99 ? 1.1 : 1),
  update(g, c, dt) {
    if (c.form !== 'exhaust') c.speedMult = (c.st.keyT ?? 0) > 0 ? 1.12 : 1;
    if (c.meter >= 99 && Math.random() < dt * 5) g.fx.aura(c.pos, PT, 1, 3.4 * c.scaleNow, 0.9);
  },
  onDealt(_g, att, _v, _a, o) {
    if (o.skill && att.meter >= 99) att.meter = 0;
  },
  onDash(_g, c) {
    c.st.keyT = 1.4;
  },
  m1: m1(0.7, 0.8, [
    S('jabR', 8, 0.25, 0.09, 4.0, { color: PT, trail: 1, lunge: 1.8 }),
    S('jabL', 8, 0.25, 0.09, 4.0, { color: PT, trail: 2 }),
    S('kickR', 9, 0.28, 0.11, 4.3, { color: PT, trail: 3, kb: 2.4 }),
    S('elbowR', 9, 0.25, 0.08, 4.0, { color: PT, trail: 1, behind: true }),
    S('palmL', 14, 0.4, 0.16, 4.6, { color: PT, trail: 2, kb: 7, heavy: true, launch: 4, shock: 3.5, lunge: 2.4 }),
  ]),
  m1Air: m1(0.7, 0.8, [
    S('jabR', 8, 0.25, 0.09, 4.0, { color: PT, trail: 1 }),
    S('jabL', 8, 0.25, 0.09, 4.0, { color: PT, trail: 2 }),
    S('kickR', 9, 0.28, 0.11, 4.2, { color: PT, trail: 3, kb: 2 }),
    S('spinKick', 10, 0.32, 0.15, 4.4, { color: PT, trail: 3, arc: -0.3, kb: 4, side: true }),
    S('slamR', 14, 0.45, 0.2, 4.2, { color: PT, arc: 0.0, kb: 2, slam: true, heavy: true, shock: 4.5 }),
  ]),
  m1Mode: 'repeat', m1Range: 4.2,
};
