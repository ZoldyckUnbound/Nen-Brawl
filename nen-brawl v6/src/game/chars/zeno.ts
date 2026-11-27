import * as THREE from 'three';
import type { CharDef, SkillDef } from '../defs';
import type { Game } from '../Game';
import type { Fighter } from '../Fighter';
import { sfx } from '../audio';
import { begin, grnd, m1, S, rnd } from './kit';
import { dragonFx } from './extra';

const DR = 0x58d8f0;
const DW = 0xc8f6ff;

/** Z — Dragon Lance: a fang of aura spears down the line */
function lance(g: Game, c: Fighter) {
  begin(g, c, 'castFwd', 0.3, 0.32);
  sfx('zap');
  g.after(0.09, c, () => {
    const a = g.aim(c);
    c.faceNow(a.yaw);
    const o = c.chestPos().addScaledVector(a.flat, 1.0);
    const L = 28;
    dragonFx(g, o, a.dir, L, DR, 0.34, 0.55);
    g.fx.beam(o, o.clone().addScaledVector(a.dir, L), DR, 0.5, 0.2);
    const hits = g.hitBeam(c, o, a.dir, L, 1.25, 19, { color: DR, kb: 6, stun: 0.22, heavy: true, skill: true });
    hits.forEach((v) => { g.fx.impact(v.chestPos(), DR, 1.5, a.dir); g.addMeter(c, 6); });
    sfx('heavy');
  });
}

/** X — Dragon Head: ride a dragon straight through the enemy */
function ride(g: Game, c: Fighter) {
  begin(g, c, 'flyKick', 0.4, 0.42);
  sfx('dash');
  g.after(0.08, c, () => {
    const a = g.aim(c);
    c.faceNow(a.yaw);
    const fl = a.flat.clone();
    dragonFx(g, c.chestPos().addScaledVector(fl, -1.5), fl, 17, DR, 0.36, 0.95);
    g.dashF(c, fl, 15, 0.22);
    c.invuln = Math.max(c.invuln, 0.28);
    g.trail(c, 3, DR, 0.35, 0.7);
    g.trail(c, 1, DW, 0.35, 0.5);
    for (let k = 0; k < 3; k++) g.after(0.04 + k * 0.07, c, () => g.hitArc(c, 4.2, -0.3, 6, { kb: 1, color: DR, skill: true, noCrit: true }));
    g.after(0.3, c, () => {
      const hits = g.hitArc(c, 5, -0.2, 13, { kb: 8, launch: 5, stun: 0.4, heavy: true, color: DR, skill: true });
      g.fx.explosion(c.chestPos().addScaledVector(c.forward(), 2.5), DR, 2.6, 0.35);
      hits.forEach(() => g.addMeter(c, 8));
      sfx('heavy');
    });
  });
}

/** C — One Day, One Kill: vanish and stab from behind, leaving them bleeding */
function silent(g: Game, c: Fighter) {
  const A = g.aim(c);
  const t = A.target ?? g.target(c, 28);
  c.faceNow(A.yaw);
  c.lock = 0.5;
  c.invuln = Math.max(c.invuln, 0.4);
  sfx('dash');
  g.fx.afterimage(c.pos, c.yaw, DR, 0.7);
  g.fx.burst(c.chestPos(), DR, 14, 8, 0.3);
  g.after(0.1, c, () => {
    if (t && !t.dead) {
      const fw = new THREE.Vector3(Math.sin(t.yaw), 0, Math.cos(t.yaw));
      c.pos.x = t.pos.x - fw.x * 2.0;
      c.pos.z = t.pos.z - fw.z * 2.0;
      g.clampPos(c.pos);
      c.faceNow(Math.atan2(t.pos.x - c.pos.x, t.pos.z - c.pos.z));
    } else g.dashF(c, A.flat, 12, 0.12);
    g.fx.burst(c.chestPos(), DR, 14, 8, 0.3);
  });
  g.after(0.24, c, () => {
    c.setAnim('slashR', 0.25);
    sfx('slash');
    const hits = g.hitArc(c, 4.8, -0.1, 17, { kb: 3, stun: 0.3, bleed: 4, bleedDps: 6, heavy: true, color: DW, skill: true });
    g.fx.slashX(c.chestPos().addScaledVector(c.forward(), 1.5), c.forward(), DW, 4, 0.3);
    hits.forEach((v) => { g.popup(v, '一日一殺', '#c8f6ff', 20); g.addMeter(c, 10); });
  });
}

/** V — Dragon Dive: a colossal dragon bursts into hundreds that rain over the whole area */
function dive(g: Game, c: Fighter) {
  const A = g.aim(c);
  const center = A.target ? grnd(A.target.pos) : grnd(A.ground);
  const dd = center.clone().sub(grnd(c.pos));
  if (dd.length() > 34) center.copy(grnd(c.pos)).addScaledVector(dd.normalize(), 34);
  g.clampPos(center);
  c.faceNow(A.yaw);
  c.lock = 1.0;
  c.invuln = Math.max(c.invuln, 1.0);
  c.setAnim('castUp', 1.0);
  c.vy = 22;
  c.onGround = false;
  c.floatT = 1.6;
  sfx('charge');
  g.popup(c, 'DRAGON DIVE', '#7ae8ff', 28);
  g.flash('#58d8f0', 0.25);
  g.fx.telegraph(center, 13, DR, 1.2);
  dragonFx(g, c.chestPos(), new THREE.Vector3(0, 1, 0), 24, DR, 0.9, 1.5);
  g.fx.pillar(grnd(c.pos), DR, 2.4, 22, 0.8);
  g.after(2.6, c, () => { c.floatT = 0; });
  const target = A.target;
  const n = 26;
  for (let i = 0; i < n; i++) {
    g.later(0.75 + i * 0.07, () => {
      const ang = Math.random() * Math.PI * 2;
      const rr = 12 * Math.sqrt(Math.random());
      const p = new THREE.Vector3(center.x + Math.cos(ang) * rr, 0, center.z + Math.sin(ang) * rr);
      if (i % 3 === 0 && target && !target.dead) p.set(target.pos.x + rnd(-2.2, 2.2), 0, target.pos.z + rnd(-2.2, 2.2));
      g.clampPos(p);
      dragonFx(g, p.clone().setY(30), new THREE.Vector3(0, -1, 0), 30, DR, 0.3, 0.5);
      g.later(0.22, () => {
        g.fx.explosion(p.clone().setY(0.8), DR, 2.4, 0.3);
        g.fx.crack(p, DR, 1.8, 1.4);
        if (i % 4 === 0) g.shake(0.2);
        if (i % 3 === 0) sfx('boom');
        g.hitSphere(p, 3.6, c, 8, { kb: 4, stun: 0.1, color: DR, heavy: i % 6 === 5, skill: true, noCrit: true });
      });
    });
  }
}

/** F — Dragon Soar: ride a leaping dragon across the arena */
function soar(g: Game, c: Fighter) {
  const A = begin(g, c, 'leap', 0.5, 0.2);
  sfx('dash');
  c.vy = 21;
  c.onGround = false;
  c.coyote = 0;
  g.dashF(c, A.flat, 17, 0.5);
  if (c.forced) c.forced.land = true;
  c.invuln = Math.max(c.invuln, 0.2);
  dragonFx(g, c.chestPos().addScaledVector(A.flat, -1), A.flat, 14, DR, 0.5, 0.8);
  g.trail(c, 3, DR, 0.6, 0.6);
  c.onLand = {
    t: 2.5,
    fn: () => {
      const p = grnd(c.pos);
      g.fx.shockwave(p, DR, 4.5, 0.4);
      g.fx.burst(c.chestPos(), DR, 12, 7, 0.3);
      g.hitSphere(p, 4.2, c, 11, { kb: 4, stun: 0.3, color: DR, skill: true });
    },
  };
}

const SKILLS: SkillDef[] = [
  { key: 'Z', name: 'Dragon Lance', cost: 0, cd: 4, ai: [4, 28], desc: 'Spear a fang of aura down a long line: heavy damage and knockback.', cast: (g, c) => lance(g, c) },
  { key: 'X', name: 'Dragon Head', cost: 0, cd: 8, ai: [3, 18], desc: 'Ride a dragon of aura straight through the enemy and detonate at the end of the run.', cast: (g, c) => ride(g, c) },
  { key: 'C', name: 'One Day, One Kill', cost: 0, cd: 8, ai: [0, 26], desc: 'Vanish and reappear behind the target with a lethal stab that leaves them bleeding.', cast: (g, c) => silent(g, c) },
  { key: 'V', name: 'Dragon Dive', cost: 50, cd: 55, ai: [0, 34], desc: 'ULTIMATE (50 energy): hover and rain dozens of dragon fragments over a huge area, each one detonating on impact.', cast: (g, c) => dive(g, c) },
  { key: 'F', name: 'Dragon Soar', cost: 0, cd: 5, ai: [6, 28], desc: 'Leap on a streaking dragon across the arena; landing shakes the ground.', cast: (g, c) => soar(g, c) },
];

export const ZENO: CharDef = {
  kind: 'zeno', name: 'Zeno Zoldyck', title: 'ZENO ZOLDYCK', typ: 'Emission · Retired Assassin', color: DR, css: '#58d8f0', hp: 405, speed: 11.4,
  blurb: 'Silva\'s father and the Zoldyck patriarch. Small, ancient, lethal — he weaves his aura into dragons: lances, rides and a sky full of falling Dragon Dive.',
  meter: { name: 'DRAGON', color: '#58d8f0', start: 0, max: 100 },
  passive: { name: 'Dragon Aura', desc: 'Hits build the Dragon meter. At full, your next skill hit is empowered (+25% damage) and releases the dragon.' },
  gainHit: 0.9, gainHurt: 0.4,
  skills: SKILLS,
  dmgBonus: (c) => (c.meter >= 99 ? 1.25 : 1),
  onDealt(g, att, _vic, _a, o) {
    if (o.skill && att.meter >= 99) {
      att.meter = 0;
      g.popup(att, 'DRAGON UNLEASHED', '#7ae8ff', 20);
      g.fx.pillar(grnd(att.pos), DR, 1.6, 10, 0.5);
    }
  },
  m1: m1(0.6, 0.8, [
    S('jabR', 7, 0.23, 0.08, 3.8, { color: DR, trail: 1 }),
    S('jabL', 7, 0.23, 0.08, 3.8, { color: DR, trail: 2 }),
    S('kneeR', 8, 0.26, 0.1, 3.9, { color: DR, trail: 3, kb: 1.5, lunge: 2 }),
    S('elbowL', 9, 0.26, 0.1, 3.8, { color: DW, trail: 2, kb: 1 }),
    S('palmR', 15, 0.4, 0.15, 4.5, { color: DR, trail: 1, kb: 7, launch: 4, heavy: true, shock: 3, lunge: 2.8 }),
  ]),
  m1Air: m1(0.6, 0.8, [
    S('jabR', 7, 0.23, 0.08, 3.8, { color: DR, trail: 1 }),
    S('jabL', 7, 0.23, 0.08, 3.8, { color: DR, trail: 2 }),
    S('kickR', 8, 0.26, 0.1, 4.0, { color: DR, trail: 3, kb: 2 }),
    S('spinKick', 10, 0.32, 0.14, 4.3, { color: DR, trail: 3, arc: -0.3, kb: 3.5, side: true }),
    S('slamR', 14, 0.42, 0.18, 4.2, { color: DR, arc: 0.0, kb: 2, slam: true, heavy: true, shock: 4.2 }),
  ]),
  m1Mode: 'repeat', m1Range: 4.0,
};
