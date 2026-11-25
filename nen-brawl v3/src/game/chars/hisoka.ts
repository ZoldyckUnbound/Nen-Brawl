import * as THREE from 'three';
import type { CharDef, SkillDef } from '../defs';
import type { Game } from '../Game';
import type { Fighter } from '../Fighter';
import { sfx } from '../audio';
import { begin, grnd, rot, rnd, m1, S, faceTarget } from './kit';

const PK = 0xff4f9a;
const RD = 0xff3a5a;
const GUM = 0xff8ac8;

function cards(g: Game, c: Fighter, ch: number) {
  begin(g, c, 'fling', 0.38, 0.38);
  sfx('card');
  g.fx.burst(c.handPos(), PK, 6, 4, 0.25);
  g.after(0.14, c, () => {
    const A = g.aim(c);
    c.faceNow(A.yaw);
    const n = 3 + Math.floor(ch * 4);
    const spread = 0.1 + ch * 0.12;
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2 * spread * n * 0.5;
      g.shoot({
        owner: c, pos: c.handPos().addScaledVector(A.flat, 0.5), dir: rot(A.dir, off), speed: 56, radius: 0.9, dmg: 8 + ch * 2, life: 0.85, color: i % 2 ? PK : RD, size: 0.8,
        shape: 'card', opts: { kb: 1.2, color: PK, skill: true }, onHit: (_v, p) => g.fx.hitSpark(p, PK, 1.4),
      });
    }
    sfx('card');
  });
}

function bungee(g: Game, c: Fighter) {
  begin(g, c, 'throwR', 0.4, 0.5);
  sfx('chain');
  g.after(0.14, c, () => {
    const A = g.aim(c);
    c.faceNow(A.yaw);
    g.shoot({
      owner: c, pos: c.handPos().addScaledVector(A.flat, 0.6), dir: A.dir.clone(), speed: 54, radius: 1.3, dmg: 9, life: 0.7, color: GUM, size: 0.6, shape: 'hook',
      opts: { color: GUM, kb: 0, skill: true },
      onHit: (v) => {
        g.fx.tether(() => c.handPos(), () => v.chestPos(), GUM, 0.7, 0.2);
        g.popup(v, 'BUNGEE GUM', '#ff8ac8', 20);
        g.applySlow(v, 3, 0.65);
        const dx = c.pos.x - v.pos.x;
        const dz = c.pos.z - v.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        c.lock = Math.max(c.lock, 0.7);
        if (d > 9) {
          g.dashF(c, new THREE.Vector3(-dx / d, 0, -dz / d), d - 2.5, 0.22);
          g.trail(c, 3, GUM, 0.3, 0.5);
        } else {
          g.stunFighter(v, 0.55);
          g.knock(v, dx / d, dz / d, Math.max(0, d - 2.4), 0.2);
        }
        g.after(0.28, c, () => {
          if (v.dead) return;
          faceTarget(c, v);
          c.setAnim('palmR', 0.3);
          g.hitArc(c, 4.8, -0.2, 15, { kb: 5, launch: 5, stun: 0.4, color: GUM, heavy: true, skill: true });
          g.fx.explosion(v.chestPos(), GUM, 2, 0.3);
          g.addMeter(c, 8);
        });
      },
    });
  });
}

function texture(g: Game, c: Fighter) {
  const A = g.aim(c);
  c.faceNow(A.yaw);
  c.lock = 0.35;
  c.setAnim('leap', 0.4);
  sfx('card');
  const spot = grnd(c.pos);
  const decoyYaw = c.yaw;
  const R = 5.8;
  g.fx.afterimage(c.pos, c.yaw, PK, 1.5, 0.55);
  g.fx.telegraph(spot, R, PK, 1.4);
  g.fx.orbit(() => spot.clone(), 5, 1.2, PK, 1.4, 0.25, 2.4, 3);
  // slip away along the bungee
  const near = A.target && Math.hypot(A.target.pos.x - c.pos.x, A.target.pos.z - c.pos.z) < 7;
  const dir = near ? A.flat.clone().multiplyScalar(-1) : A.flat.clone();
  g.after(0.05, c, () => {
    g.dashF(c, dir, 10, 0.2);
    c.vy = 8;
    c.onGround = false;
    c.invuln = Math.max(c.invuln, 0.3);
    g.fx.tether(() => c.chestPos(), () => spot.clone().setY(1.8), GUM, 0.3, 0.14);
    g.trail(c, 3, PK, 0.35, 0.5);
  });
  g.later(1.4, () => {
    g.fx.afterimage(spot, decoyYaw, 0xffffff, 0.2, 0.7);
    g.fx.explosion(spot.clone().setY(1.5), PK, R * 0.7, 0.5);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * 6.28;
      g.shoot({ owner: c, pos: spot.clone().setY(1.6), dir: new THREE.Vector3(Math.cos(a), 0.05, Math.sin(a)), speed: 34, radius: 0.8, dmg: 5, life: 0.4, color: i % 2 ? PK : RD, size: 0.8, shape: 'card', opts: { color: PK, noCrit: true } });
    }
    g.shake(0.35);
    sfx('boom');
    g.hitSphere(spot.clone().setY(1.5), R, c, 24, { kb: 7, heavy: true, color: PK, stun: 0.3, skill: true });
    g.addMeter(c, 10);
  });
  return 14;
}

function finale(g: Game, c: Fighter) {
  const A = g.aim(c);
  const t = A.target ?? g.target(c, 30);
  c.lock = 2.4;
  c.invuln = Math.max(c.invuln, 0.6);
  c.faceNow(A.yaw);
  c.setAnim('throwR', 0.4);
  sfx('chain');
  g.popup(c, 'MAGICIAN’S FINALE', '#ff7ab8', 26);
  g.flash('#ff4f9a', 0.25);
  if (!t) return 8;
  g.fx.tether(() => c.handPos(), () => t.chestPos(), GUM, 0.55, 0.22);
  g.after(0.3, c, () => {
    if (t.dead) return;
    const d = new THREE.Vector3(t.pos.x - c.pos.x, 0, t.pos.z - c.pos.z);
    const L = d.length();
    d.normalize();
    g.dashF(c, d, Math.max(0, L - 2.4), 0.2);
    g.stunFighter(t, 1.5, true);
    g.trail(c, 3, GUM, 0.3, 0.7);
  });
  const anims = ['jabR', 'hookL', 'bodyR', 'upperL', 'kickR', 'palmL'];
  for (let i = 0; i < 6; i++)
    g.after(0.6 + i * 0.18, c, () => {
      if (t.dead) return;
      faceTarget(c, t);
      c.setAnim(anims[i], 0.2);
      sfx('swing');
      g.hitArc(c, 5, -0.2, 7, { kb: 0.3, color: i % 2 ? PK : RD, noCrit: true, skill: true });
      g.fx.hitSpark(t.chestPos(), PK, 1.4);
      g.fx.burst(t.chestPos(), RD, 6, 7, 0.3);
    });
  g.after(1.85, c, () => {
    if (t.dead) return;
    faceTarget(c, t);
    c.setAnim('slamR', 0.4);
    const p = grnd(t.pos);
    g.fx.telegraph(p, 7, PK, 0.45);
    g.after(0.45, c, () => {
      g.flash('#ffd0ea', 0.5);
      g.fx.explosion(p.clone().setY(1.6), PK, 7, 0.7);
      g.fx.pillar(p, PK, 3, 30, 0.6);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * 6.28;
        g.shoot({ owner: c, pos: p.clone().setY(1.8), dir: new THREE.Vector3(Math.cos(a), 0.1, Math.sin(a)), speed: 38, radius: 0.8, dmg: 4, life: 0.5, color: i % 2 ? PK : RD, size: 0.9, shape: 'card', opts: { color: PK, noCrit: true } });
      }
      g.shake(1);
      sfx('boom');
      g.hitSphere(p.clone().setY(1.5), 7, c, 32, { kb: 11, launch: 10, stun: 0.9, heavy: true, color: PK, breakGuard: true });
    });
  });
  return 70;
}

function elastic(g: Game, c: Fighter) {
  const A = g.aim(c);
  c.faceNow(A.yaw);
  c.setAnim('leap', 0.5);
  c.lock = 0.2;
  const anchor = grnd(c.pos).addScaledVector(A.flat, 4).setY(0.3);
  sfx('chain');
  g.fx.tether(() => c.handPos(), () => anchor, GUM, 0.35, 0.16);
  g.after(0.08, c, () => {
    c.vy = 22;
    c.onGround = false;
    c.coyote = 0;
    c.forced = { vx: A.flat.x * 14, vz: A.flat.z * 14, t: 1.4, T: 1.4, ease: false, land: true };
    c.invuln = Math.max(c.invuln, 0.2);
    g.trail(c, 3, GUM, 0.9, 0.5);
    g.fx.shockwave(grnd(c.pos), GUM, 3, 0.3);
    c.onLand = {
      t: 3,
      fn: () => {
        const p = grnd(c.pos);
        g.fx.shockwave(p, PK, 4.5, 0.4);
        g.hitSphere(p, 4, c, 7, { kb: 3, stun: 0.3, color: PK });
        c.forced = null;
        c.anim = null;
      },
    };
  });
}

const SKILLS: SkillDef[] = [
  { key: 'Z', name: 'Trump Cards', cost: 0, cd: 6, charge: 1.0, chargeAnim: 'charge', ai: [4, 30], desc: 'Fling a fan of razor cards. HOLD to throw more (up to 7).', cast: (g, c, ch) => cards(g, c, ch) },
  { key: 'X', name: 'Bungee Gum', cost: 0, cd: 10, ai: [4, 28], desc: 'Stick gum to an enemy: if far you rocket to them, if close you yank them in — then punish with a launching strike. Slows.', cast: (g, c) => bungee(g, c) },
  { key: 'C', name: 'Texture Surprise', cost: 0, cd: 14, ai: [0, 30], desc: 'Leave a false image of yourself and slip away. It detonates in a card burst after 1.4s — lure them in!', cast: (g, c) => texture(g, c) },
  { key: 'V', name: "Magician's Finale", cost: 55, cd: 70, ai: [0, 26], desc: 'ULTIMATE (55 energy): gum-snare the enemy, rip into them with a 6-hit flurry and finish with a Joker card explosion.', cast: (g, c) => finale(g, c) },
  { key: 'F', name: 'Elastic Leap', cost: 0, cd: 5, ai: [6, 30], desc: 'Bungee-gum spring: a huge leap toward the cursor with a landing shockwave.', cast: (g, c) => elastic(g, c) },
];

export const HISOKA: CharDef = {
  kind: 'hisoka', name: 'Hisoka', title: 'HISOKA MOROW', typ: 'Transmutation · Trickster', color: PK, css: '#ff4f9a', hp: 420, speed: 10.6,
  blurb: 'A fighting magician: cards, elastic bungee gum, traps and a finale that shreds. Grows deadlier as the fight heats up.',
  meter: { name: 'BLOODLUST', color: '#ff4f9a', start: 0, max: 100 },
  passive: { name: 'Bloodlust', desc: 'Hits and damage taken build Bloodlust: up to +20% damage. It slowly fades if you stop fighting.' },
  gainHit: 0.7, gainHurt: 0.5,
  skills: SKILLS,
  dmgBonus: (c) => 1 + (c.meter / 100) * 0.2,
  update(g, c, dt) {
    c.st.idle = (c.st.idle ?? 0) + dt;
    if (c.meter > 0 && c.st.idle > 4) c.meter = Math.max(0, c.meter - 2 * dt);
    if (c.meter >= 99 && Math.random() < dt * 10) g.fx.aura(c.pos, PK, 1, 3.2, 0.8);
  },
  onDealt(_g, att) {
    att.st.idle = 0;
  },
  m1: m1(0.9, 0.8, [
    S('jabR', 8, 0.28, 0.1, 3.9, { color: PK, trail: 1 }),
    S('hookL', 8, 0.28, 0.11, 3.9, { arc: 0.0, kb: 1.8, color: PK, trail: 2, recoil: true }),
    S('kneeR', 9, 0.3, 0.12, 3.9, { kb: 1.5, color: RD, trail: 3, lunge: 2.2 }),
    S('upperL', 10, 0.3, 0.12, 3.9, { launch: 8.5, kb: 0.5, color: PK, trail: 2, hop: 6 }),
    S('roundR', 13, 0.42, 0.16, 4.6, { arc: -0.2, kb: 8, color: RD, trail: 3, heavy: true, side: true, shock: 3 }),
  ]),
  m1Air: m1(0.8, 0.8, [
    S('jabR', 8, 0.28, 0.1, 3.9, { color: PK, trail: 1 }),
    S('hookL', 8, 0.28, 0.1, 3.9, { arc: 0.0, kb: 1.5, color: PK, trail: 2 }),
    S('kickR', 9, 0.3, 0.12, 4.1, { kb: 2, color: RD, trail: 3 }),
    S('spinKick', 10, 0.34, 0.16, 4.4, { arc: -0.3, kb: 4, color: PK, trail: 3, side: true }),
    S('slamR', 14, 0.45, 0.2, 4.2, { arc: 0.0, kb: 2, slam: true, color: RD, heavy: true, shock: 4.5 }),
  ]),
  m1Mode: 'repeat', m1Range: 4.2,
};
void rnd;
