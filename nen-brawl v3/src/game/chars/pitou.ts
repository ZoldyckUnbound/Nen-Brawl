import * as THREE from 'three';
import type { CharDef, SkillDef } from '../defs';
import type { Game } from '../Game';
import type { Fighter } from '../Fighter';
import { sfx } from '../audio';
import { begin, grnd, m1, S, rnd } from './kit';
import { buildPuppeteer, buildBlythe, setOpacity, disposeObj } from './props';

const PK = 0xff6aa8;
const MINT = 0x6af0c0;

/** Z – Razor Claws: rush through the enemy in a blur of slashes */
function claws(g: Game, c: Fighter) {
  const A = begin(g, c, 'crouch', 0.3, 0.9);
  sfx('dash');
  const t = A.target ?? g.target(c, 18);
  g.after(0.1, c, () => {
    if (t && !t.dead) {
      const d = new THREE.Vector3(t.pos.x - c.pos.x, 0, t.pos.z - c.pos.z);
      const L = d.length();
      d.normalize();
      c.faceNow(Math.atan2(d.x, d.z));
      g.fx.afterimage(c.pos, c.yaw, PK);
      g.fx.speedLines(c.chestPos(), d, PK, 10, 6, 0.3);
      g.dashF(c, d, Math.max(0, Math.min(L - 1.8, 13)), 0.1);
    }
  });
  const n = 6;
  for (let i = 0; i < n; i++)
    g.after(0.22 + i * 0.08, c, () => {
      const tt = t && !t.dead ? t : g.target(c, 8);
      if (tt) c.faceNow(Math.atan2(tt.pos.x - c.pos.x, tt.pos.z - c.pos.z));
      const f = c.forward();
      const last = i === n - 1;
      c.setAnim(i % 2 ? 'slashL' : 'slashR', 0.1);
      g.fx.slashArc(c.chestPos().addScaledVector(f, 1.8), f, rnd(-1.2, 1.2), 3.6, 0.5, i % 2 ? 0xffffff : PK, 0.18);
      const hits = g.hitArc(c, 4.6, -0.1, last ? 14 : 5, { kb: last ? 9 : 0.3, launch: last ? 8 : 0, stun: last ? 0.5 : 0.1, heavy: last, color: PK, noCrit: !last, skill: true, bleed: last ? 3 : 0, bleedDps: 4 });
      hits.forEach((v) => g.fx.impact(v.chestPos(), PK, last ? 1.8 : 0.8, f));
      sfx(last ? 'heavy' : 'slash');
      if (last) g.shake(0.35);
    });
}

/** X – Puppeteer's Strings */
function strings(g: Game, c: Fighter) {
  const A = begin(g, c, 'castUp', 0.6, 0.6);
  sfx('charge');
  const t = A.target ?? g.target(c, 34);
  if (!t) return;
  const P = buildPuppeteer();
  P.scale.setScalar(0.5);
  g.fx.custom(P, 1.9, (p) => {
    P.position.set(t.pos.x, 3.5 + Math.sin(p * 9) * 0.3, t.pos.z).addScaledVector(new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw)), 3.5);
    P.rotation.y = Math.atan2(t.pos.x - P.position.x, t.pos.z - P.position.z);
    setOpacity(P, Math.min(1, p * 6) * Math.min(1, (1 - p) * 4));
  }, () => disposeObj(P));
  for (let i = 0; i < 6; i++) {
    const off = new THREE.Vector3(rnd(-0.9, 0.9), rnd(-1.2, 1.2), rnd(-0.9, 0.9));
    g.fx.tether(() => P.position.clone().add(new THREE.Vector3(rnd(-0.1, 0.1), 7.5 * 0.5, 0)), () => t.chestPos().add(off), 0xffa0d0, 1.8, 0.05);
  }
  g.after(0.35, c, () => {
    if (t.dead) return;
    g.stunFighter(t, 1.1, true);
    t.root_ = Math.max(t.root_, 1.1);
    g.popup(t, 'PUPPETEER', '#ffb0d8', 22);
    g.fx.chain(() => c.handPos(), () => t.chestPos(), PK, 1.2, 14);
  });
  for (let i = 0; i < 4; i++)
    g.later(0.55 + i * 0.2, () => {
      if (t.dead) return;
      const from = P.position.clone().add(new THREE.Vector3(rnd(-2, 2), 4, rnd(-2, 2)));
      g.fx.flashAt(from, PK, 1.4, 0.12);
      g.shoot({
        owner: c, pos: from, dir: t.chestPos().sub(from).normalize(), speed: 42, radius: 1.1, dmg: i === 3 ? 18 : 11, life: 1.2, color: PK, size: 0.9, shape: 'wisp', homing: { target: t, rate: 6 },
        opts: { kb: i === 3 ? 8 : 1, stun: i === 3 ? 0.4 : 0.05, heavy: i === 3, color: PK, noCrit: true, skill: true },
        onHit: (_v, p) => g.fx.impact(p, PK, i === 3 ? 1.8 : 1),
      });
      sfx('slash');
    });
}

/** C – Doctor Blythe: root yourself, call the surgeon doll and heal */
function blythe(g: Game, c: Fighter) {
  c.lock = 2.3;
  c.setAnim('summon', 1.0);
  c.dmgTaken = 0.55;
  sfx('charge');
  g.popup(c, 'DOCTOR BLYTHE', '#9affd8', 24);
  const B = buildBlythe();
  const side = new THREE.Vector3(Math.cos(c.yaw), 0, -Math.sin(c.yaw));
  g.fx.custom(B, 2.4, (p, dt) => {
    B.position.set(c.pos.x, 0, c.pos.z).addScaledVector(side, 2.6);
    B.rotation.y = c.yaw;
    B.scale.setScalar(0.7 * Math.min(1, p * 6));
    setOpacity(B, Math.min(1, p * 5) * Math.min(1, (1 - p) * 5));
    if (Math.random() < dt * 20) g.fx.aura(B.position, MINT, 1, 5, 1.2);
  }, () => disposeObj(B));
  g.fx.dome(grnd(c.pos), 4.5, MINT, 2.2, 0.16);
  g.fx.ring(grnd(c.pos), MINT, 1, 5, 0.6);
  for (let i = 0; i < 10; i++)
    g.after(0.2 + i * 0.2, c, () => {
      g.heal(c, c.maxHp * 0.022);
      g.fx.burst(c.chestPos(), MINT, 6, 4, 0.5);
      if (i % 3 === 0) g.fx.ring(grnd(c.pos), MINT, 0.5, 3.4, 0.4);
    });
  g.later(2.3, () => {
    c.dmgTaken = c.form === 'terps' ? 1 : 1;
  });
}

/** V – Terpsichora: Dance Beyond the Limit */
function terpsichora(g: Game, c: Fighter) {
  c.lock = 1.3;
  c.invuln = Math.max(c.invuln, 1.0);
  c.setAnim('summon', 1.0);
  sfx('charge');
  g.popup(c, 'TERPSICHORA — DANCE BEYOND THE LIMIT', '#ffb0d8', 24);
  g.flash('#ff6aa8', 0.35);
  g.fx.beamColumn(grnd(c.pos), PK, 3, 18, 1.0);
  g.fx.shockwave(grnd(c.pos), PK, 10, 0.7);
  g.shake(0.5);
  const P = buildPuppeteer();
  g.fx.custom(P, 10.8, (p, dt) => {
    P.position.set(c.pos.x, c.pos.y + 1.2, c.pos.z).addScaledVector(new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw)), -2.4);
    P.rotation.y = c.yaw;
    P.scale.setScalar(0.55 * Math.min(1, p * 10));
    setOpacity(P, Math.min(1, p * 6) * Math.min(1, (1 - p) * 10) * (0.7 + Math.sin(p * 90) * 0.1));
    if (Math.random() < dt * 14) g.fx.aura(c.pos, PK, 1, 3.4 * c.scaleNow, 0.9);
  }, () => disposeObj(P));
  const anchors: (() => THREE.Vector3)[] = [() => c.handPos(), () => c.handLPos(), () => c.footPos(), () => c.chestPos().add(new THREE.Vector3(0, 1.1, 0))];
  for (const a of anchors) g.fx.tether(() => P.position.clone().add(new THREE.Vector3(0, 4.1, 0)), a, 0xffc0e0, 10.5, 0.06);
  g.after(0.9, c, () => {
    g.setForm(c, 'terps', 10);
    c.speedMult = 1.4;
    c.atkSpeed = 1.5;
    c.buffDmg = 1.25;
    c.stunImmune = 10;
    c.combo = 0;
    g.hitSphere(grnd(c.pos), 7, c, 16, { kb: 8, stun: 0.3, heavy: true, color: PK, skill: true });
  });
}

/** F – Cat's Pounce */
function pounce(g: Game, c: Fighter) {
  const A = g.aim(c);
  c.faceNow(A.yaw);
  c.lock = 0.7;
  c.setAnim('leap', 0.6);
  sfx('dash');
  g.fx.dust(grnd(c.pos), 8, 3);
  const L = Math.min(18, Math.max(8, A.dist));
  c.vy = 15;
  c.onGround = false;
  g.dashF(c, A.flat, L, 0.5);
  g.trail(c, 3, PK, 0.5, 0.6);
  g.fx.afterimage(c.pos, c.yaw, PK);
  c.onLand = {
    t: 1.4,
    fn: () => {
      const p = grnd(c.pos);
      g.fx.shockwave(p, PK, 6, 0.45);
      g.fx.crack(p, PK, 3.5, 2.5);
      g.fx.slashX(c.chestPos().addScaledVector(c.forward(), 1.5), c.forward(), PK, 5, 0.3);
      g.shake(0.35);
      sfx('heavy');
      const hits = g.hitSphere(p, 5.5, c, 18, { kb: 7, stun: 0.35, heavy: true, color: PK, skill: true, bleed: 2.5, bleedDps: 4 });
      hits.forEach((v) => g.fx.impact(v.chestPos(), PK, 1.7));
    },
  };
}

const SKILLS: SkillDef[] = [
  { key: 'Z', name: 'Razor Claws', cost: 0, cd: 7, ai: [3, 18], desc: 'Blur through the enemy in six razor-sharp slashes. The last one launches and causes bleeding.', cast: (g, c) => claws(g, c) },
  { key: 'X', name: "Puppeteer's Strings", cost: 0, cd: 11, ai: [4, 30], desc: 'Nen strings seize the target in place for 1.1s while puppet-spirits rain homing bolts on them.', cast: (g, c) => strings(g, c) },
  { key: 'C', name: 'Doctor Blythe', cost: 0, cd: 18, ai: [0, 99], can: (_g, c) => c.hp < c.maxHp * 0.85, desc: 'Summon the surgeon doll. You cannot move for 2.3s, but take 45% less damage and heal 22% of your max HP.', cast: (g, c) => blythe(g, c) },
  {
    key: 'V', name: 'Terpsichora', cost: 55, cd: 70, ai: [0, 20], can: (_g, c) => !c.form,
    desc: 'ULTIMATE (55 energy): the ballerina puppet takes your strings. 10s of terrifying speed, +50% attack speed, +25% damage and stun immunity — then 3s of exhaustion.',
    cast: (g, c) => terpsichora(g, c),
  },
  { key: 'F', name: "Cat's Pounce", cost: 0, cd: 6, ai: [6, 24], desc: 'Spring across the arena and crash down with a clawed shockwave that makes enemies bleed.', cast: (g, c) => pounce(g, c) },
];

export const PITOU: CharDef = {
  kind: 'pitou', name: 'Neferpitou', title: 'NEFERPITOU', typ: 'Specialist · Royal Guard', color: PK, css: '#ff8abf', hp: 390, speed: 12.0,
  blurb: 'A feline Royal Guard with a terrifying En. Fast, fragile and lethal — the strongest of the Chimera Ants.',
  meter: { name: 'MALICE', color: '#ff8abf', start: 0, max: 100 },
  passive: { name: 'En', desc: "Pitou senses incoming skills: once every 9s she automatically slips out of the way of a skill hit. Malice builds with combat and adds up to +15% damage." },
  gainHit: 0.8, gainHurt: 0.6,
  skills: SKILLS,
  dmgBonus: (c) => 1 + (c.meter / 100) * 0.15,
  evade(g, vic, _att, _amt, o) {
    if (!o.skill || o.dot || (vic.st.enT ?? 0) > 0 || vic.form === 'exhaust') return false;
    vic.st.enT = 9;
    vic.invuln = Math.max(vic.invuln, 0.3);
    const a = rnd(0, Math.PI * 2);
    g.fx.afterimage(vic.pos, vic.yaw, PK);
    g.dashF(vic, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), 6, 0.12);
    g.popup(vic, 'EN — EVADED', '#ffb0d8', 20);
    g.fx.burst(vic.chestPos(), PK, 14, 9, 0.3);
    sfx('dash');
    return true;
  },
  onFormEnd(g, c, was) {
    if (was === 'terps') {
      g.setForm(c, 'exhaust', 3);
      c.speedMult = 0.85;
      c.stunImmune = 0;
    }
  },
  update(g, c, dt) {
    const tail = c.rig.props.tail;
    if (tail) tail.rotation.y = Math.sin(performance.now() / 380) * 0.4;
    if (c.form === 'terps') {
      c.dmgTaken = 1;
      if (Math.random() < dt * 24) g.fx.afterimage(c.pos, c.yaw, PK, 0.35, 0.4);
    }
  },
  m1: m1(0.55, 0.7, [
    S('slashR', 7, 0.2, 0.07, 4.0, { color: PK, trail: 1, lunge: 2 }),
    S('slashL', 7, 0.2, 0.07, 4.0, { color: PK, trail: 2 }),
    S('slashSideL', 8, 0.22, 0.08, 4.2, { color: PK, trail: 2, arc: -0.1, kb: 2, side: true }),
    S('slashR', 8, 0.2, 0.07, 4.0, { color: PK, trail: 1 }),
    S('overhead', 13, 0.34, 0.14, 4.5, { color: PK, trail: 1, kb: 7, heavy: true, launch: 5, shock: 3, lunge: 2.5 }),
  ]),
  m1Air: m1(0.55, 0.7, [
    S('slashR', 7, 0.2, 0.07, 3.9, { color: PK, trail: 1 }),
    S('slashL', 7, 0.2, 0.07, 3.9, { color: PK, trail: 2 }),
    S('kickR', 8, 0.24, 0.1, 4.0, { color: PK, trail: 3, kb: 2 }),
    S('spinKick', 9, 0.28, 0.12, 4.3, { color: PK, trail: 3, arc: -0.3, kb: 4, side: true }),
    S('slamR', 13, 0.4, 0.18, 4.2, { color: PK, arc: 0.0, kb: 2, slam: true, heavy: true, shock: 4 }),
  ]),
  m1Form: m1(0.4, 0.7, [
    S('slashR', 8, 0.14, 0.05, 4.8, { color: PK, trail: 1, lunge: 2.4, arc: -0.1 }),
    S('slashL', 8, 0.14, 0.05, 4.8, { color: PK, trail: 2, arc: -0.1 }),
    S('slashSideL', 9, 0.15, 0.05, 5.0, { color: PK, trail: 2, arc: -0.3, kb: 2, side: true }),
    S('slashR', 9, 0.14, 0.05, 4.8, { color: PK, trail: 1, arc: -0.1 }),
    S('slashL', 9, 0.14, 0.05, 4.8, { color: PK, trail: 2, arc: -0.1 }),
    S('overhead', 15, 0.26, 0.1, 5.2, { color: PK, trail: 1, kb: 8, heavy: true, launch: 6, shock: 4, lunge: 2.5, arc: -0.2 }),
  ]),
  m1Mode: 'repeat', m1Range: 4.2,
};
