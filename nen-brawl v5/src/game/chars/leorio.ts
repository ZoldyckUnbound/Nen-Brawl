import * as THREE from 'three';
import type { CharDef, SkillDef } from '../defs';
import type { Game } from '../Game';
import type { Fighter } from '../Fighter';
import { sfx } from '../audio';
import { begin, grnd, rnd, rot, m1, S } from './kit';

const GOLD = 0xffd36a;
const SK = 0xf6c9a0;

function fistHit(g: Game, big: number) {
  return (v: Fighter, p: THREE.Vector3) => {
    g.fx.explosion(p, GOLD, 1.8 + big, 0.35);
    g.fx.vring(p, new THREE.Vector3(0, 0, 1), 0xffffff, 0.5, 2.5 + big, 0.25);
    g.shake(0.2 + big * 0.1);
    void v;
  };
}

function remotePunch(g: Game, c: Fighter, ch: number) {
  const A = begin(g, c, 'fling', 0.42, 0.42);
  sfx('charge');
  const hp = c.handPos();
  g.fx.gather(hp, GOLD, 2, 8);
  g.fx.ring(grnd(c.pos), GOLD, 0.5, 3.5, 0.3);
  g.after(0.18, c, () => {
    const A2 = g.aim(c);
    c.faceNow(A2.yaw);
    sfx('boom');
    g.shoot({
      owner: c, pos: c.handPos().addScaledVector(A2.flat, 0.8), dir: A2.dir.clone(), speed: 36 - ch * 8, radius: 1.6 + ch, dmg: 18 + ch * 20, life: 1.25,
      color: GOLD, size: 1.2 + ch * 1.0, shape: 'fist', opts: { kb: 9 + ch * 7, stun: 0.35, heavy: true, color: GOLD, skill: true },
      onHit: fistHit(g, ch), onEnd: (p, why) => { if (why === 'ground') g.fx.shockwave(grnd(p), GOLD, 3 + ch * 2, 0.35); },
    });
  });
  void A;
}

function briefcase(g: Game, c: Fighter) {
  begin(g, c, 'throwL', 0.4, 0.4);
  sfx('swing');
  const cs = c.rig.props.case;
  g.after(0.16, c, () => {
    const A = g.aim(c);
    c.faceNow(A.yaw);
    if (cs) cs.visible = false;
    g.shoot({
      owner: c, pos: c.handLPos().addScaledVector(A.flat, 0.6), dir: A.dir.clone(), speed: 44, radius: 1.7, dmg: 13, life: 1.2, color: 0xc9a24a, size: 0.9, shape: 'case',
      pierce: true, boomerang: true, opts: { kb: 3, stun: 0.12, color: 0xc9a24a, skill: true },
      onHit: (_v, p) => g.fx.hitSpark(p, 0xffe6a0, 1.6),
      onEnd: () => { if (cs) cs.visible = true; },
    });
  });
  return 10;
}

function rapid(g: Game, c: Fighter) {
  c.lock = 1.15;
  sfx('charge');
  const n = 7;
  for (let i = 0; i < n; i++)
    g.after(0.12 + i * 0.12, c, () => {
      const A = g.aim(c);
      c.faceNow(A.yaw);
      c.setAnim(i % 2 ? 'jabL' : 'jabR', 0.16);
      const last = i === n - 1;
      const d = rot(A.dir, rnd(-0.07, 0.07));
      g.shoot({
        owner: c, pos: (i % 2 ? c.handLPos() : c.handPos()).addScaledVector(A.flat, 0.6), dir: d, speed: 46, radius: last ? 1.5 : 1.0, dmg: last ? 16 : 7, life: 0.9,
        color: GOLD, size: last ? 1.1 : 0.7, shape: 'fist', opts: { kb: last ? 9 : 1.5, stun: last ? 0.5 : 0.05, heavy: last, color: GOLD, noCrit: !last, skill: true }, onHit: fistHit(g, last ? 0.4 : 0),
      });
      sfx('swing');
    });
}

function boost(g: Game, c: Fighter) {
  const A = begin(g, c, 'rock', 0.5, 0.5);
  sfx('boom');
  const back = c.pos.clone().addScaledVector(A.flat, -2.5).setY(1.4);
  g.fx.explosion(back, GOLD, 1.8, 0.3);
  g.fx.beam(back, c.chestPos(), GOLD, 0.6, 0.15);
  const up = Math.max(0, A.dir.y);
  g.after(0.06, c, () => {
    c.vy = Math.max(c.vy, up * 16);
    if (up > 0.2) c.onGround = false;
    g.dashF(c, A.flat, 12, 0.22);
    g.trail(c, 1, GOLD, 0.35, 0.8);
    g.fx.dust(grnd(c.pos), 6, 4);
  });
  g.after(0.24, c, () => {
    const f = c.forward();
    const hits = g.hitArc(c, 5, 0.0, 15, { kb: 8, stun: 0.4, heavy: true, color: GOLD });
    g.fx.explosion(c.chestPos().addScaledVector(f, 2.5), GOLD, hits.length ? 2.5 : 1.4, 0.3);
    g.shake(0.3);
  });
}

function doctorsOrders(g: Game, c: Fighter) {
  c.lock = 1.9;
  c.invuln = Math.max(c.invuln, 1.0);
  c.setAnim('summon', 1.0);
  sfx('charge');
  g.fx.orbit(() => c.pos, 8, 3, GOLD, 1.2, 0.45, 2.4, 5);
  g.fx.shockwave(grnd(c.pos), 0x9fffb0, 7, 0.7);
  g.fx.pillar(c.pos, 0x9fffb0, 2, 14, 0.8);
  g.popup(c, "DOCTOR'S ORDERS", '#ffe08a', 26);
  for (let i = 0; i < 6; i++) g.after(0.1 + i * 0.15, c, () => g.heal(c, c.maxHp * 0.025));
  const n = 9;
  for (let i = 0; i < n; i++)
    g.after(1.05 + i * 0.1, c, () => {
      const A = g.aim(c);
      const t = A.target ?? g.target(c, 40);
      c.faceNow(A.yaw);
      c.setAnim(i % 2 ? 'jabL' : 'jabR', 0.15);
      const a = (i / n) * 6.28;
      const start = c.pos.clone().add(new THREE.Vector3(Math.cos(a) * 3, 3.2, Math.sin(a) * 3));
      const last = i === n - 1;
      g.shoot({
        owner: c, pos: start, dir: t ? t.chestPos().sub(start).normalize() : A.dir.clone(), speed: 38, radius: last ? 2 : 1.3, dmg: last ? 24 : 10, life: 1.4,
        color: GOLD, size: last ? 1.5 : 0.9, shape: 'fist', homing: t ? { target: t, rate: 4 } : undefined,
        opts: { kb: last ? 12 : 2, stun: last ? 0.8 : 0.1, heavy: last, color: GOLD, noCrit: !last, skill: true }, onHit: fistHit(g, last ? 0.8 : 0.1),
      });
      sfx('swing');
    });
}

const SKILLS: SkillDef[] = [
  {
    key: 'Z', name: 'Remote Punch', cost: 0, cd: 7, charge: 1.2, chargeAnim: 'chargePalm', ai: [4, 30],
    desc: 'Emit a huge Nen fist at the cursor. HOLD for a bigger, harder-hitting fist with heavy knockback.', cast: (g, c, ch) => remotePunch(g, c, ch),
  },
  {
    key: 'X', name: 'Briefcase Boomerang', cost: 0, cd: 10, ai: [3, 24],
    desc: 'Hurl the briefcase — it hits on the way out AND on the way back.', cast: (g, c) => briefcase(g, c),
  },
  {
    key: 'C', name: 'Rapid Remote Fists', cost: 0, cd: 13, ai: [3, 26],
    desc: 'Emit a rapid barrage of fists, the last one hits very hard and stuns.', cast: (g, c) => rapid(g, c),
  },
  {
    key: 'V', name: "Doctor's Orders", cost: 55, cd: 60, ai: [0, 28],
    desc: 'ULTIMATE (55 energy): summon nine floating fists, heal yourself, then unleash all of them as homing Remote Punches.', cast: (g, c) => doctorsOrders(g, c),
  },
  {
    key: 'F', name: 'Remote Boost', cost: 0, cd: 6, ai: [6, 20],
    desc: 'Emit a fist behind you to rocket forward (aim up to launch) — ends with a rocket punch.', cast: (g, c) => boost(g, c),
  },
];

export const LEORIO: CharDef = {
  kind: 'leorio', name: 'Leorio', title: 'LEORIO PARADINIGHT', typ: 'Emission · Remote fist zoner', color: GOLD, css: '#ffd36a', hp: 430, speed: 10.0,
  blurb: 'Emits giant Nen fists from afar, can heal himself and fights harder when cornered. A medic who hits like a truck.',
  meter: { name: 'FOCUS', color: '#ffd36a', start: 0, max: 100 },
  passive: { name: "Medic's Resolve", desc: 'Landing hits builds Focus. At full Focus you patch yourself up (heal 8% max HP). Below 35% HP, deal +15% damage.' },
  gainHit: 0.6, gainHurt: 0.25,
  skills: SKILLS,
  dmgBonus: (c) => (c.hp / c.maxHp < 0.35 ? 1.15 : 1),
  onDealt(g, att) {
    if (att.meter >= 99) {
      att.meter = 0;
      g.heal(att, att.maxHp * 0.08);
      g.fx.pillar(att.pos, 0x9fffb0, 1.6, 10, 0.5);
      g.popup(att, 'FIRST AID', '#9fffb0', 20);
    }
  },
  m1: m1(0.9, 0.8, [
    S('jabR', 8, 0.28, 0.1, 3.8, { color: GOLD, trail: 1 }),
    S('jabL', 8, 0.28, 0.1, 3.8, { color: GOLD, trail: 2 }),
    S('hookR', 9, 0.3, 0.12, 3.9, { arc: 0.0, kb: 2.5, color: GOLD, trail: 1, recoil: true }),
    S('bodyL', 9, 0.3, 0.12, 3.9, { kb: 1.8, color: GOLD, trail: 2 }),
    S('rock', 14, 0.45, 0.2, 4.4, { kb: 9, lunge: 3, color: GOLD, trail: 1, heavy: true, shock: 3 }),
  ]),
  m1Air: m1(0.8, 0.8, [
    S('jabR', 8, 0.28, 0.1, 3.8, { color: GOLD, trail: 1 }),
    S('jabL', 8, 0.28, 0.1, 3.8, { color: GOLD, trail: 2 }),
    S('kickR', 9, 0.3, 0.12, 4.0, { kb: 2, color: GOLD, trail: 3 }),
    S('spinKick', 10, 0.34, 0.16, 4.3, { arc: -0.3, kb: 4, color: GOLD, trail: 3, side: true }),
    S('slamR', 14, 0.45, 0.2, 4.2, { arc: 0.0, kb: 2, slam: true, color: GOLD, heavy: true, shock: 4.5 }),
  ]),
  m1Mode: 'repeat', m1Range: 4.2,
};
void SK;
