import * as THREE from 'three';
import type { CharDef, M1Def, SkillDef } from '../defs';
import type { Game } from '../Game';
import type { Fighter } from '../Fighter';
import { sfx } from '../audio';
import { grnd, dist2 } from './kit';

const GRN = 0x8dff6a;
const DK = 0x2fd05a;
const WHT = 0xeaffdd;

const full = (ch: number) => ch >= 0.98;
/** Jajanken never spends Nen — a full aura simply means the fist is at its absolute ceiling. */
function enhance(c: Fighter) {
  if (c.meter >= 99) {
    c.st.auraT = 1.2;
    return true;
  }
  return false;
}
const rockMult = (v: Fighter) => ((v.st.rockT ?? 0) > 0 ? 1.35 : 1);

// ------------------------------------------------------------------ Rock
function rock(g: Game, c: Fighter, ch: number, adult: boolean) {
  const enh = enhance(c);
  const A = g.aim(c);
  c.faceNow(A.yaw);
  const near = g.enemies(c).filter((v) => dist2(c, v) < (adult ? 4.2 : 3.4)).sort((a, b) => dist2(c, a) - dist2(c, b))[0];
  const wind = adult ? 0.3 : near ? 0.3 : 0.2 + ch * 0.12;
  const grabT = near ? 0.34 : 0;
  c.lock = wind + grabT + 0.45;
  c.setAnim(near ? 'grab' : 'rock', near ? 0.34 : wind / 0.6 + 0.1);
  sfx('charge');
  g.fx.gather(c.handPos(), adult ? DK : GRN, 2.2, 8);
  if (near) {
    g.stunFighter(near, 0.75, true);
    near.charging = null;
    const dx = c.pos.x - near.pos.x;
    const dz = c.pos.z - near.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    c.faceNow(Math.atan2(-dx, -dz));
    if (d > 2.1) g.knock(near, dx / d, dz / d, d - 2.1, 0.12);
    g.fx.chain(() => c.handPos(), () => near.chestPos(), WHT, 0.3, 4);
    g.popup(near, 'GRABBED', '#bfffa0', 20);
  }
  g.after(grabT + wind, c, () => {
    if (near && !near.dead) c.faceNow(Math.atan2(near.pos.x - c.pos.x, near.pos.z - c.pos.z));
    else g.faceAim(c);
    c.setAnim('rock', 0.4);
    const f = c.forward();
    g.dashF(c, f, adult ? 5 : 2.2 + ch * 3, 0.1);
    g.trail(c, 1, adult ? DK : GRN, 0.25, adult ? 0.9 : 0.55);
    sfx('swing');
  });
  g.after(grabT + wind + 0.09, c, () => {
    const f = c.forward();
    const range = adult ? 7.2 : 4.6 + ch * 1.6 + (enh ? 0.8 : 0);
    const dmg = adult ? 56 : (30 + ch * 34) * (enh ? 1.2 : 1);
    const col = adult ? DK : GRN;
    const p = c.chestPos().addScaledVector(f, 2.6);
    const victims = g.hitArc(c, range, 0.15, dmg, {
      kb: adult ? 22 : 11 + ch * 8, stun: 0.6, heavy: true, color: col, mult: undefined,
      onHit: (v) => { v.st.rockT = 5; },
    });
    const aerial = !c.onGround;
    for (const v of victims) if (aerial || !v.onGround) g.slamDown(v, c);
    g.fx.explosion(p, col, adult ? 5.5 : 2.6 + ch * 2, 0.4);
    g.fx.vring(p, f, WHT, 0.6, adult ? 9 : 5 + ch * 3, 0.35);
    g.shake(adult ? 0.8 : 0.3 + ch * 0.3);
    g.kick(adult ? 6 : 3);
    sfx('boom');
    if (c.onGround) {
      const gp = grnd(c.pos).addScaledVector(f, 3.4);
      const R = adult ? 11 : 4.5 + ch * 3.5;
      g.fx.crack(gp, col, R * 0.9, 4);
      g.fx.shockwave(gp, col, R, 0.55);
      g.fx.debris(gp, adult ? 22 : 10 + Math.floor(ch * 10), 9);
      g.hitSphere(gp, R * 0.8, c, adult ? 18 : 9 + ch * 8, { kb: adult ? 9 : 5, color: col, exclude: victims, heavy: false });
    }
    if (full(ch) && !adult) {
      const o = c.chestPos().addScaledVector(f, 2);
      g.flash('#c8ffb0', 0.35);
      g.shoot({
        owner: c, pos: o, dir: f.clone(), speed: 38, radius: 3.0, dmg: 20, life: 0.55, color: GRN, size: 2.4, shape: 'wave', pierce: true, noGround: true,
        opts: { kb: 9, stun: 0.3, color: GRN, heavy: true, onHit: (v) => { v.st.rockT = 5; } },
      });
    }
  });
}

// ------------------------------------------------------------------ Scissors
function scissors(g: Game, c: Fighter, ch: number, adult: boolean) {
  const enh = enhance(c);
  const A = g.aim(c);
  c.faceNow(A.yaw);
  const air = !c.onGround;
  const dir = A.dir.clone();
  if (air) {
    dir.y = Math.min(dir.y, -0.55);
    dir.normalize();
  }
  const len = adult ? 18 : 6.5 + ch * 5 + (enh ? 1.5 : 0);
  const width = adult ? 4.2 : 1.7 + ch * 0.8 + (enh ? 0.4 : 0);
  const wind = 0.16 + ch * 0.05;
  c.lock = wind + 0.28;
  c.setAnim(air ? 'slashR' : 'slashSide', 0.34);
  c.boostT = 0.4;
  c.boostColor = adult ? DK : GRN;
  sfx('charge');
  const col = adult ? DK : GRN;
  g.after(wind, c, () => {
    const A2 = g.aim(c);
    c.faceNow(A2.yaw);
    const d2 = A2.dir.clone();
    if (air) {
      d2.y = Math.min(d2.y, -0.55);
      d2.normalize();
    }
    const origin = c.chestPos().addScaledVector(A2.flat, 0.8);
    const dmg = (adult ? 38 : 15 + ch * 12) * (enh ? 1.25 : 1);
    sfx('slash');
    g.fx.slashArc(origin.clone().addScaledVector(d2, len * 0.35), d2, air ? 1.4 : 0.35, len * (adult ? 0.55 : 0.5), 1.1, col, 0.3);
    g.fx.slashArc(origin.clone().addScaledVector(d2, len * 0.28), d2, air ? 1.4 : 0.35, len * 0.4, 0.8, 0xffffff, 0.22);
    g.fx.beam(origin, origin.clone().addScaledVector(d2, len), col, adult ? 1.4 : 0.5, 0.2);
    g.trail(c, 1, col, 0.25, adult ? 0.9 : 0.5);
    const victims = g.hitBeam(c, origin, d2, len, width, dmg, {
      kb: adult ? 8 : 3 + ch * 3, color: col, heavy: adult || ch > 0.7, bleed: adult ? 5 : 3.5, bleedDps: adult ? 7 : 4 + ch * 3, mult: rockMult,
      onHit: (v) => {
        if ((v.st.rockT ?? 0) > 0) {
          v.st.rockT = 0;
          g.popup(v, 'ROCK+SCISSORS!', '#ffe8a0', 20);
          g.fx.explosion(v.chestPos(), 0xfff0a0, 1.8, 0.3);
        }
      },
    });
    if (victims.length) g.shake(adult ? 0.5 : 0.2);
    if (air) {
      c.vy = -14;
      c.floatT = 0;
      g.dashF(c, A2.flat, 3.5, 0.15);
    } else g.dashF(c, A2.flat, adult ? 5 : 2 + ch * 3, 0.12);
  });
}

// ------------------------------------------------------------------ Paper
function paper(g: Game, c: Fighter, ch: number, adult: boolean) {
  const enh = enhance(c);
  const A = g.aim(c);
  c.faceNow(A.yaw);
  const fl = full(ch);
  c.lock = adult ? 0.55 : 0.36;
  c.setAnim('castR', adult ? 0.55 : 0.42);
  sfx('charge');
  const col = adult ? DK : GRN;
  g.fx.gather(c.handPos(), col, adult ? 3 : 1.6, 8);
  g.after(adult ? 0.3 : 0.17, c, () => {
    const A2 = g.aim(c);
    c.faceNow(A2.yaw);
    const pos = c.handPos().addScaledVector(A2.flat, 0.6);
    const size = adult ? 3.2 : 0.9 + ch * 1.3 + (enh ? 0.3 : 0);
    const dmg = (adult ? 34 : 14 + ch * 18) * (enh ? 1.2 : 1);
    const explodeR = adult ? 11 : fl ? 6.5 : 0;
    sfx('boom');
    g.shake(adult ? 0.5 : 0.15 + ch * 0.2);
    g.shoot({
      owner: c, pos, dir: A2.dir.clone(), speed: adult ? 40 : 52 - ch * 14, radius: adult ? 3.4 : 1.0 + ch * 1.4, dmg, life: 1.8,
      color: col, size, shape: 'orb', pierce: !(fl || adult),
      opts: { stun: 0.2, kb: adult ? 12 : 4 + ch * 5, color: col, heavy: ch > 0.5 || adult },
      onEnd: (p, why) => {
        if (explodeR > 0 && why !== 'life') {
          g.fx.explosion(p, col, explodeR * 0.8, 0.55);
          g.hitSphere(p, explodeR, c, adult ? 40 : 22, { heavy: true, kb: adult ? 14 : 9, stun: 0.5, color: col });
          g.shake(adult ? 0.9 : 0.5);
          g.flash(adult ? '#a0ffb0' : '#d8ffc8', 0.35);
          if (adult) g.fx.crack(grnd(p), col, 8, 4);
        }
        if (why === 'ground') {
          const gp = grnd(p);
          const R = explodeR > 0 ? explodeR : 4 + ch * 4;
          g.fx.shockwave(gp, col, R, 0.5);
          if (explodeR === 0) g.hitSphere(gp, R * 0.9, c, 8 + ch * 8, { kb: 6, color: col });
        }
      },
    });
  });
}

// ------------------------------------------------------------------ Leap
function leap(g: Game, c: Fighter, ch: number, adult: boolean) {
  const A = g.aim(c);
  c.faceNow(A.yaw);
  const up = Math.max(0, A.dir.y);
  c.setAnim('leap', 0.5);
  c.lock = 0.12;
  const speedK = adult ? 1.6 : 1;
  const vy = (14 + ch * 6 + up * 16) * (adult ? 1.12 : 1);
  const hor = (adult ? 26 : 15) * (0.75 + ch * 0.9) * (1 - up * 0.45);
  g.after(0.06, c, () => {
    c.vy = vy;
    c.onGround = false;
    c.coyote = 0;
    c.forced = { vx: A.flat.x * hor * speedK, vz: A.flat.z * hor * speedK, t: 1.6, T: 1.6, ease: false, land: true };
    c.invuln = Math.max(c.invuln, 0.15);
    c.floatT = 0;
    sfx('dash');
    g.fx.shockwave(grnd(c.pos), GRN, 3, 0.3);
    g.fx.dust(grnd(c.pos), 8, 4);
    g.trail(c, 3, adult ? DK : GRN, 0.8, 0.5);
    c.setAnim('flyKick', 0.6);
    c.onLand = {
      t: 3,
      fn: () => {
        const p = grnd(c.pos);
        const R = adult ? 8 : 5 + ch * 1.5;
        g.fx.shockwave(p, adult ? DK : GRN, R, 0.5);
        g.fx.crack(p, GRN, R * 0.6, 2);
        g.fx.debris(p, 8, 7);
        g.shake(0.35);
        sfx('heavy');
        g.hitSphere(p, R, c, adult ? 14 : 8, { kb: 3, stun: 0.7, color: GRN, heavy: true });
        c.forced = null;
        c.lock = 0;
        c.anim = null;
      },
    };
  });
  return adult ? 4 : 5;
}

// ------------------------------------------------------------------ Transformation
function adultTransform(g: Game, c: Fighter) {
  c.lock = 1.2;
  c.invuln = Math.max(c.invuln, 1.2);
  c.setAnim('summon', 1.2);
  sfx('charge');
  g.flash('#d8ffd0', 0.4);
  g.fx.pillar(c.pos, 0x1fe05a, 2.4, 40, 1.4);
  g.fx.pillar(c.pos, 0x0b3a14, 3.6, 30, 1.6);
  g.fx.shockwave(grnd(c.pos), DK, 12, 0.9);
  g.popup(c, 'ADULT GON', '#7dff9a', 30);
  g.shake(0.5);
  for (let i = 0; i < 4; i++) g.after(0.25 + i * 0.25, c, () => g.fx.shockwave(grnd(c.pos), DK, 6 + i * 2, 0.5));
  g.after(0.6, c, () => {
    g.setForm(c, 'adult', 100);
    c.meter = 100;
    c.speedMult = 1.3;
    c.buffDmg = 1.34;
    c.rangeMult = 1.3;
    g.fx.explosion(c.chestPos(), DK, 5, 0.5);
    g.shake(0.8);
    sfx('boom');
  });
}

function pitou(g: Game, c: Fighter) {
  const A = g.aim(c);
  const t = A.target ?? g.target(c, 16);
  c.lock = 1.3;
  c.faceNow(A.yaw);
  c.setAnim('crouch', 0.3);
  sfx('charge');
  g.fx.gather(c.chestPos(), DK, 3, 10);
  if (t) g.fx.telegraph(grnd(t.pos), 9, DK, 0.7);
  g.after(0.3, c, () => {
    if (t && !t.dead) {
      const d = new THREE.Vector3(t.pos.x - c.pos.x, 0, t.pos.z - c.pos.z);
      const L = d.length();
      d.normalize();
      c.faceNow(Math.atan2(d.x, d.z));
      g.dashF(c, d, Math.max(0, L - 2.4), 0.14);
    }
    c.setAnim('kickR', 0.4);
    g.trail(c, 3, DK, 0.4, 0.9);
    sfx('swing');
  });
  g.after(0.46, c, () => {
    const fwd = c.forward();
    const hit = g.hitArc(c, 6, 0.0, 44, { kb: 6, launch: 9, stun: 1.4, color: DK, heavy: true, breakGuard: true });
    g.fx.explosion(c.chestPos().addScaledVector(fwd, 2.5), 0xffffff, 3, 0.3);
    g.shake(0.6);
    sfx('heavy');
    const spot = hit[0] ? hit[0].pos.clone() : grnd(c.pos).addScaledVector(fwd, 5);
    g.fx.telegraph(grnd(spot), 9, DK, 0.55);
    g.after(0.6, c, () => {
      const p = grnd(spot);
      g.flash('#b8ffc0', 0.55);
      g.fx.explosion(p.clone().setY(2), DK, 10, 0.8);
      g.fx.pillar(p, DK, 5, 40, 0.7);
      g.fx.crack(p, DK, 10, 4);
      g.fx.debris(p, 28, 12);
      g.shake(1.0);
      g.kick(8);
      sfx('boom');
      g.hitSphere(p.clone().setY(1.5), 9, c, 52, { kb: 16, stun: 1.0, heavy: true, color: DK, breakGuard: true });
    });
  });
}

// ------------------------------------------------------------------ skill defs
const NORMAL: SkillDef[] = [
  {
    key: 'Z', name: 'Jajanken: Rock', cost: 0, cd: 9, charge: 1.4, chargeAnim: 'chargeFist', ai: [2, 11],
    desc: 'Heavy punch. HOLD to charge (full = massive shockwave). Grabs close enemies first, cracks the ground, spikes airborne foes down.',
    cast: (g, c, ch) => rock(g, c, ch, false),
  },
  {
    key: 'X', name: 'Jajanken: Scissors', cost: 0, cd: 12, charge: 1.0, chargeAnim: 'chargeBlade', ai: [2, 12],
    desc: 'Nen blade slash — aim diagonally, HOLD for reach. Pierces multiple foes, causes bleeding. Bonus vs Rock-marked enemies. Aerial = downward slash.',
    cast: (g, c, ch) => scissors(g, c, ch, false),
  },
  {
    key: 'C', name: 'Jajanken: Paper', cost: 0, cd: 15, charge: 1.5, chargeAnim: 'chargePalm', ai: [5, 30],
    desc: 'Nen projectile. HOLD for a bigger orb; fully charged it explodes on impact. Pierces in a line, shockwave on ground hit.',
    cast: (g, c, ch) => paper(g, c, ch, false),
  },
  {
    key: 'V', name: 'Adult Gon: Restriction & Covenant', cost: 0, cd: 55, ai: [0, 30],
    can: (_g, c) => !c.form && c.meter >= 99,
    desc: 'COVENANT (needs a FULL Nen meter): trade your future for the adult form — far more speed, reach and power. No timer: it burns Nen until you run dry, and every blow you land or take refills the meter. When it ends you are broken for 30 seconds.',
    cast: (g, c) => adultTransform(g, c),
  },
  {
    key: 'F', name: 'Nen Leap', cost: 0, cd: 5, charge: 0.9, chargeAnim: 'charge', ai: [8, 30],
    desc: 'Leap forward. HOLD for distance, aim up to jump high. Landing creates a shockwave that staggers nearby enemies.',
    cast: (g, c, ch) => leap(g, c, ch, false),
  },
];

const ADULT: SkillDef[] = [
  { key: 'Z', name: 'Adult Rock', cost: 0, cd: 7, ai: [2, 11], desc: 'An enormous punch with devastating knockback.', cast: (g, c) => rock(g, c, 1, true) },
  { key: 'X', name: 'Adult Scissors', cost: 0, cd: 9, ai: [3, 17], desc: 'A massive Nen blade and a powerful slash.', cast: (g, c) => scissors(g, c, 1, true) },
  { key: 'C', name: 'Adult Paper', cost: 0, cd: 12, ai: [6, 34], desc: 'A gigantic Nen blast that creates a huge explosion.', cast: (g, c) => paper(g, c, 1, true) },
  { key: 'V', name: 'Pitou Punishment', cost: 0, cd: 25, ai: [0, 14], desc: 'A devastating close-range kick followed by a massive explosion.', cast: (g, c) => pitou(g, c) },
  { key: 'F', name: 'Nen Leap', cost: 0, cd: 4, charge: 0.7, chargeAnim: 'charge', ai: [8, 30], desc: 'Significantly faster leap (adult).', cast: (g, c, ch) => leap(g, c, ch, true) },
];

// ------------------------------------------------------------------ M1
const M1_NORMAL: M1Def = {
  recovery: 1.2, window: 0.9,
  steps: [
    { anim: 'jabR', dmg: 8, dur: 0.3, hit: 0.1, range: 3.9, arc: 0.2, kb: 0.6, color: GRN, trail: 1, lunge: 1.6 },
    { anim: 'hookL', dmg: 8, dur: 0.3, hit: 0.11, range: 3.9, arc: 0.1, kb: 1.4, color: GRN, trail: 2, recoil: true },
    { anim: 'bodyR', dmg: 9, dur: 0.3, hit: 0.12, range: 4.0, arc: 0.2, kb: 1.8, color: GRN, trail: 1, shock: 2.6 },
    { anim: 'upperR', dmg: 10, dur: 0.3, hit: 0.12, range: 3.9, arc: 0.2, launch: 9.5, kb: 0.5, color: GRN, trail: 1, hop: 7 },
    { anim: 'slamR', dmg: 15, dur: 0.5, hit: 0.3, range: 4.0, dive: 6.5, kb: 8, color: GRN, heavy: true, hop: 12 },
  ],
};
const M1_AIR: M1Def = {
  recovery: 0.9, window: 0.8,
  steps: [
    { anim: 'jabR', dmg: 8, dur: 0.3, hit: 0.1, range: 3.9, arc: 0.1, kb: 0.6, color: GRN, trail: 1 },
    { anim: 'jabL', dmg: 8, dur: 0.3, hit: 0.1, range: 3.9, arc: 0.1, kb: 0.8, color: GRN, trail: 2 },
    { anim: 'bodyR', dmg: 9, dur: 0.3, hit: 0.11, range: 4.0, arc: 0.0, kb: 1.2, color: GRN, trail: 1 },
    { anim: 'spinKick', dmg: 10, dur: 0.35, hit: 0.17, range: 4.4, arc: -0.3, kb: 4, color: GRN, trail: 3, side: true },
    { anim: 'slamR', dmg: 15, dur: 0.5, hit: 0.22, range: 4.3, arc: 0.0, kb: 2, slam: true, heavy: true, color: GRN, shock: 5 },
  ],
};
const M1_ADULT: M1Def = {
  recovery: 0.9, window: 0.8,
  steps: [
    { anim: 'jabR', dmg: 11, dur: 0.24, hit: 0.09, range: 4.4, arc: 0.0, kb: 2.5, color: DK, trail: 1, lunge: 2.2 },
    { anim: 'bodyL', dmg: 10, dur: 0.24, hit: 0.09, range: 4.4, arc: 0.0, kb: 3, color: DK, trail: 2 },
    { anim: 'kneeR', dmg: 11, dur: 0.24, hit: 0.1, range: 4.4, arc: 0.0, kb: 3.5, color: DK, trail: 3, lunge: 2.4 },
    { anim: 'upperL', dmg: 12, dur: 0.26, hit: 0.1, range: 4.4, arc: 0.0, launch: 11, kb: 1, color: DK, trail: 2, hop: 8 },
    { anim: 'slamR', dmg: 20, dur: 0.5, hit: 0.3, range: 5, dive: 11, kb: 13, color: DK, heavy: true, hop: 13 },
  ],
};

export const GON: CharDef = {
  kind: 'gon', name: 'Gon', title: 'GON FREECSS', typ: 'Enhancement · Heavy brawler', color: GRN, css: '#8dff6a', hp: 440, speed: 10.2,
  blurb: 'Burst and close-to-mid range. Builds Nen from every exchange to power up Jajanken, then sacrifices his future for Adult Gon.',
  meter: { name: 'NEN', color: '#6dff5a', start: 0, max: 100 },
  passive: { name: 'Enhancement Awakening', desc: 'Jajanken never spends Nen. Every strike and every wound builds the NEN meter; at a full meter the fist is at its absolute ceiling. A full meter also unlocks the covenant: Adult Gon. In that form the meter is burnt continuously, but both dealing and receiving damage refill it. When the aura runs dry he is broken (slow, fragile, weaker) for 30 seconds.' },
  gainHit: 0.62, gainHurt: 0.4,
  holdForm: true, formGain: 1.35,
  skills: NORMAL, formSkills: ADULT, m1: M1_NORMAL, m1Air: M1_AIR, m1Form: M1_ADULT, m1Mode: 'charge', m1Range: 4.2,
  update(g, c, dt) {
    // The covenant never runs on a clock: Adult Gon burns Nen for as long as he can hold it.
    // Jajanken has taught his body to convert every exchange into aura — strikes AND wounds refill the meter,
    // so the only true limit on the transformation is how much punishment he can keep trading for it.
    if (c.form === 'adult') {
      const drain = 100 / 22;
      c.meter = Math.max(0, c.meter - drain * dt);
      c.formT = c.meter; c.formMax = 100;
      if (Math.random() < dt * 14) g.fx.aura(c.chestPos(), 0x1fe05a, 1, 4.6 * c.scaleNow, 0.7);
      if (c.meter < 18 && Math.random() < dt * 3) g.popup(c, 'AURA FADING', '#bfffa0', 16);
      if (c.meter <= 0) g.endForm(c);
    }
    if (c.form === 'exhaust') {
      c.formT = Math.max(0, c.formT);
      if (Math.random() < dt * 5) g.fx.smoke(c.chestPos(), 1, 0.5, 0x2a3a2a, 0.9, 0.8);
      if (Math.random() < dt * 2) {
        const v = g.enemies(c).find((e) => Math.hypot(e.pos.x - c.pos.x, e.pos.z - c.pos.z) < 5);
        if (v) { g.popup(c, 'BROKEN BODY', '#ff8a8a', 14); c.lock = Math.max(c.lock, 0.18); }
      }
    }
  },
  onHurt(g, vic, _att, amt, o) {
    // Pain is not a cost for him — it is fuel. Taking damage cuts the drain and pushes the meter back up.
    if (o.dot || vic.form !== 'adult') return;
    g.addMeter(vic, amt * 0.22);
  },
  onFormEnd(g, c, was) {
    if (was === 'adult') {
      g.setForm(c, 'exhaust', 30);
      c.speedMult = 0.6;
      c.rangeMult = 0.9;
      c.atkSpeed = 0.82;
      c.dmgTaken = 1.35;
      c.buffDmg = 0.78;
      c.meter = 0;
      g.banner('THE BILL COMES DUE', 'Adult Gon collapses — his body is broken for 30 seconds. Survive.', 4);
      g.popup(c, 'BROKEN BODY · 30s', '#ff8a8a', 26);
      g.flash('#3a0a0a', 0.4);
      sfx('thunder');
    }
  },
};
