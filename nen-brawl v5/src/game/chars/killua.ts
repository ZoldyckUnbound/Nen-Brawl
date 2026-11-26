import * as THREE from 'three';
import type { CharDef, M1Def, SkillDef } from '../defs';
import type { Game } from '../Game';
import type { Fighter } from '../Fighter';
import { sfx } from '../audio';
import { grnd, rnd, aroundTarget, teleport, faceTarget } from './kit';

const CY = 0x8fe3ff;
const YEL = 0xfff27a;
const WH = 0xeaf8ff;

function enhance(c: Fighter) {
  if (c.meter >= 99) {
    c.meter -= 40;
    c.st.auraT = 1;
    return true;
  }
  return false;
}

// ------------------------------------------------------------------ Thunderbolt
function fireBolt(g: Game, c: Fighter, dmg: number, range: number, width: number, stun: number, heavy = false) {
  const A = g.aim(c);
  c.faceNow(A.yaw);
  const origin = c.handPos();
  const dir = A.dir.clone();
  const victims = g.hitBeam(c, origin, dir, range, width, dmg, { stun, kb: 1.5, color: CY, heavy, melee: false });
  const end = victims.length ? victims[0].chestPos() : origin.clone().addScaledVector(dir, range);
  g.fx.bolt(origin, end, CY, 0.22, 0.28 + width * 0.12, 3, 1.1);
  g.fx.bolt(origin, end, 0xffffff, 0.14, 0.1, 0, 0.5);
  g.fx.bolt(end.clone().add(new THREE.Vector3(rnd(-3, 3), 34, rnd(-3, 3))), end, YEL, 0.2, 0.3, 1, 1.6);
  g.fx.explosion(end, CY, 1.6 + width, 0.3);
  g.fx.hitSpark(end, WH, 2);
  g.shake(0.18);
  sfx('thunder');
  // chain lightning to nearby enemies
  for (const e of g.enemies(c)) {
    if (victims.includes(e)) continue;
    const src = victims.find((v) => Math.hypot(v.pos.x - e.pos.x, v.pos.z - e.pos.z) < 10);
    if (!src) continue;
    g.fx.bolt(src.chestPos(), e.chestPos(), CY, 0.2, 0.2, 1, 0.8);
    g.damage(c, e, dmg * 0.6, { stun: stun * 0.7, color: CY, noCrit: true });
  }
  return victims;
}

function thunderbolt(g: Game, c: Fighter, ch: number) {
  const enh = enhance(c);
  const A = g.aim(c);
  c.faceNow(A.yaw);
  c.lock = 0.4 + ch * 0.1;
  c.setAnim('castUp', 0.5);
  c.st.thunderT = 2.2;
  sfx('charge');
  g.fx.gather(c.handPos(), CY, 2.2, 8);
  g.after(0.18 + ch * 0.05, c, () => {
    fireBolt(g, c, (15 + ch * 14) * (enh ? 1.3 : 1), 26 + ch * 10, 1.3 + ch * 0.9 + (enh ? 0.5 : 0), 0.4 + ch * 0.35, ch > 0.6);
    if (enh) g.after(0.12, c, () => fireBolt(g, c, 12, 30, 1.6, 0.3));
  });
}

function barrage(g: Game, c: Fighter) {
  c.lock = 0.95;
  c.setAnim('castUp', 1.0);
  c.st.thunderT = 2.2;
  sfx('charge');
  for (let i = 0; i < 6; i++)
    g.after(0.15 + i * 0.11, c, () => {
      fireBolt(g, c, 9, 32, 1.4, i === 5 ? 0.6 : 0.12, i === 5);
      c.setAnim(i % 2 ? 'castR' : 'castUp', 0.2);
    });
}

// ------------------------------------------------------------------ Lightning Palm
function palm(g: Game, c: Fighter, god: boolean) {
  const quick = (c.st.thunderT ?? 0) > 0;
  c.st.thunderT = 0;
  const A = g.aim(c);
  c.faceNow(A.yaw);
  const t = A.target && Math.hypot(A.target.pos.x - c.pos.x, A.target.pos.z - c.pos.z) < 30 ? A.target : g.target(c, god ? 26 : 18);
  const startup = god ? 0.03 : quick ? 0.05 : 0.09;
  c.lock = startup + 0.5;
  c.invuln = Math.max(c.invuln, startup + 0.12);
  c.setAnim('palmR', 0.4);
  sfx('zap');
  g.fx.gather(c.handPos(), CY, 1.5, 6);
  g.after(startup, c, () => {
    const from = c.pos.clone();
    g.fx.afterimage(from, c.yaw, CY);
    let exec = false;
    if (t && !t.dead) {
      const p = new THREE.Vector3(c.pos.x - t.pos.x, 0, c.pos.z - t.pos.z);
      const L = p.length() || 1;
      const dest = new THREE.Vector3(t.pos.x + (p.x / L) * 2.0, 0, t.pos.z + (p.z / L) * 2.0);
      teleport(g, c, dest);
      if (!t.onGround) {
        c.pos.y = Math.max(0, t.pos.y - 0.2);
        c.vy = 3;
        c.onGround = false;
      }
      faceTarget(c, t);
      exec = t.hp / t.maxHp < 0.22;
    } else {
      const f = g.faceAim(c);
      teleport(g, c, c.pos.clone().addScaledVector(f, god ? 12 : 8));
    }
    g.fx.bolt(from.clone().setY(1.8), c.chestPos(), god ? WH : CY, 0.2, 0.35, 2, 0.8);
    g.fx.burst(c.chestPos(), YEL, 12, 8, 0.3);
    if (god) g.trail(c, 1, WH, 0.3, 0.6);
    sfx('dash');
    g.after(0.04, c, () => {
      const dmg = (god ? 24 : quick ? 20 : 17) * (exec ? 2.4 : 1);
      if (exec) {
        g.stop(0.3);
        g.flash('#ffffff', 0.5);
        g.popup(t!, 'EXECUTION!', '#ffe14a', 30);
        g.fx.pillar(grnd(t!.pos), CY, 2, 36, 0.5);
      }
      const hits = g.hitArc(c, 4.8, -0.3, dmg, { stun: 0.7, kb: 4, color: CY, heavy: true, launch: t && !t.onGround ? 4 : 0 });
      if (hits.length) {
        g.fx.shockwave(grnd(c.pos).addScaledVector(c.forward(), 2), CY, 4, 0.3);
        g.shake(exec ? 0.7 : 0.25);
      }
    });
  });
  return god ? 7 : 9;
}

// ------------------------------------------------------------------ Rhythm Echo
function echo(g: Game, c: Fighter, ch: number, god: boolean) {
  const A = g.aim(c);
  const t = A.target ?? g.target(c, 32);
  if (!t) return 2;
  const base = god ? 8 : 4;
  let n = base + Math.floor(ch * 4);
  const extra = n - base;
  const cost = extra * 6;
  if (c.energy < cost) n = base + Math.floor(c.energy / 6);
  c.energy -= Math.max(0, (n - base) * 6);
  const gap = god ? 0.08 : 0.15;
  const total = 0.1 + n * gap;
  c.lock = total + 0.3;
  c.invuln = Math.max(c.invuln, total + 0.2);
  c.setAnim('crouch', 0.15);
  sfx('dash');
  g.fx.afterimage(c.pos, c.yaw, CY, 0.4);
  const base0 = Math.random() * 6.28;
  const anims = ['jabR', 'jabL', 'kickR', 'palmL', 'hookR', 'roundL'];
  for (let k = 0; k < n; k++) {
    g.after(0.1 + k * gap, c, () => {
      if (t.dead) return;
      const last = k === n - 1;
      const ang = base0 + k * 2.4;
      // decoy afterimages attack from other directions (and vanish when struck)
      for (let j = 1; j <= 2; j++) {
        const cp = aroundTarget(t, ang + j * 2.1, 2.2);
        g.fx.afterimage(cp, Math.atan2(t.pos.x - cp.x, t.pos.z - cp.z), j === 1 ? CY : WH, 0.22, 0.55);
        g.fx.trailSeg(cp.clone().setY(1.8), t.chestPos(), CY, 0.3, 0.12);
        g.fx.burst(cp.clone().setY(1.8), CY, 3, 4, 0.2, 0.22);
      }
      g.fx.afterimage(c.pos, c.yaw, CY, 0.25, 0.5);
      teleport(g, c, aroundTarget(t, ang, 2.0));
      c.pos.y = Math.max(0, t.pos.y - 0.3);
      faceTarget(c, t);
      c.setAnim(last ? 'spinKick' : anims[k % anims.length], last ? 0.3 : 0.16);
      sfx(last ? 'heavy' : 'swing');
      g.fx.bolt(c.chestPos(), t.chestPos(), CY, 0.1, 0.18, 0, 0.5);
      const c0 = new THREE.Vector3(t.pos.x, t.pos.y + 1.4, t.pos.z);
      g.hitSphere(c0, 3.4, c, last ? 15 : god ? 7 : 6.5, last
        ? { launch: 12, kb: 12, stun: 0.8, heavy: true, color: CY }
        : { kb: 0.5, stun: 0.1, color: CY, noCrit: true });
      if (last) {
        g.fx.shockwave(grnd(t.pos), CY, 6, 0.4);
        g.shake(0.4);
      }
    });
  }
  return god ? 11 : 14;
}

// ------------------------------------------------------------------ Godspeed
function godspeed(g: Game, c: Fighter) {
  c.lock = 0.8;
  c.invuln = Math.max(c.invuln, 0.9);
  c.setAnim('summon', 0.8);
  sfx('thunder');
  g.flash('#cfefff', 0.45);
  g.fx.pillar(c.pos, CY, 2.2, 36, 0.8);
  g.fx.shockwave(grnd(c.pos), WH, 12, 0.6);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * 6.28;
    g.fx.bolt(c.chestPos().add(new THREE.Vector3(Math.cos(a) * 6, 8, Math.sin(a) * 6)), c.chestPos(), CY, 0.25, 0.2, 1, 1);
  }
  g.popup(c, 'GODSPEED', '#cfefff', 30);
  g.shake(0.5);
  g.after(0.45, c, () => {
    g.setForm(c, 'god', 25);
    c.meter = Math.max(c.meter, 60);
    c.speedMult = 1.42;
    c.atkSpeed = 1.5;
    c.rangeMult = 1.15;
    c.buffDmg = 1.1;
    c.st.cdRate = 0.3;
    c.dashCd = 0;
  });
}

function overload(g: Game, c: Fighter) {
  c.lock = 1.1;
  c.invuln = Math.max(c.invuln, 1.1);
  c.setAnim('summon', 1.1);
  sfx('charge');
  const M = c.meter;
  const R = 8 + M * 0.08;
  g.fx.telegraph(grnd(c.pos), R, CY, 0.75);
  g.fx.gather(c.chestPos(), WH, 3.5, 12);
  for (let i = 0; i < 4; i++) g.after(0.15 + i * 0.15, c, () => g.fx.shockwave(grnd(c.pos), CY, 4 + i * 2, 0.4));
  g.after(0.8, c, () => {
    const dmg = 28 + M * 0.55;
    g.flash('#ffffff', 0.7);
    g.fx.explosion(c.chestPos(), CY, R * 0.8, 0.8);
    g.fx.pillar(grnd(c.pos), WH, 4, 50, 0.6);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * 6.28;
      g.fx.bolt(c.chestPos(), c.chestPos().add(new THREE.Vector3(Math.cos(a) * R, rnd(-1, 2), Math.sin(a) * R)), i % 2 ? CY : WH, 0.4, 0.3, 2, 1.4);
    }
    g.shake(1.0);
    g.kick(8);
    sfx('boom');
    g.hitSphere(c.chestPos(), R, c, dmg, { stun: 1.0, kb: 14, heavy: true, color: CY, breakGuard: true });
    c.meter = 0;
  });
}

// ------------------------------------------------------------------ Speed of Lightning
const solHit = new WeakMap<Fighter, Set<Fighter>>();

function sol(g: Game, c: Fighter, god: boolean) {
  let dx = c.moveInput.x;
  let dz = c.moveInput.y;
  if (dx * dx + dz * dz < 0.01) {
    const f = g.aim(c).flat;
    dx = f.x;
    dz = f.z;
  }
  // snap to 8 directions
  const ang = Math.round(Math.atan2(dx, dz) / (Math.PI / 4)) * (Math.PI / 4);
  dx = Math.sin(ang);
  dz = Math.cos(ang);
  const dist = god ? 24 : 15;
  const T = 0.16;
  c.faceNow(Math.atan2(dx, dz));
  c.forced = { vx: (dx * dist) / T, vz: (dz * dist) / T, t: T, T, ease: false };
  c.st.solT = T;
  c.st.solDx = dx;
  c.st.solDz = dz;
  c.st.solHold = 1;
  c.st.solHoldE = 0;
  c.ghost = T + 0.12;
  c.invuln = Math.max(c.invuln, T + 0.12);
  c.setAnim('flyKick', T + 0.1);
  solHit.set(c, new Set());
  g.fx.afterimage(c.pos, c.yaw, CY, 0.5);
  g.fx.bolt(c.chestPos(), c.chestPos().add(new THREE.Vector3(dx * dist, 0, dz * dist)), CY, 0.3, 0.3, 2, 1.2);
  g.fx.burst(c.chestPos(), WH, 10, 8, 0.3);
  g.addMeter(c, 3);
  sfx('zap');
  if (god) {
    if ((c.st.chainT ?? 0) > 0) {
      c.st.chainT = 0;
      return 4;
    }
    c.st.chainT = 1.5;
    return 0.3;
  }
  return 3;
}

// ------------------------------------------------------------------ defs
const NORMAL: SkillDef[] = [
  {
    key: 'Z', name: 'Thunderbolt', cost: 0, cd: 7, charge: 1.0, chargeAnim: 'chargeUp', ai: [4, 28],
    desc: 'Fire a lightning strike at medium range. HOLD for a stronger, larger bolt. Stuns and chains to nearby enemies. Max electricity = double bolt.',
    cast: (g, c, ch) => thunderbolt(g, c, ch),
  },
  {
    key: 'X', name: 'Lightning Palm', cost: 0, cd: 9, ai: [3, 22],
    desc: 'Blink to an aimed enemy with an electrified palm. Near-instant, stuns, hits airborne foes. Faster after Thunderbolt. Executes weakened foes.',
    cast: (g, c) => palm(g, c, false),
  },
  {
    key: 'C', name: 'Rhythm Echo', cost: 0, cd: 14, charge: 1.2, chargeAnim: 'charge', ai: [3, 26],
    desc: 'Afterimages strike from every angle, final hit launches. HOLD for more hits (costs extra energy). Hits groups.',
    cast: (g, c, ch) => echo(g, c, ch, false),
  },
  {
    key: 'V', name: 'Godspeed', cost: 0, cd: 75, ai: [0, 30],
    can: (_g, c) => !c.form,
    desc: 'TRANSFORM (25s): blue-white lightning. Huge speed, faster attacks, longer dashes, Whirlwind counters & enhanced skills. Drains electricity.',
    cast: (g, c) => godspeed(g, c),
  },
  {
    key: 'F', name: 'Speed of Lightning', cost: 0, cd: 3, ai: [9, 30],
    desc: 'Dash in 8 directions — HOLD F to keep streaking. Phases through enemies, leaves a lightning trail that shocks. Godspeed: chain two dashes.',
    cast: (g, c) => sol(g, c, false),
  },
];

const GOD: SkillDef[] = [
  { key: 'Z', name: 'Thunderbolt Barrage', cost: 0, cd: 5, ai: [4, 30], desc: 'Releases multiple consecutive lightning strikes.', cast: (g, c) => barrage(g, c) },
  { key: 'X', name: 'Lightning Palm: Godspeed', cost: 0, cd: 5, ai: [3, 26], desc: 'An almost instantaneous high-speed dash attack.', cast: (g, c) => palm(g, c, true) },
  { key: 'C', name: 'Rhythm Echo: Godspeed', cost: 0, cd: 9, ai: [3, 28], desc: 'An extremely fast afterimage assault from multiple directions.', cast: (g, c) => echo(g, c, 0.5, true) },
  {
    key: 'V', name: 'Godspeed Overload', cost: 0, cd: 20, ai: [0, 10], can: (_g, c) => c.meter >= 25,
    desc: 'Release ALL stored electricity in a massive lightning explosion (ends Godspeed).', cast: (g, c) => overload(g, c),
  },
  { key: 'F', name: 'Speed of Lightning', cost: 0, cd: 3, ai: [9, 30], desc: 'Chain dashes: two consecutive dashes before a slightly longer recharge.', cast: (g, c) => sol(g, c, true) },
];

const M1_NORMAL: M1Def = {
  recovery: 0.8, window: 0.6,
  steps: [
    { anim: 'jabR', dmg: 7, dur: 0.2, hit: 0.06, range: 3.5, arc: 0.25, kb: 0.5, color: CY, trail: 1, lunge: 1.3 },
    { anim: 'jabL', dmg: 7, dur: 0.2, hit: 0.06, range: 3.5, arc: 0.25, kb: 0.5, color: CY, trail: 2, lunge: 2.2 },
    { anim: 'palmR', dmg: 8, dur: 0.2, hit: 0.07, range: 3.6, arc: 0.2, kb: 1.2, color: YEL, trail: 1, stun: 0.12, lunge: 1.4 },
    { anim: 'roundL', dmg: 9, dur: 0.22, hit: 0.09, range: 3.9, arc: -0.1, kb: 4.5, color: CY, trail: 3, side: true },
    { anim: 'elbowR', dmg: 9, dur: 0.22, hit: 0.08, range: 3.5, arc: 0.1, kb: 0.8, color: YEL, trail: 1, behind: true },
    { anim: 'flyKick', dmg: 12, dur: 0.3, hit: 0.12, range: 4.4, arc: 0.1, kb: 6, launch: 8, color: CY, trail: 3, lunge: 5.5, heavy: true, breakGuard: true },
  ],
};
const M1_AIR: M1Def = {
  recovery: 0.7, window: 0.6,
  steps: [
    { anim: 'jabR', dmg: 7, dur: 0.2, hit: 0.06, range: 3.6, arc: 0.1, kb: 0.5, color: CY, trail: 1 },
    { anim: 'roundR', dmg: 7, dur: 0.2, hit: 0.08, range: 3.8, arc: -0.1, kb: 3.5, color: CY, trail: 3, side: true },
    { anim: 'elbowL', dmg: 8, dur: 0.2, hit: 0.07, range: 3.5, arc: 0.1, kb: 1, color: YEL, trail: 2 },
    { anim: 'spinKick', dmg: 9, dur: 0.24, hit: 0.11, range: 4.2, arc: -0.3, kb: 3.5, color: CY, trail: 3 },
    { anim: 'palmL', dmg: 9, dur: 0.22, hit: 0.08, range: 3.8, arc: 0.0, kb: 1.5, color: YEL, trail: 2 },
    { anim: 'diveKick', dmg: 12, dur: 0.32, hit: 0.1, range: 4, dive: 4.8, hop: 3, kb: 6, color: CY, trail: 3, heavy: true },
  ],
};
const M1_GOD: M1Def = {
  recovery: 0.5, window: 0.5,
  steps: [
    { anim: 'jabR', dmg: 8, dur: 0.13, hit: 0.03, range: 4.0, arc: 0.1, kb: 0.4, color: WH, trail: 1, lunge: 1.8 },
    { anim: 'palmL', dmg: 9, dur: 0.14, hit: 0.04, range: 4.0, arc: 0.1, kb: 0.8, color: WH, trail: 2, hits: 2, lunge: 1.6 },
    { anim: 'roundL', dmg: 10, dur: 0.15, hit: 0.05, range: 4.3, arc: -0.2, kb: 4.5, color: CY, trail: 3, side: true },
    { anim: 'elbowR', dmg: 10, dur: 0.14, hit: 0.04, range: 4.0, arc: 0.1, kb: 0.8, color: WH, trail: 1, behind: true },
    { anim: 'upperR', dmg: 11, dur: 0.16, hit: 0.05, range: 4.0, arc: 0.1, kb: 1, launch: 9, color: CY, trail: 1 },
    { anim: 'flyKick', dmg: 14, dur: 0.3, hit: 0.08, range: 5, arc: -0.2, kb: 8, launch: 6, color: WH, trail: 3, lunge: 6.5, shock: 7.5, heavy: true, breakGuard: true },
  ],
};

export const KILLUA: CharDef = {
  kind: 'killua', name: 'Killua', title: 'KILLUA ZOLDYCK', typ: 'Transmutation · Lightning assassin', color: CY, css: '#8fe3ff', hp: 400, speed: 11.2,
  blurb: 'Speed, stuns and relentless rapid-click combos. Electricity powers up his skills; Godspeed makes him untouchable.',
  meter: { name: 'ELECTRICITY', color: '#7fd8ff', start: 30, max: 100 },
  passive: { name: 'Electricity', desc: 'Hits and dashes build electricity (enhanced attacks at max). Repeated hits electrically charge enemies — 5 stacks discharge a stun. Drains during Godspeed (Whirlwind auto-counters close attacks).' },
  gainHit: 0.9, gainHurt: 0.2,
  skills: NORMAL, formSkills: GOD, m1: M1_NORMAL, m1Air: M1_AIR, m1Form: M1_GOD, m1Mode: 'click', m1Range: 3.9,
  dmgBonus: (c) => (c.meter >= 99 ? 1.15 : 1),
  onDash(g, c) {
    g.addMeter(c, 4);
  },
  onDealt(g, att, vic, _a, o) {
    if (att.form === 'god' && o.melee) att.meter = Math.max(0, att.meter - 0.45);
    if (o.dot) return;
    vic.st.shock = Math.min(5, (vic.st.shock ?? 0) + 1);
    vic.st.shockT = 5;
    if (vic.st.shock >= 5) {
      vic.st.shock = 0;
      g.fx.bolt(vic.chestPos().add(new THREE.Vector3(0, 9, 0)), vic.chestPos(), CY, 0.25, 0.3, 1, 1);
      g.popup(vic, 'SHOCKED!', '#9fe8ff', 22);
      g.stunFighter(vic, 0.5);
      g.damage(att, vic, 12, { noCrit: true, color: CY, noMeter: true });
    }
  },
  update(g, c, dt) {
    if (c.form === 'god') {
      c.meter -= 3.6 * dt;
      if (c.meter <= 0) {
        c.meter = 0;
        g.endForm(c);
      }
    }
    const dashing = (c.st.solT ?? 0) > 0;
    if (dashing) {
      const set = solHit.get(c) ?? new Set<Fighter>();
      solHit.set(c, set);
      const vs = g.hitSphere(c.chestPos(), 2.6, c, 5, { color: CY, noCrit: true, exclude: [...set], kb: 0.5, noMeter: false });
      vs.forEach((v) => set.add(v));
      const p = c.chestPos();
      const prev = c.trailPrev[0];
      if (prev) g.fx.trailSeg(prev, p, c.form === 'god' ? WH : CY, 0.7, 0.55);
      c.trailPrev[0] = p.clone();
    } else {
      delete c.trailPrev[0];
      if (c.st.solHold && c.isPlayer && g.keyDown('KeyF') && c.stun <= 0 && c.lock <= 0.0001 + 0.2) {
        c.st.solHoldE = (c.st.solHoldE ?? 0) + dt;
        if (c.st.solHoldE < 1.3) {
          const sp = c.form === 'god' ? 34 : 28;
          c.forced = { vx: c.st.solDx * sp, vz: c.st.solDz * sp, t: 0.08, T: 0.08, ease: false };
          c.st.solT = 0.08;
          c.ghost = 0.12;
          c.lock = 0;
          c.invuln = Math.max(c.invuln, 0.1);
          c.setAnim('flyKick', 0.12);
        } else c.st.solHold = 0;
      } else if (c.st.solHold) c.st.solHold = 0;
    }
  },
};
