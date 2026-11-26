import * as THREE from 'three';
import type { CharDef, SkillDef } from '../defs';
import type { Game } from '../Game';
import type { Fighter } from '../Fighter';
import { sfx } from '../audio';
import { begin, grnd, m1, S, rot } from './kit';
import { topsOrbit } from './extra';

const BR = 0xe8b050;
const RD = 0xff4a5a;

/** Z — Battle Waltz: tops hunt the enemy from every side, spinning and hitting anything near them */
function waltz(g: Game, c: Fighter) {
  const A = begin(g, c, 'throwR', 0.4, 0.45);
  sfx('swing');
  const t = A.target ?? g.target(c, 32);
  const zp = t ? grnd(t.pos) : grnd(A.ground);
  const dd = zp.clone().sub(grnd(c.pos));
  if (dd.length() > 30) zp.copy(grnd(c.pos)).addScaledVector(dd.normalize(), 30);
  g.fx.trailSeg(c.chestPos(), zp.clone().setY(1), BR, 0.3, 0.25);
  g.after(0.25, c, () => {
    g.fx.shockwave(zp, BR, 3.5, 0.3);
    topsOrbit(g, () => zp, 7, 3.4, 3.6, 3.8);
    g.addZone({
      pos: zp, r: 4.2, t: 3.6, owner: c,
      tick: (gg, z, dt) => {
        if (t && !t.dead) {
          const d = grnd(t.pos).sub(z.pos);
          const l = d.length();
          if (l > 0.1) z.pos.addScaledVector(d, Math.min(1, (6.5 * dt) / l));
        }
        if (z.accum >= 0.36) {
          z.accum = 0;
          sfx('swing');
          gg.fx.sparks(z.pos.clone().setY(1), BR, 4, 7);
          gg.hitSphere(z.pos.clone().setY(1.5), 4.2, c, 5.5, { kb: 2.4, color: BR, noCrit: true, skill: true });
        }
      },
    });
  });
}

/** X — Shotgun Blues: a spread of spinning tops */
function shotgun(g: Game, c: Fighter) {
  begin(g, c, 'throwR', 0.35, 0.45);
  sfx('swing');
  g.after(0.15, c, () => {
    const a = g.aim(c);
    c.faceNow(a.yaw);
    for (let i = 0; i < 7; i++) {
      g.shoot({
        owner: c, pos: c.handPos().addScaledVector(a.flat, 0.6), dir: rot(a.dir, (i - 3) * 0.11), speed: 66, radius: 0.95, dmg: 6.2, life: 0.55, color: BR, size: 0.5, shape: 'orb',
        opts: { kb: 1.2, color: BR, skill: true, noCrit: true }, onHit: (_v, p) => g.fx.sparks(p, 0xffd890, 6, 8),
      });
    }
    g.fx.flashAt(c.handPos(), BR, 1.6, 0.15);
    g.fx.burst(c.handPos(), BR, 10, 8, 0.3);
    sfx('heavy');
  });
}

/** C — Tornado Top: spin on the peg leg — fast, repelling, un-stoppable */
function tornado(g: Game, c: Fighter) {
  c.lock = 0.15;
  c.castId++;
  c.st.tornadoT = 2.8;
  sfx('charge');
  g.popup(c, 'TORNADO TOP', '#ff8a8a', 22);
  c.setAnim('spin', 0.4, 3);
  g.fx.pillar(grnd(c.pos), BR, 2.4, 8, 2.6);
  g.fx.ring(grnd(c.pos), BR, 0.5, 5, 0.4);
  g.addZone({
    pos: grnd(c.pos), r: 3.8, t: 2.8, owner: c,
    tick: (gg, z) => {
      z.pos.set(c.pos.x, 0, c.pos.z);
      if (z.accum >= 0.2) {
        z.accum = 0;
        gg.fx.ring(z.pos, BR, 0.8, 4, 0.25);
        gg.hitSphere(c.chestPos(), 3.8, c, 5, { kb: 5, color: BR, noCrit: true, skill: true });
        sfx('swing');
      }
    },
  });
}

/** V — Grand Waltz: Tornado Top while a storm of tops homes in */
function grand(g: Game, c: Fighter) {
  c.lock = 0.4;
  c.castId++;
  c.st.tornadoT = 3.6;
  sfx('charge');
  g.popup(c, 'GRAND WALTZ', '#ff8a8a', 26);
  g.flash('#e8b050', 0.25);
  c.setAnim('spin', 0.4, 3);
  g.fx.pillar(grnd(c.pos), BR, 3, 12, 3.2);
  g.fx.shockwave(grnd(c.pos), BR, 8, 0.6);
  topsOrbit(g, () => c.pos, 9, 3.8, 3.8, 5);
  g.addZone({
    pos: grnd(c.pos), r: 4, t: 3.6, owner: c,
    tick: (gg, z) => {
      z.pos.set(c.pos.x, 0, c.pos.z);
      if (z.accum >= 0.22) {
        z.accum = 0;
        gg.hitSphere(c.chestPos(), 4, c, 5, { kb: 5, color: BR, noCrit: true, skill: true });
      }
    },
  });
  for (let i = 0; i < 26; i++) {
    g.after(0.4 + i * 0.11, c, () => {
      const t = g.target(c, 44);
      if (!t) return;
      const d = t.chestPos().sub(c.chestPos()).normalize();
      g.shoot({
        owner: c, pos: c.chestPos().addScaledVector(d, 1.2).add(new THREE.Vector3(0, 0.4, 0)), dir: rot(d, (Math.random() - 0.5) * 0.5), speed: 50, radius: 1.0, dmg: 4.2, life: 1.2, color: BR, size: 0.5, shape: 'orb',
        homing: { target: t, rate: 6 }, opts: { kb: 1, color: BR, skill: true, noCrit: true },
      });
      if (i % 2 === 0) sfx('swing');
    });
  }
}

/** F — Peg Hop: vault on the peg leg and drill into the ground */
function hop(g: Game, c: Fighter) {
  const A = begin(g, c, 'leap', 0.5, 0.25);
  sfx('dash');
  c.vy = 21;
  c.onGround = false;
  c.coyote = 0;
  g.dashF(c, A.flat, 13, 0.46);
  if (c.forced) c.forced.land = true;
  c.invuln = Math.max(c.invuln, 0.2);
  g.trail(c, 3, BR, 0.5, 0.5);
  c.onLand = {
    t: 2.5,
    fn: () => {
      const p = grnd(c.pos);
      g.fx.shockwave(p, BR, 5, 0.4);
      g.fx.crack(p, BR, 3.5, 2);
      g.fx.debris(p, 8, 6);
      g.shake(0.25);
      sfx('heavy');
      g.hitSphere(p, 4.4, c, 12, { kb: 5, stun: 0.3, color: BR, heavy: true, skill: true });
    },
  };
}

const SKILLS: SkillDef[] = [
  { key: 'Z', name: 'Battle Waltz', cost: 0, cd: 9, ai: [4, 30], desc: 'Hurl a ring of tops that hunts the enemy for 3.6s, battering anything near them from every side.', cast: (g, c) => waltz(g, c) },
  { key: 'X', name: 'Shotgun Blues', cost: 0, cd: 5, ai: [3, 20], desc: 'Fire a spread of seven spinning tops. Devastating up close.', cast: (g, c) => shotgun(g, c) },
  { key: 'C', name: 'Tornado Top', cost: 0, cd: 9, ai: [0, 8], desc: 'Spin on your peg leg for 2.8s: +28% speed, immune to stun, and everything near you is repelled and cut.', cast: (g, c) => tornado(g, c) },
  { key: 'V', name: 'Grand Waltz', cost: 50, cd: 55, ai: [3, 30], desc: 'ULTIMATE (50 energy): Tornado Top while twenty-six homing tops pour out at the enemy.', cast: (g, c) => grand(g, c) },
  { key: 'F', name: 'Peg Hop', cost: 0, cd: 5, ai: [5, 26], desc: 'Vault across the arena on your peg leg and drill into the ground on landing.', cast: (g, c) => hop(g, c) },
];

export const GIDO: CharDef = {
  kind: 'gido', name: 'Gido', title: 'GIDO', typ: 'Enhancement · Heavens Arena', color: RD, css: '#ff4a5a', hp: 410, speed: 10.6,
  blurb: 'The one-legged top master of the 200th floor. Fights with a cane, a metal peg leg and a storm of Nen-driven spinning tops.',
  meter: { name: 'SPIN', color: '#e8b050', start: 0, max: 100 },
  passive: { name: 'Nen Tops', desc: 'Hits build Spin (up to +25% damage at full). Spin fades slowly. While you whirl in Tornado Top you cannot be stunned.' },
  gainHit: 1.0, gainHurt: 0.3,
  skills: SKILLS,
  dmgBonus: (c) => 1 + (c.meter / 100) * 0.25,
  update(g, c, dt) {
    if ((c.st.tornadoT ?? 0) > 0) {
      c.st.tornadoOn = 1;
      c.speedMult = Math.max(c.speedMult, 1.28);
      c.stunImmune = Math.max(c.stunImmune, 0.15);
      if (!c.anim && c.lock <= 0) c.setAnim('spin', 0.4, 3);
      if (Math.random() < dt * 22) g.fx.aura(c.pos, BR, 1, 4, 1.4);
      g.addMeter(c, dt * 4);
    } else {
      if (c.st.tornadoOn) {
        c.st.tornadoOn = 0;
        c.speedMult = 1;
      }
      if (c.meter > 0) c.meter = Math.max(0, c.meter - 1.2 * dt);
    }
  },
  m1: m1(0.6, 0.8, [
    S('slashR', 7, 0.25, 0.09, 4.4, { color: BR, trail: 1 }),
    S('slashL', 7, 0.25, 0.09, 4.4, { color: BR, trail: 2 }),
    S('kickR', 8, 0.27, 0.1, 4.2, { color: BR, trail: 3, kb: 1.8 }),
    S('slashR', 9, 0.27, 0.1, 4.6, { color: BR, trail: 1, kb: 1.2 }),
    S('spinKick', 14, 0.4, 0.15, 5.0, { color: BR, trail: 3, arc: -0.3, kb: 7, heavy: true, side: true, shock: 3 }),
  ]),
  m1Air: m1(0.6, 0.8, [
    S('slashR', 7, 0.25, 0.09, 4.2, { color: BR, trail: 1 }),
    S('slashL', 7, 0.25, 0.09, 4.2, { color: BR, trail: 2 }),
    S('kickR', 8, 0.27, 0.1, 4.2, { color: BR, trail: 3, kb: 2 }),
    S('spinKick', 10, 0.32, 0.14, 4.4, { color: BR, trail: 3, arc: -0.3, kb: 3, side: true }),
    S('slamR', 14, 0.42, 0.18, 4.2, { color: BR, arc: 0.0, kb: 2, slam: true, heavy: true, shock: 4.2 }),
  ]),
  m1Mode: 'repeat', m1Range: 4.4,
};
