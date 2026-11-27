import * as THREE from 'three';
import type { CharDef, SkillDef } from '../defs';
import type { Game } from '../Game';
import type { Fighter } from '../Fighter';
import { sfx } from '../audio';
import { begin, grnd, m1, S } from './kit';

const SM = 0xb4aac8;
const DP = 0x8a6ac8;
const DKS = 0x6a6074;

/** a lingering smoke cloud: slows & slowly damages enemies, shelters Morel */
function cloud(g: Game, c: Fighter, pos: THREE.Vector3, r: number, dur: number, dps = 8, slowMul = 0.55, color = DKS) {
  const p = grnd(pos);
  r *= 1.35;
  g.fx.smoke(p, Math.floor(r * 3), r * 0.6, color, r * 0.7, 1.6);
  g.fx.ring(p, SM, 0.5, r, 0.4);
  g.addZone({
    pos: p, r, t: dur, owner: c,
    tick: (gg, z, dt) => {
      if (Math.random() < dt * (r * 3.2)) gg.fx.smoke(z.pos, 1, z.r * 0.85, color, r * 0.55, 1.8);
      if (Math.hypot(c.pos.x - z.pos.x, c.pos.z - z.pos.z) < z.r) c.st.inSmokeT = 0.3;
      if (z.accum >= 0.5) {
        z.accum -= 0.5;
        for (const e of gg.enemies(c)) {
          if (Math.hypot(e.pos.x - z.pos.x, e.pos.z - z.pos.z) < z.r && e.pos.y < 3) {
            gg.damage(c, e, dps * 0.5, { dot: true, noCrit: true, noMeter: true, color: SM });
          }
        }
      }
      for (const e of gg.enemies(c)) if (Math.hypot(e.pos.x - z.pos.x, e.pos.z - z.pos.z) < z.r) gg.applySlow(e, 0.35, slowMul);
    },
  });
}

function smokeBurst(g: Game, c: Fighter, ch: number) {
  begin(g, c, 'castFwd', 0.45, 0.45);
  sfx('smoke');
  g.fx.gather(c.handPos(), SM, 1.8, 6);
  g.after(0.2, c, () => {
    const A = g.aim(c);
    c.faceNow(A.yaw);
    g.shoot({
      owner: c, pos: c.handPos().addScaledVector(A.flat, 0.8), dir: A.dir.clone(), speed: 30, radius: 2.2 + ch * 1.0, dmg: 20 + ch * 16, life: 1.1, color: SM, size: 1.3 + ch * 0.6,
      shape: 'smoke', grav: 6, opts: { kb: 4, stun: 0.25, color: SM, skill: true },
      onEnd: (p, why) => {
        if (why === 'life' && p.y > 1) return cloud(g, c, p, 5 + ch * 2.5, 5 + ch * 2.5);
        cloud(g, c, p, 5.5 + ch * 3, 6 + ch * 2);
        g.hitSphere(grnd(p), 4.5 + ch * 3, c, 8 + ch * 8, { kb: 6, color: SM, noCrit: true });
        g.fx.shockwave(grnd(p), SM, 5 + ch * 3, 0.5);
        sfx('smoke');
        g.shake(0.15);
      },
    });
  });
}

function smokeJail(g: Game, c: Fighter) {
  begin(g, c, 'castR', 0.45, 0.45);
  sfx('smoke');
  g.after(0.2, c, () => {
    const A = g.aim(c);
    const t = A.target ?? g.target(c, 40);
    c.faceNow(A.yaw);
    g.shoot({
      owner: c, pos: c.handPos().addScaledVector(A.flat, 0.6), dir: A.dir.clone(), speed: 18, radius: 2.0, dmg: 16, life: 3.4, color: DP, size: 1.0, shape: 'wisp', noGround: true,
      homing: t ? { target: t, rate: 3 } : undefined, opts: { color: DP, skill: true },
      onHit: (v) => {
        g.stunFighter(v, 1.5, true);
        v.root_ = Math.max(v.root_, 1.6);
        g.popup(v, 'SMOKE JAIL', '#c4a8ff', 22);
        const p = grnd(v.pos);
        g.fx.dome(p, 3.6, DP, 1.6, 0.35);
        g.fx.pillar(p, DP, 2.2, 7, 1.4);
        g.fx.smoke(p, 18, 1.8, 0x4a3a66, 2, 1.6);
        sfx('smoke');
        g.after(1.5, c, () => {
          g.fx.explosion(v.chestPos(), DP, 2.2, 0.3);
          g.hitSphere(v.chestPos(), 5, c, 26, { kb: 8, heavy: true, color: DP, noCrit: true });
        });
        g.addMeter(c, 10);
      },
    });
  });
}

function smokeSlam(g: Game, c: Fighter) {
  const A = g.aim(c);
  c.faceNow(A.yaw);
  c.lock = 0.8;
  c.setAnim('slamR', 0.6);
  sfx('charge');
  const t = A.target ?? g.target(c, 12);
  g.after(0.1, c, () => {
    c.vy = 12;
    c.onGround = false;
    if (t) {
      const d = new THREE.Vector3(t.pos.x - c.pos.x, 0, t.pos.z - c.pos.z);
      const L = d.length();
      d.normalize();
      g.dashF(c, d, Math.min(L - 2, 9), 0.3);
    } else g.dashF(c, A.flat, 5, 0.3);
  });
  g.after(0.38, c, () => {
    c.vy = -40;
    c.floatT = 0;
    c.onLand = {
      t: 1,
      fn: () => {
        const p = grnd(c.pos);
        g.fx.shockwave(p, SM, 9, 0.5);
        g.fx.crack(p, SM, 6, 3.5);
        g.fx.debris(p, 14, 9);
        g.shake(0.5);
        sfx('heavy');
        g.hitSphere(p, 9, c, 36, { kb: 11, heavy: true, color: SM, stun: 0.6 });
        g.fx.shockwave(p, DP, 9, 0.6);
        cloud(g, c, p, 6.5, 6);
        c.forced = null;
      },
    };
  });
}

function deepPurple(g: Game, c: Fighter) {
  c.lock = 1.0;
  c.invuln = Math.max(c.invuln, 1.0);
  c.setAnim('summon', 1.0);
  sfx('smoke');
  g.flash('#6a4aa8', 0.35);
  g.fx.pillar(c.pos, DP, 2.4, 22, 1.0);
  g.popup(c, 'DEEP PURPLE', '#b898ff', 28);
  const p = grnd(c.pos);
  g.fx.dome(p, 13, DP, 9.5, 0.2);
  g.fx.shockwave(p, DP, 13, 0.8);
  g.shake(0.5);
  cloud(g, c, p, 13, 10, 11, 0.45, 0x5a4a78);
  g.after(0.5, c, () => {
    g.setForm(c, 'deep', 9);
    c.speedMult = 1.25;
    c.buffDmg = 1.25;
    c.atkSpeed = 1.15;
    c.dmgTaken = 0.8;
  });
}

function smokeStep(g: Game, c: Fighter) {
  let dx = c.moveInput.x;
  let dz = c.moveInput.y;
  const A = g.aim(c);
  if (dx * dx + dz * dz < 0.01) {
    dx = A.flat.x;
    dz = A.flat.z;
  }
  const l = Math.hypot(dx, dz) || 1;
  dx /= l;
  dz /= l;
  c.faceNow(Math.atan2(dx, dz));
  c.setAnim('crouch', 0.3);
  c.lock = 0.15;
  sfx('smoke');
  const start = c.pos.clone();
  g.fx.smoke(start.clone().setY(1), 10, 1.2, DKS, 2, 1.2);
  cloud(g, c, start, 4.2, 4);
  g.after(0.05, c, () => {
    g.dashF(c, new THREE.Vector3(dx, 0, dz), 13, 0.2);
    c.ghost = 0.35;
    c.invuln = Math.max(c.invuln, 0.4);
    g.trail(c, 3, SM, 0.35, 0.7);
  });
  g.after(0.26, c, () => {
    g.fx.smoke(c.chestPos(), 10, 1.2, DKS, 2, 1.2);
    g.hitSphere(c.chestPos(), 4.6, c, 13, { kb: 5, color: SM, noCrit: true, stun: 0.15 });
  });
}

const SKILLS: SkillDef[] = [
  { key: 'Z', name: 'Smoke Burst', cost: 0, cd: 8, charge: 1.0, chargeAnim: 'chargeCast', ai: [4, 26], desc: 'Fire a lob of smoke that bursts on impact and blooms into a huge cloud — slows and wears down enemies inside, shelters you. HOLD for a bigger cloud.', cast: (g, c, ch) => smokeBurst(g, c, ch) },
  { key: 'X', name: 'Smoke Jail', cost: 0, cd: 13, ai: [4, 24], desc: 'Loose a slow, homing smoke wisp. On contact it encases the enemy in a jail (stun + root) that bursts when it ends.', cast: (g, c) => smokeJail(g, c) },
  { key: 'C', name: 'Pipe Slam', cost: 0, cd: 12, ai: [0, 9], desc: 'Leap and bring your pipe down — a heavy shockwave slam that leaves a smoke cloud.', cast: (g, c) => smokeSlam(g, c) },
  {
    key: 'V', name: 'Deep Purple', cost: 55, cd: 70, ai: [0, 18], can: (_g, c) => !c.form,
    desc: 'ULTIMATE (55 energy): flood the arena with a huge smoke dome for 9s. Enemies inside are slowed & choked; you gain speed, power and resistance.', cast: (g, c) => deepPurple(g, c),
  },
  { key: 'F', name: 'Smoke Step', cost: 0, cd: 6, ai: [5, 28], desc: 'Dissolve into smoke and dash through enemies, leaving a cloud behind.', cast: (g, c) => smokeStep(g, c) },
];

export const MOREL: CharDef = {
  kind: 'morel', name: 'Morel', title: 'MOREL MACKERNASEY', typ: 'Conjuration · Smoke area control', color: DP, css: '#b898ff', hp: 490, speed: 10.0,
  blurb: 'Big, patient and hard to pin down. Fills the field with smoke to slow, choke and cage the enemy while shrugging off hits.',
  meter: { name: 'SMOKE', color: '#a79ac8', start: 0, max: 100 },
  passive: { name: 'Smoke Veil', desc: 'Standing in your own smoke grants −15% damage taken, +8% speed and recovers HP. His smoke clouds are wide and his strikes hit like a truck. Hits build the Smoke meter.' },
  gainHit: 0.5, gainHurt: 0.3,
  skills: SKILLS,
  update(g, c, dt) {
    const inS = (c.st.inSmokeT ?? 0) > 0;
    if (c.form !== 'deep') {
      c.dmgTaken = inS ? 0.85 : 1;
      c.speedMult = inS ? 1.08 : c.form === 'exhaust' ? c.speedMult : 1;
    }
    if (inS && !c.dead) {
      c.st.regen = (c.st.regen ?? 0) + dt;
      if (c.st.regen > 1) {
        c.st.regen = 0;
        g.heal(c, 5);
      }
    }
  },
  onFormEnd(_g, c) {
    c.dmgTaken = 1;
  },
  m1: m1(1.0, 0.9, [
    S('jabR', 13, 0.34, 0.12, 4.4, { color: SM, trail: 1, kb: 1 }),
    S('hookL', 13, 0.34, 0.13, 4.4, { arc: 0.0, kb: 2.5, color: SM, trail: 2, recoil: true }),
    S('bodyR', 14, 0.34, 0.13, 4.0, { kb: 2, color: SM, trail: 1 }),
    S('slamL', 15, 0.36, 0.16, 4.2, { arc: 0.0, kb: 3, color: DP, trail: 2, launch: 7 }),
    S('slamR', 24, 0.5, 0.26, 5.0, { arc: -0.1, kb: 10, color: DP, heavy: true, trail: 1, shock: 6, lunge: 2.5 }),
  ]),
  m1Air: m1(0.9, 0.9, [
    S('jabR', 12, 0.34, 0.12, 4.2, { color: SM, trail: 1 }),
    S('jabL', 12, 0.34, 0.12, 4.0, { color: SM, trail: 2 }),
    S('kickR', 13, 0.34, 0.14, 4.3, { kb: 2.5, color: SM, trail: 3 }),
    S('spinKick', 13, 0.38, 0.18, 4.8, { arc: -0.3, kb: 4, color: SM, trail: 3, side: true }),
    S('slamR', 21, 0.5, 0.22, 4.7, { arc: 0.0, kb: 2, slam: true, color: DP, heavy: true, shock: 7 }),
  ]),
  m1Mode: 'repeat', m1Range: 4.3,
};
