import * as THREE from 'three';
import type { CharDef, SkillDef } from '../defs';
import type { Game } from '../Game';
import type { Fighter } from '../Fighter';
import { sfx } from '../audio';
import { begin, grnd, rot, rnd, m1, S, faceTarget, aroundTarget, teleport } from './kit';

const PU = 0xb48cff;
const DPU = 0x6a3fa0;
const GD = 0xe0b84a;

function pistol(g: Game, c: Fighter, ch: number) {
  begin(g, c, 'point', 0.32, 0.32);
  sfx('charge');
  g.fx.gather(c.handPos(), PU, 1.3, 5);
  g.after(0.14, c, () => {
    const A = g.aim(c);
    c.faceNow(A.yaw);
    sfx('boom');
    g.shake(0.12);
    const pos = c.handPos().addScaledVector(A.flat, 0.7);
    g.fx.flashAt(pos, 0xffffff, 1.4, 0.12);
    g.shoot({
      owner: c, pos, dir: A.dir.clone(), speed: 86, radius: 0.8 + ch * 0.4, dmg: 14 + ch * 16, life: 0.7, color: PU, size: 0.8 + ch * 0.5, shape: 'bullet',
      pierce: ch > 0.7, opts: { kb: 2 + ch * 3, stun: ch > 0.5 ? 0.25 : 0, color: PU, heavy: ch > 0.7, skill: true },
      onHit: (_v, p) => g.fx.hitSpark(p, PU, 1.8),
    });
  });
}

function gallery(g: Game, c: Fighter) {
  const A = g.aim(c);
  const t = A.target ?? g.target(c, 30);
  c.faceNow(A.yaw);
  c.lock = 0.9;
  c.setAnim('summon', 0.6);
  sfx('charge');
  const spot = t ? grnd(t.pos) : A.ground.clone();
  g.fx.telegraph(spot, 4.2, DPU, 0.6);
  const base = Math.random() * 6.28;
  const dirs = [base, base + Math.PI];
  dirs.forEach((a) => {
    const p = new THREE.Vector3(spot.x + Math.cos(a) * 9, 0, spot.z + Math.sin(a) * 9);
    g.fx.afterimage(p, Math.atan2(-Math.cos(a), -Math.sin(a)), DPU, 0.7, 0.6);
    g.fx.burst(p.clone().setY(1.8), DPU, 8, 5, 0.4);
  });
  [0.6, 0.85].forEach((tm, i) =>
    g.after(tm, c, () => {
      const a = dirs[i];
      const p = new THREE.Vector3(spot.x + Math.cos(a) * 9, 1.8, spot.z + Math.sin(a) * 9);
      const dir = new THREE.Vector3(spot.x - p.x, 0, spot.z - p.z).normalize();
      g.fx.afterimage(new THREE.Vector3(spot.x + Math.cos(a) * 2, 0, spot.z + Math.sin(a) * 2), Math.atan2(dir.x, dir.z), PU, 0.4, 0.7);
      g.fx.slashArc(spot.clone().setY(1.8), dir, i ? 0.8 : -0.8, 8, 1.2, i ? 0xffffff : PU, 0.3);
      g.fx.beam(p, spot.clone().setY(1.8).addScaledVector(dir, 6), PU, 0.6, 0.2);
      sfx('slash');
      g.shake(0.2);
      g.hitSphere(spot.clone().setY(1.5), 4.2, c, i ? 15 : 12, i ? { launch: 8, kb: 6, stun: 0.5, heavy: true, color: PU, skill: true } : { kb: 1, color: PU, stun: 0.15, skill: true });
    })
  );
  return 12;
}

function skillHunter(g: Game, c: Fighter) {
  const e = g.target(c, 80);
  const ls = e?.lastSkill;
  if (e && ls && g.time - ls.t < 25 && !ls.form && ls.i !== 3 && ls.kind !== 'chrollo' && ls.kind !== 'bandit') {
    const sk = g.defOf(ls.kind).skills[ls.i];
    if (sk) {
      g.popup(c, `STOLEN: ${sk.name.toUpperCase()}`, '#d8b8ff', 22);
      g.fx.pillar(c.pos, PU, 1.6, 10, 0.5);
      g.fx.orbit(() => c.pos, 4, 1.5, GD, 0.6, 0.25, 2, 6);
      sfx('charge');
      c.st.stolenT = 0.2;
      const saved = c.buffDmg;
      c.buffDmg *= 0.85;
      sk.cast(g, c, 0.6);
      g.after(2.5, null, () => { c.buffDmg = saved; });
      c.meter = Math.max(0, c.meter - 15);
      return 14;
    }
  }
  // nothing to steal yet: throw conjured pages
  begin(g, c, 'fling', 0.4, 0.4);
  sfx('card');
  g.after(0.15, c, () => {
    const A = g.aim(c);
    c.faceNow(A.yaw);
    [-0.2, 0, 0.2].forEach((o) =>
      g.shoot({
        owner: c, pos: c.handPos().addScaledVector(A.flat, 0.5), dir: rot(A.dir, o), speed: 50, radius: 1.0, dmg: 9, life: 0.9, color: PU, size: 0.9, shape: 'page',
        opts: { kb: 1.5, color: PU, skill: true },
      })
    );
  });
  g.popup(c, 'NOTHING TO STEAL YET', '#b0a0c8', 16);
  return 5;
}

function troupe(g: Game, c: Fighter) {
  const A = g.aim(c);
  const t = A.target ?? g.target(c, 30);
  c.lock = 3.1;
  c.faceNow(A.yaw);
  c.setAnim('summon', 0.9);
  sfx('charge');
  g.popup(c, "LUCILFER'S BOOK", '#d0b0ff', 26);
  g.flash('#6a3fa0', 0.3);
  if (!t) return 8;
  const spot = grnd(t.pos);
  g.fx.telegraph(spot, 9, DPU, 1.0);
  g.fx.dome(spot, 9, DPU, 3, 0.15);
  g.applySlow(t, 1.4, 0.3);
  g.popup(t, 'SEALED', '#c8a8ff', 20);
  g.fx.orbit(() => spot.clone(), 8, 5, PU, 2.8, 0.3, 2.4, 3);
  const n = 7;
  const base = Math.random() * 6.28;
  g.after(0.9, c, () => faceTarget(c, t));
  for (let i = 0; i < n; i++) {
    g.after(1.1 + i * 0.16, c, () => {
      if (t.dead) return;
      const a = base + (i / n) * 6.28;
      const p = aroundTarget(t, a, 6.5);
      const dir = new THREE.Vector3(t.pos.x - p.x, 0, t.pos.z - p.z).normalize();
      g.fx.afterimage(p, Math.atan2(dir.x, dir.z), i % 2 ? PU : DPU, 0.5, 0.65);
      g.fx.beam(p.clone().setY(1.8), t.chestPos(), PU, 0.5, 0.18);
      g.fx.slashArc(t.chestPos().addScaledVector(dir, -2), dir, rnd(-1, 1), 6, 1.0, i % 2 ? 0xffffff : PU, 0.25);
      sfx('slash');
      g.hitSphere(t.chestPos().setY(t.pos.y + 1.4), 3.6, c, 8, { kb: 1.5, color: PU, noCrit: true, skill: true, slow: 1, slowMul: 0.5 });
    });
  }
  g.after(1.1 + n * 0.16 + 0.15, c, () => {
    if (t.dead) return;
    const p = grnd(t.pos);
    g.fx.telegraph(p, 7, PU, 0.3);
    g.after(0.3, c, () => {
      g.flash('#d8b8ff', 0.5);
      g.fx.explosion(p.clone().setY(1.6), PU, 7, 0.7);
      g.fx.pillar(p, PU, 3.5, 36, 0.6);
      g.fx.crack(p, PU, 8, 3);
      g.shake(0.9);
      sfx('boom');
      g.hitSphere(p.clone().setY(1.5), 7, c, 30, { kb: 11, launch: 9, stun: 0.8, heavy: true, color: PU, breakGuard: true });
    });
  });
  return 70;
}

function blink(g: Game, c: Fighter) {
  const A = g.aim(c);
  c.faceNow(A.yaw);
  c.lock = 0.3;
  c.setAnim('crouch', 0.15);
  sfx('dash');
  g.fx.afterimage(c.pos, c.yaw, PU, 0.5);
  g.fx.burst(c.chestPos(), DPU, 14, 7, 0.4);
  const t = A.target;
  g.after(0.08, c, () => {
    if (t && !t.dead && Math.hypot(t.pos.x - c.pos.x, t.pos.z - c.pos.z) < 30) {
      const fw = new THREE.Vector3(Math.sin(t.yaw), 0, Math.cos(t.yaw));
      teleport(g, c, new THREE.Vector3(t.pos.x - fw.x * 2.2, 0, t.pos.z - fw.z * 2.2));
      faceTarget(c, t);
    } else {
      const d = Math.min(16, Math.hypot(A.ground.x - c.pos.x, A.ground.z - c.pos.z));
      teleport(g, c, c.pos.clone().addScaledVector(A.flat, d));
    }
    c.invuln = Math.max(c.invuln, 0.25);
    g.fx.burst(c.chestPos(), PU, 14, 7, 0.4);
    g.fx.shockwave(grnd(c.pos), PU, 3.5, 0.3);
    g.after(0.1, c, () => {
      c.setAnim('slashSide', 0.3);
      g.fx.slashArc(c.chestPos().addScaledVector(c.forward(), 1.5), c.forward(), 0.3, 4, 0.9, PU, 0.22);
      g.hitArc(c, 4.8, -0.2, 11, { kb: 4, color: PU, stun: 0.25, skill: true });
    });
  });
}

const SKILLS: SkillDef[] = [
  { key: 'Z', name: 'Pistol Finger', cost: 0, cd: 5, charge: 1.0, chargeAnim: 'chargePalm', ai: [5, 34], desc: 'Fire a fast Nen bullet from your fingertip. HOLD for a heavy, piercing shot.', cast: (g, c, ch) => pistol(g, c, ch) },
  { key: 'X', name: 'Gallery Fake', cost: 0, cd: 12, ai: [3, 24], desc: 'Two phantoms rush in from opposite sides and slash across the target area; the second slash launches.', cast: (g, c) => gallery(g, c) },
  { key: 'C', name: 'Skill Hunter', cost: 0, cd: 14, ai: [2, 30], desc: "Steal and cast the enemy's most recent skill (85% power). With nothing to steal, you throw conjured pages.", cast: (g, c) => skillHunter(g, c) },
  { key: 'V', name: "Lucilfer's Book", cost: 55, cd: 70, ai: [0, 26], desc: 'ULTIMATE (55 energy): seal the enemy in a Nen circle (heavy slow), then seven phantoms slash from all around ending in a huge convergence blast.', cast: (g, c) => troupe(g, c) },
  { key: 'F', name: 'Dark Blink', cost: 0, cd: 6, ai: [8, 30], desc: 'Teleport to the cursor — aiming at an enemy puts you behind them with a quick ambush slash.', cast: (g, c) => blink(g, c) },
];

export const CHROLLO: CharDef = {
  kind: 'chrollo', name: 'Chrollo', title: 'CHROLLO LUCILFER', typ: 'Specialist · Skill Hunter', color: PU, css: '#b48cff', hp: 410, speed: 10.5,
  blurb: 'Studies his opponent and steals their techniques. Teleports, phantoms and a sealing ultimate make him the ultimate adaptive threat.',
  meter: { name: 'INSIGHT', color: '#b48cff', start: 0, max: 100 },
  passive: { name: 'Analysis', desc: 'Every skill the enemy uses and every hit you land builds Insight, up to +25% damage. Skill Hunter casts the enemy’s last skill.' },
  gainHit: 0.35, gainHurt: 0.3,
  skills: SKILLS,
  dmgBonus: (c) => 1 + (c.meter / 100) * 0.25,
  update(g, c) {
    const e = g.target(c, 120);
    if (e?.lastSkill && e.lastSkill.t !== c.st.seen) {
      c.st.seen = e.lastSkill.t;
      g.addMeter(c, 12);
    }
  },
  m1: m1(0.9, 0.8, [
    S('jabR', 8, 0.28, 0.1, 3.9, { color: PU, trail: 1 }),
    S('hookL', 8, 0.28, 0.11, 3.9, { arc: 0.0, kb: 1.6, color: PU, trail: 2, recoil: true }),
    S('palmR', 9, 0.3, 0.11, 4.0, { kb: 1.4, color: GD, trail: 1, lunge: 2.2 }),
    S('roundL', 10, 0.3, 0.13, 4.2, { arc: -0.1, kb: 3.5, color: PU, trail: 3, side: true }),
    S('slashSide', 13, 0.42, 0.16, 5.0, { arc: -0.1, kb: 8, color: PU, trail: 1, heavy: true, lunge: 2.6, shock: 3 }),
  ]),
  m1Air: m1(0.8, 0.8, [
    S('jabR', 8, 0.28, 0.1, 3.9, { color: PU, trail: 1 }),
    S('palmL', 8, 0.28, 0.1, 3.9, { kb: 1.2, color: GD, trail: 2 }),
    S('kickR', 9, 0.3, 0.12, 4.1, { kb: 2, color: PU, trail: 3 }),
    S('spinKick', 10, 0.34, 0.16, 4.4, { arc: -0.3, kb: 4, color: PU, trail: 3, side: true }),
    S('slamR', 14, 0.45, 0.2, 4.2, { arc: 0.0, kb: 2, slam: true, color: PU, heavy: true, shock: 4.5 }),
  ]),
  m1Mode: 'repeat', m1Range: 4.2,
};
