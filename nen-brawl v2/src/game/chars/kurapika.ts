import * as THREE from 'three';
import type { CharDef, SkillDef } from '../defs';
import type { Game } from '../Game';
import type { Fighter } from '../Fighter';
import { sfx } from '../audio';
import { begin, grnd, rot, m1, S, faceTarget } from './kit';

const CH = 0x9ab8ff;
const RED = 0xff3a3a;
const GLD = 0xffe08a;

const bind = (g: Game, v: Fighter, t = 3.5) => {
  v.st.vulnT = Math.max(v.st.vulnT ?? 0, t);
  g.popup(v, 'BOUND', '#9ab8ff', 18);
};
const em = (c: Fighter) => c.form === 'emperor';
const col = (c: Fighter) => (em(c) ? RED : CH);

function lash(g: Game, c: Fighter) {
  begin(g, c, 'fling', 0.4, 0.4);
  sfx('chain');
  const fan = em(c) ? [-0.18, 0, 0.18] : [0];
  g.after(0.15, c, () => {
    const A = g.aim(c);
    c.faceNow(A.yaw);
    const origin = c.handPos();
    for (const off of fan) {
      const dir = rot(A.dir, off);
      const victims = g.hitBeam(c, origin, dir, 22, 1.3, em(c) ? 13 : 15, { color: col(c), kb: 0, root: 0.6, slow: 2, slowMul: 0.55, skill: true, melee: false });
      const end = victims[0] ? victims[0].chestPos() : origin.clone().addScaledVector(dir, 22);
      g.fx.chain(() => c.handPos(), () => end, col(c), 0.35, 16);
      g.fx.bolt(origin, end, 0xffffff, 0.12, 0.08, 0, 0.3);
      const v = victims[0];
      if (v) {
        bind(g, v);
        const dx = c.pos.x - v.pos.x;
        const dz = c.pos.z - v.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        if (d > 3.2) g.knock(v, dx / d, dz / d, d - 3.2, 0.25);
        g.fx.hitSpark(end, col(c), 2);
        g.addMeter(c, 8);
      }
    }
  });
}

function jail(g: Game, c: Fighter) {
  const A = g.aim(c);
  c.faceNow(A.yaw);
  c.lock = 0.45;
  c.setAnim('castFwd', 0.5);
  const spots: THREE.Vector3[] = [];
  const maxD = 30;
  const p = A.ground.clone();
  const dd = Math.hypot(p.x - c.pos.x, p.z - c.pos.z);
  if (dd > maxD) p.set(c.pos.x + ((p.x - c.pos.x) / dd) * maxD, 0, c.pos.z + ((p.z - c.pos.z) / dd) * maxD);
  g.clampPos(p);
  spots.push(p);
  if (em(c) && A.target) spots.push(grnd(A.target.pos));
  const R = em(c) ? 5.8 : 4.6;
  const color = col(c);
  sfx('chain');
  for (const s of spots) g.fx.telegraph(s, R, color, 0.75);
  g.after(0.75, c, () => {
    sfx('thunder');
    for (const s of spots) {
      const n = 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.28;
        const top = new THREE.Vector3(s.x + Math.cos(a) * R * 0.2, 14, s.z + Math.sin(a) * R * 0.2);
        const bot = new THREE.Vector3(s.x + Math.cos(a) * R * 0.95, 0.4, s.z + Math.sin(a) * R * 0.95);
        g.fx.chain(() => top, () => bot, color, 1.4, 12);
      }
      g.fx.shockwave(s, color, R, 0.5);
      g.fx.pillar(s, color, R * 0.9, 12, 0.7);
      g.fx.dome(s, R, color, 1.5, 0.18);
      g.shake(0.35);
      const vs = g.hitSphere(s.clone().setY(1.5), R, c, 18, { color, root: 1.8, slow: 3, slowMul: 0.5, heavy: true, kb: 0, stun: 0.5, skill: true });
      vs.forEach((v) => { bind(g, v, 4); g.addMeter(c, 10); });
    }
  });
}

function judgment(g: Game, c: Fighter) {
  begin(g, c, 'throwR', 0.4, 0.4);
  sfx('chain');
  g.after(0.15, c, () => {
    const A = g.aim(c);
    c.faceNow(A.yaw);
    g.shoot({
      owner: c, pos: c.handPos().addScaledVector(A.flat, 0.7), dir: A.dir.clone(), speed: 54, radius: 1.3, dmg: 10, life: 0.9, color: RED, size: 0.7, shape: 'knife',
      opts: { kb: 1, color: RED, skill: true },
      onHit: (v, p) => {
        v.st.judgeT = 7;
        g.fx.hitSpark(p, RED, 2.4);
        g.fx.chain(() => c.handPos(), () => v.chestPos(), RED, 0.8, 16);
        g.fx.orbit(() => v.pos, 6, 1.4, RED, 7, 0.22, 2.6, 3);
        g.popup(v, 'JUDGMENT CHAIN', '#ff5a5a', 22);
        g.addMeter(c, 15);
        sfx('thunder');
      },
    });
  });
}

function emperor(g: Game, c: Fighter) {
  c.lock = 0.9;
  c.invuln = Math.max(c.invuln, 0.9);
  c.setAnim('summon', 0.9);
  sfx('thunder');
  g.flash('#ff2020', 0.35);
  g.fx.pillar(c.pos, RED, 2.2, 30, 1.0);
  g.fx.shockwave(grnd(c.pos), RED, 11, 0.7);
  g.popup(c, 'EMPEROR TIME', '#ff5a5a', 30);
  g.shake(0.5);
  // the price: part of your life
  c.hp = Math.max(1, c.hp - c.maxHp * 0.08);
  g.after(0.5, c, () => {
    g.setForm(c, 'emperor', 18);
    c.speedMult = 1.2;
    c.buffDmg = 1.25;
    c.atkSpeed = 1.15;
    c.rangeMult = 1.1;
    c.st.cdRate = 0.9;
    c.dashCd = 0;
  });
}

function grapple(g: Game, c: Fighter) {
  const A = g.aim(c);
  const t = A.target && Math.hypot(A.target.pos.x - c.pos.x, A.target.pos.z - c.pos.z) < 34 ? A.target : null;
  c.faceNow(A.yaw);
  c.lock = 0.5;
  c.setAnim('fling', 0.4);
  sfx('chain');
  const dest = t ? t.pos.clone() : A.ground.clone();
  const d0 = Math.hypot(dest.x - c.pos.x, dest.z - c.pos.z);
  if (!t && d0 > 24) dest.set(c.pos.x + ((dest.x - c.pos.x) / d0) * 24, 0, c.pos.z + ((dest.z - c.pos.z) / d0) * 24);
  const anchor = dest.clone().setY(t ? 1.8 : 0.3);
  g.fx.chain(() => c.handPos(), () => anchor, col(c), 0.45, 16);
  g.after(0.12, c, () => {
    const dir = new THREE.Vector3(dest.x - c.pos.x, 0, dest.z - c.pos.z);
    const L = dir.length();
    if (L < 1) return;
    dir.normalize();
    c.faceNow(Math.atan2(dir.x, dir.z));
    g.dashF(c, dir, Math.max(0, L - (t ? 2.4 : 0)), 0.26);
    c.vy = Math.max(c.vy, 7);
    c.onGround = false;
    c.invuln = Math.max(c.invuln, 0.3);
    g.trail(c, 3, col(c), 0.4, 0.5);
    sfx('dash');
  });
  if (t) {
    g.after(0.4, c, () => {
      if (t.dead) return;
      faceTarget(c, t);
      c.setAnim('kickR', 0.3);
      g.hitArc(c, 4.6, -0.1, 11, { kb: 4, stun: 0.4, color: col(c), heavy: true, skill: true });
    });
  }
}

const SKILLS: SkillDef[] = [
  { key: 'Z', name: 'Holy Chain: Lash', cost: 0, cd: 8, ai: [4, 24], desc: 'Whip a steel chain at the cursor: damages, slows, BINDS and drags the target toward you. Emperor Time = 3 chains.', cast: (g, c) => lash(g, c) },
  { key: 'X', name: 'Chain Jail', cost: 0, cd: 12, ai: [4, 26], desc: 'Mark the ground at the cursor; chains erupt and imprison everyone inside (root + damage). Emperor Time = bigger, double jail.', cast: (g, c) => jail(g, c) },
  { key: 'C', name: 'Judgment Chain', cost: 0, cd: 16, ai: [3, 22], desc: 'Fire a heart-piercing chain. If the marked enemy uses ANY skill or dash within 7s, they take 30 damage.', cast: (g, c) => judgment(g, c) },
  {
    key: 'V', name: 'Emperor Time', cost: 50, cd: 75, ai: [0, 30], can: (_g, c) => !c.form,
    desc: 'ULTIMATE (50 energy, costs 8% HP): Scarlet Eyes. 18s of +speed, +25% damage, rapid cooldowns and upgraded chains.', cast: (g, c) => emperor(g, c),
  },
  { key: 'F', name: 'Grapple Chain', cost: 0, cd: 6, ai: [8, 28], desc: 'Fire a chain at the cursor and reel yourself there. Targeting an enemy ends with a kick.', cast: (g, c) => grapple(g, c) },
];

export const KURAPIKA: CharDef = {
  kind: 'kurapika', name: 'Kurapika', title: 'KURAPIKA', typ: 'Conjuration · Chain controller', color: CH, css: '#9ab8ff', hp: 400, speed: 10.8,
  blurb: 'Traps and controls with conjured chains, then enters Emperor Time with Scarlet Eyes for ferocious burst.',
  meter: { name: 'CHAIN', color: '#7a9cff', start: 0, max: 100 },
  passive: { name: 'Chain User', desc: 'Chain hits BIND enemies (+12% damage taken). Below 35% HP the Scarlet Eyes awaken: +20% damage. Chain hits and M1s build the Chain meter.' },
  gainHit: 0.45, gainHurt: 0.3,
  skills: SKILLS,
  dmgBonus: (c) => (c.hp / c.maxHp < 0.35 ? 1.2 : 1),
  onDealt(_g, att, vic, _a, o) {
    if (o.melee && !o.dot && em(att)) vic.st.vulnT = Math.max(vic.st.vulnT ?? 0, 2);
  },
  m1: m1(0.9, 0.8, [
    S('jabR', 7, 0.26, 0.09, 3.8, { color: CH, trail: 1 }),
    S('jabL', 7, 0.26, 0.09, 3.8, { color: CH, trail: 2 }),
    S('kickR', 8, 0.28, 0.11, 4.2, { kb: 1.5, color: CH, trail: 3 }),
    S('roundL', 9, 0.3, 0.12, 4.2, { arc: -0.1, kb: 3.5, color: CH, trail: 3, side: true }),
    S('slashSide', 12, 0.4, 0.15, 5.0, { arc: -0.1, kb: 8, color: GLD, trail: 1, heavy: true, lunge: 2.6 }),
  ]),
  m1Air: m1(0.7, 0.8, [
    S('jabR', 7, 0.26, 0.09, 3.8, { color: CH, trail: 1 }),
    S('jabL', 7, 0.26, 0.09, 3.8, { color: CH, trail: 2 }),
    S('roundR', 8, 0.28, 0.11, 4.0, { arc: -0.1, kb: 3, color: CH, trail: 3, side: true }),
    S('spinKick', 9, 0.32, 0.15, 4.3, { arc: -0.3, kb: 3.5, color: CH, trail: 3 }),
    S('slamL', 13, 0.42, 0.18, 4.3, { arc: 0.0, kb: 2, slam: true, color: GLD, heavy: true, shock: 4.5 }),
  ]),
  m1Mode: 'repeat', m1Range: 4.0,
};
