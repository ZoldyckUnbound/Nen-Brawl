import * as THREE from 'three';
import type { CharDef, SkillDef } from '../defs';
import type { Game } from '../Game';
import type { Fighter } from '../Fighter';
import { sfx } from '../audio';
import { begin, grnd, m1, S, faceTarget } from './kit';

const OR = 0xff9a2a;
const OW = 0xffe0a8;

/** three parallel tiger claw rakes */
function claws(g: Game, c: Fighter, size = 3.4) {
  const f = c.forward();
  const p = c.chestPos().addScaledVector(f, 1.6);
  for (let i = -1; i <= 1; i++) g.fx.slashArc(p.clone().add(new THREE.Vector3(0, i * 0.5, 0)), f, 0.5 + i * 0.12, size, 0.55, i === 0 ? OW : OR, 0.22);
}

/** Z — Tiger Bite Fist: lunge in and rake twice */
function tiger(g: Game, c: Fighter) {
  const A = begin(g, c, 'slashR', 0.4, 0.45);
  sfx('swing');
  const t = A.target ?? g.target(c, 14);
  g.after(0.08, c, () => {
    const d = t ? new THREE.Vector3(t.pos.x - c.pos.x, 0, t.pos.z - c.pos.z) : A.flat.clone().multiplyScalar(6);
    const L = Math.min(8, Math.max(0, d.length() - 2));
    d.normalize();
    c.faceNow(Math.atan2(d.x, d.z));
    g.dashF(c, d, L, 0.14);
    g.fx.afterimage(c.pos, c.yaw, OR, 0.4);
  });
  for (let k = 0; k < 2; k++) {
    g.after(0.2 + k * 0.14, c, () => {
      c.setAnim(k ? 'slashL' : 'slashR', 0.2);
      claws(g, c, 3.6);
      sfx('slash');
      const hits = g.hitArc(c, 4.8, 0.0, 11, { kb: k ? 5 : 1.5, stun: k ? 0.3 : 0, bleed: 3, bleedDps: 5, heavy: !!k, color: OR, skill: true });
      hits.forEach((v) => g.fx.impact(v.chestPos(), OR, 1.2, c.forward()));
    });
  }
}

/** X — Double: the clone appears behind the target; both strike at once */
function double(g: Game, c: Fighter) {
  const A = g.aim(c);
  const t = A.target ?? g.target(c, 30);
  c.faceNow(A.yaw);
  c.lock = 0.85;
  c.setAnim('castFwd', 0.3);
  sfx('card');
  const fwd = t ? new THREE.Vector3(t.pos.x - c.pos.x, 0, t.pos.z - c.pos.z).normalize() : A.flat.clone();
  const base = t ? grnd(t.pos) : grnd(c.pos).addScaledVector(fwd, 8);
  const dpos = base.clone().addScaledVector(fwd, 2.7);
  g.clampPos(dpos);
  g.fx.afterimage(dpos, Math.atan2(-fwd.x, -fwd.z), OR, 1.0, 0.75);
  g.fx.burst(dpos.clone().setY(1.8), OR, 14, 7, 0.4);
  g.fx.telegraph(dpos, 3.6, OR, 0.55);
  g.popup(c, 'DOUBLE', '#ffb85a', 20);
  g.after(0.55, c, () => {
    // the double strikes from behind
    const bf = fwd.clone().multiplyScalar(-1);
    g.fx.slashArc(dpos.clone().setY(1.9), bf, 0.5, 4, 0.7, OR, 0.25);
    g.fx.slashArc(dpos.clone().setY(1.4), bf, -0.4, 3.6, 0.6, OW, 0.25);
    sfx('slash');
    g.hitSphere(dpos.clone().setY(1.5), 3.6, c, 14, { kb: 5, stun: 0.3, color: OR, skill: true, heavy: true });
    // …while Kastro hits from the front
    if (t && !t.dead) {
      faceTarget(c, t);
      g.dashF(c, fwd, Math.max(0, Math.hypot(t.pos.x - c.pos.x, t.pos.z - c.pos.z) - 2.2), 0.12);
      g.after(0.14, c, () => {
        c.setAnim('palmR', 0.2);
        claws(g, c, 3.8);
        const hits = g.hitArc(c, 5, -0.1, 15, { kb: 6, launch: 4, stun: 0.35, color: OR, heavy: true, skill: true });
        hits.forEach((v) => { g.fx.impact(v.chestPos(), OR, 1.6); g.addMeter(c, 10); });
        sfx('heavy');
      });
    }
  });
}

/** C — Gyo Counter: read the aura; the next strike is dodged and punished */
function sense(g: Game, c: Fighter) {
  c.lock = 0.2;
  c.setAnim('crouch', 0.3);
  c.st.senseT = 1.1;
  sfx('charge');
  g.popup(c, 'GYO', '#ffb85a', 20);
  g.fx.ring(grnd(c.pos), OR, 0.5, 3.4, 0.5);
  g.fx.gather(c.chestPos(), OR, 2, 8);
}

/** V — True Tiger Bite Fist: two giant bites from two Kastros */
function trueBite(g: Game, c: Fighter) {
  const A = g.aim(c);
  const t = A.target ?? g.target(c, 36);
  c.faceNow(A.yaw);
  c.lock = 2.0;
  c.castId++;
  c.invuln = Math.max(c.invuln, 1.7);
  c.setAnim('crouch', 0.4);
  sfx('charge');
  g.popup(c, 'TRUE TIGER BITE FIST', '#ffb85a', 26);
  g.flash('#ff9a2a', 0.28);
  if (!t) {
    g.after(0.3, c, () => { claws(g, c, 5); g.hitArc(c, 6, 0.0, 22, { kb: 8, stun: 0.5, color: OR, heavy: true, skill: true }); });
    return;
  }
  g.after(0.25, c, () => {
    const d = new THREE.Vector3(t.pos.x - c.pos.x, 0, t.pos.z - c.pos.z);
    const L = d.length();
    d.normalize();
    g.fx.afterimage(c.pos, c.yaw, OR, 0.5);
    g.dashF(c, d, Math.max(0, L - 2.8), 0.14);
    g.stunFighter(t, 1.5, true);
  });
  g.after(0.55, c, () => {
    if (t.dead) return;
    faceTarget(c, t);
    const d = new THREE.Vector3(t.pos.x - c.pos.x, 0, t.pos.z - c.pos.z).normalize();
    const dpos = grnd(t.pos).addScaledVector(d, 2.6);
    g.fx.afterimage(dpos, Math.atan2(-d.x, -d.z), OR, 1.0, 0.8);
    g.fx.burst(dpos.clone().setY(1.8), OR, 18, 8, 0.4);
    g.fx.telegraph(grnd(t.pos), 4.8, OR, 0.45);
    c.setAnim('castFwd', 0.4);
  });
  g.after(1.0, c, () => {
    if (t.dead) return;
    const mid = t.chestPos();
    const d = new THREE.Vector3(t.pos.x - c.pos.x, 0, t.pos.z - c.pos.z).normalize();
    for (const s of [1, -1]) {
      g.fx.slashArc(mid.clone().addScaledVector(d, -s * 2.4), d.clone().multiplyScalar(s), 0.5 * s, 5.5, 0.9, OR, 0.35);
      g.fx.slashArc(mid.clone().addScaledVector(d, -s * 2.4), d.clone().multiplyScalar(s), -0.5 * s, 5.0, 0.8, OW, 0.3);
    }
    g.fx.explosion(mid, OR, 3.6, 0.45);
    g.fx.impact(mid, 0xffffff, 3);
    g.shake(0.8);
    g.flash('#ffd29a', 0.35);
    sfx('boom');
    c.setAnim('slamR', 0.3);
    const hits = g.hitSphere(grnd(t.pos), 4.8, c, 50, { kb: 7, launch: 8, stun: 0.9, heavy: true, breakGuard: true, bleed: 3, bleedDps: 8, color: OR, skill: true });
    hits.forEach((v) => g.popup(v, 'RIPPED!', '#ffb85a', 24));
  });
}

/** F — Phantom Step: dash away, leaving the double to strike where you stood */
function phantom(g: Game, c: Fighter) {
  const A = g.aim(c);
  c.lock = 0.25;
  c.invuln = Math.max(c.invuln, 0.25);
  c.combo = 0;
  sfx('dash');
  let d = new THREE.Vector3(c.moveInput.x, 0, c.moveInput.y);
  if (d.lengthSq() < 0.05) d = A.flat.clone();
  d.normalize();
  const start = grnd(c.pos);
  const yaw = c.yaw;
  g.fx.afterimage(start, yaw, OR, 0.9, 0.7);
  g.dashF(c, d, 12, 0.17);
  g.trail(c, 3, OR, 0.3, 0.5);
  g.after(0.17, c, () => g.fx.afterimage(grnd(c.pos), c.yaw, OW, 0.3, 0.5));
  g.later(0.4, () => {
    g.fx.slashArc(start.clone().setY(1.6), new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), 0.4, 3.4, 0.6, OR, 0.25);
    g.fx.burst(start.clone().setY(1.6), OR, 10, 6, 0.3);
    g.hitSphere(start.clone().setY(1.4), 3.3, c, 9, { kb: 3, stun: 0.2, color: OR, skill: true, noCrit: true });
  });
}

const SKILLS: SkillDef[] = [
  { key: 'Z', name: 'Tiger Bite Fist', cost: 0, cd: 4, ai: [3, 14], desc: 'Close in and rake twice with Nen-hardened claws. The second rake knocks back; both bleed.', cast: (g, c) => tiger(g, c) },
  { key: 'X', name: 'Double', cost: 0, cd: 8, ai: [4, 26], desc: 'Project your double behind the enemy. After a beat it strikes from behind while you hit from the front.', cast: (g, c) => double(g, c) },
  { key: 'C', name: 'Gyo Counter', cost: 0, cd: 9, ai: [2, 12], desc: 'Read the aura (1.1s). The first hit is dodged and answered with a launching counter.', cast: (g, c) => sense(g, c) },
  { key: 'V', name: 'True Tiger Bite Fist', cost: 50, cd: 55, ai: [3, 30], desc: 'ULTIMATE (50 energy): rush in, pin the target, and bite from both sides at once with you and your double.', cast: (g, c) => trueBite(g, c) },
  { key: 'F', name: 'Phantom Step', cost: 0, cd: 4, ai: [0, 20], desc: 'Dash away; your double lingers behind and slashes where you stood. Resets your combo.', cast: (g, c) => phantom(g, c) },
];

export const KASTRO: CharDef = {
  kind: 'kastro', name: 'Kastro', title: 'KASTRO', typ: 'Enhancement · Heavens Arena', color: OR, css: '#ff9a2a', hp: 425, speed: 11.0,
  blurb: 'The 200th-floor fighter who nearly beat Hisoka. Deceptive martial artist: Tiger Bite Fist claws, a Nen double that flanks, and a razor counter.',
  meter: { name: 'DOUBLE', color: '#ff9a2a', start: 0, max: 100 },
  passive: { name: 'Double Echo', desc: 'Hits build the Double meter. At full, your next hit is echoed by your double for +14 bonus damage.' },
  gainHit: 3.2, gainHurt: 0.4,
  skills: SKILLS,
  evade(g, vic, att) {
    if ((vic.st.senseT ?? 0) <= 0 || att === vic) return false;
    vic.st.senseT = 0;
    vic.invuln = Math.max(vic.invuln, 0.5);
    vic.castId++;
    g.popup(vic, 'READ!', '#ffb85a', 24);
    g.fx.afterimage(vic.pos, vic.yaw, OR, 0.5);
    g.fx.hitSpark(vic.chestPos(), OW, 2);
    sfx('zap');
    g.later(0.06, () => {
      if (vic.dead || att.dead) return;
      const d = new THREE.Vector3(att.pos.x - vic.pos.x, 0, att.pos.z - vic.pos.z);
      const L = d.length();
      d.normalize();
      vic.faceNow(Math.atan2(d.x, d.z));
      g.dashF(vic, d, Math.max(0, L - 2.2), 0.1);
      g.later(0.14, () => {
        if (vic.dead) return;
        vic.setAnim('palmR', 0.25);
        claws(g, vic, 4);
        sfx('heavy');
        g.hitArc(vic, 5.2, -0.2, 21, { kb: 6, launch: 6, stun: 0.45, heavy: true, bleed: 3, bleedDps: 5, color: OR, skill: true });
      });
    });
    return true;
  },
  onDealt(g, att, vic) {
    if (att.meter >= 99) {
      att.meter = 0;
      g.popup(vic, 'DOUBLE ECHO', '#ffb85a', 20);
      g.fx.afterimage(grnd(vic.pos).addScaledVector(att.forward(), -2.4), att.yaw, OR, 0.5, 0.7);
      g.fx.impact(vic.chestPos(), OR, 1.6);
      g.damage(att, vic, 14, { noMeter: true, noCrit: true, color: OR, heavy: true, kb: 3 });
    }
  },
  m1: m1(0.55, 0.8, [
    S('palmR', 8, 0.25, 0.09, 4.2, { color: OR, trail: 1 }),
    S('palmL', 8, 0.25, 0.09, 4.2, { color: OR, trail: 2 }),
    S('hookR', 9, 0.27, 0.1, 4.2, { color: OR, trail: 1, kb: 1.5 }),
    S('kickR', 9, 0.28, 0.1, 4.4, { color: OR, trail: 3, kb: 2 }),
    S('roundL', 14, 0.4, 0.15, 4.8, { color: OR, trail: 3, arc: -0.2, kb: 7, heavy: true, side: true, shock: 3, lunge: 2.4 }),
  ]),
  m1Air: m1(0.55, 0.8, [
    S('palmR', 8, 0.25, 0.09, 4.1, { color: OR, trail: 1 }),
    S('palmL', 8, 0.25, 0.09, 4.1, { color: OR, trail: 2 }),
    S('kickR', 9, 0.28, 0.1, 4.3, { color: OR, trail: 3, kb: 2 }),
    S('spinKick', 10, 0.32, 0.14, 4.4, { color: OR, trail: 3, arc: -0.3, kb: 3, side: true }),
    S('slamR', 14, 0.42, 0.18, 4.2, { color: OR, arc: 0.0, kb: 2, slam: true, heavy: true, shock: 4.2 }),
  ]),
  m1Mode: 'repeat', m1Range: 4.3,
};
