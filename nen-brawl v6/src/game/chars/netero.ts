import * as THREE from 'three';
import type { CharDef, SkillDef } from '../defs';
import type { Game } from '../Game';
import type { Fighter } from '../Fighter';
import { sfx } from '../audio';
import { begin, grnd, m1, S, rnd } from './kit';
import { buildHand, buildGuanyin, setOpacity, disposeObj } from './props';

const GD = 0xffcf4a;

/** a giant golden hand that thrusts from `from` to `to` and fades */
function handStrike(g: Game, from: THREE.Vector3, to: THREE.Vector3, scale: number, dur = 0.3) {
  const h = buildHand(GD, scale);
  h.position.copy(from);
  h.lookAt(to);
  const dir = to.clone().sub(from);
  g.fx.custom(h, dur, (p) => {
    h.position.copy(from).addScaledVector(dir, Math.min(1, p * 4));
    setOpacity(h, Math.max(0, 1 - p * p));
  }, () => disposeObj(h));
}

/** Zero Hand — an instant, reaction-less strike. Hold to focus: longer reach, harder hit. */
function zeroHand(g: Game, c: Fighter, ch: number) {
  begin(g, c, 'palmR', 0.36, 0.34);
  sfx('swing');
  g.after(0.07, c, () => {
    const A = g.aim(c);
    c.faceNow(A.yaw);
    const o = c.chestPos().addScaledVector(A.flat, 1.0);
    const len = 14 + ch * 10;
    const hits = g.hitBeam(c, o, A.dir, len, 1.7 + ch * 0.9, 30 + ch * 22, { kb: 11 + ch * 4, stun: 0.3 + ch * 0.3, heavy: true, color: GD, skill: true, noCrit: true });
    const end = o.clone().addScaledVector(A.dir, len);
    g.fx.beam(o, end, GD, 1.0 + ch * 0.6, 0.28);
    g.fx.beam(o, end, 0xffffff, 0.35, 0.2);
    g.fx.speedLines(o.clone().addScaledVector(A.dir, 3), A.dir, GD, 14, 8, 0.3);
    handStrike(g, o, o.clone().addScaledVector(A.dir, Math.min(len, 9)), 1.0 + ch * 0.5, 0.3);
    g.fx.ring(grnd(c.pos), GD, 0.5, 4, 0.3);
    g.shake(0.3 + ch * 0.2);
    sfx('boom');
    for (const h of hits) {
      g.fx.impact(h.chestPos(), GD, 1.6 + ch, A.dir);
      g.popup(h, 'ZERO HAND', '#ffe07a', 22);
    }
    g.addMeter(c, hits.length * 8);
  });
}

/** 10,000 Prayers of Gratitude — a blistering flurry of palm strikes */
function prayers(g: Game, c: Fighter) {
  const A = g.aim(c);
  c.faceNow(A.yaw);
  c.lock = 1.3;
  c.setAnim('pray', 0.22);
  sfx('charge');
  g.fx.gather(c.chestPos(), GD, 2.2, 10);
  const t = A.target ?? g.target(c, 16);
  g.after(0.2, c, () => {
    if (t && !t.dead) {
      const d = new THREE.Vector3(t.pos.x - c.pos.x, 0, t.pos.z - c.pos.z);
      const L = d.length();
      d.normalize();
      g.fx.afterimage(c.pos, c.yaw, GD);
      g.dashF(c, d, Math.max(0, Math.min(L - 2.2, 10)), 0.1);
    }
  });
  const n = 12;
  for (let i = 0; i < n; i++) {
    g.after(0.34 + i * 0.075, c, () => {
      const tt = t && !t.dead ? t : g.target(c, 12);
      if (tt) c.faceNow(Math.atan2(tt.pos.x - c.pos.x, tt.pos.z - c.pos.z));
      const f = c.forward();
      const last = i === n - 1;
      c.setAnim(i % 2 ? 'palmL' : 'jabR', 0.1);
      const p = c.chestPos().addScaledVector(f, 2.0).add(new THREE.Vector3(rnd(-0.8, 0.8), rnd(-0.6, 0.6), rnd(-0.8, 0.8)));
      handStrike(g, c.chestPos().addScaledVector(f, 0.6).add(new THREE.Vector3(rnd(-1.2, 1.2), rnd(-0.8, 0.8), 0)), p, 0.45, 0.14);
      const hits = g.hitArc(c, 4.8, 0.0, last ? 16 : 4.2, { kb: last ? 9 : 0.2, launch: last ? 8 : 0, stun: last ? 0.5 : 0.09, heavy: last, color: GD, noCrit: !last, skill: true });
      if (hits.length) g.fx.impact(p, GD, last ? 1.8 : 0.7);
      g.fx.trailSeg(c.chestPos(), p, i % 2 ? 0xffffff : GD, 0.18, 0.12);
      sfx(last ? 'heavy' : 'swing');
      if (last) {
        g.shake(0.35);
        g.fx.shockwave(grnd(p), GD, 5, 0.4);
      }
    });
  }
}

/** Bodhisattva's Palm — a colossal golden hand slams down on the marked ground */
function palm(g: Game, c: Fighter) {
  const A = begin(g, c, 'castUp', 0.55, 0.7);
  sfx('charge');
  const tgt = A.target ? grnd(A.target.pos) : grnd(A.ground);
  const dd = tgt.clone().sub(grnd(c.pos));
  if (dd.length() > 30) tgt.copy(grnd(c.pos)).addScaledVector(dd.normalize(), 30);
  g.fx.telegraph(tgt, 6.2, GD, 0.7);
  g.fx.gather(c.handPos(), GD, 2, 8);
  g.later(0.7, () => {
    const h = buildHand(GD, 3.6);
    h.rotation.x = Math.PI / 2; // palm faces down
    h.position.set(tgt.x, 26, tgt.z);
    g.fx.custom(h, 0.5, (p) => {
      const e = Math.min(1, p / 0.28);
      h.position.y = 26 - e * 24.5;
      setOpacity(h, p < 0.5 ? 1 : Math.max(0, 1 - (p - 0.5) * 2));
    }, () => disposeObj(h));
    g.later(0.14, () => {
      g.fx.beamColumn(tgt, GD, 5, 24, 0.5);
      g.fx.shockwave(tgt, GD, 8, 0.6);
      g.fx.crack(tgt, GD, 6, 3.5);
      g.fx.debris(tgt, 16, 9);
      g.fx.explosion(tgt.clone().setY(1.2), GD, 4, 0.45);
      g.shake(0.6);
      g.flash('#ffd36a', 0.25);
      sfx('boom');
      const hits = g.hitSphere(tgt, 6.6, c, 36, { kb: 10, stun: 0.7, heavy: true, color: GD, skill: true });
      hits.forEach((v) => g.fx.impact(v.chestPos(), GD, 2.2));
    });
  });
}

// ------------------------------------------------------------------ 100-Type Guanyin transformation
const BODHI_TIME = 16;
const statue = (c: Fighter) => c.rig.props.bodhi as THREE.Group | undefined;
/** world position of one of the Bodhisattva's shoulders */
function shoulder(c: Fighter, side: number) {
  const G = statue(c);
  c.root.updateMatrixWorld(true);
  if (!G) return c.chestPos().add(new THREE.Vector3(side * 1.5, 1.5, 0));
  return G.localToWorld(new THREE.Vector3(side * 2.1, 6.3, 1.0));
}
function palmFrom(g: Game, c: Fighter, side: number, to: THREE.Vector3, scale = 1.5, dur = 0.26) {
  handStrike(g, shoulder(c, side), to, scale, dur);
}

/** 100-Type Guanyin Bodhisattva — the transformation */
function guanyin(g: Game, c: Fighter) {
  const A = g.aim(c);
  c.faceNow(A.yaw);
  c.lock = 1.4;
  c.invuln = Math.max(c.invuln, 1.5);
  c.setAnim('pray', 1.0);
  sfx('charge');
  g.popup(c, '100-TYPE GUANYIN BODHISATTVA', '#ffe07a', 26);
  g.flash('#ffd36a', 0.35);
  g.shake(0.45);
  g.fx.beamColumn(grnd(c.pos), GD, 3.2, 26, 1.4);
  g.fx.shockwave(grnd(c.pos), GD, 12, 0.8);
  g.fx.ring(grnd(c.pos), 0xffffff, 1, 8, 0.6);
  g.fx.gather(c.chestPos(), GD, 3, 12);
  g.after(0.55, c, () => {
    const G = buildGuanyin();
    G.position.set(0, 0, -3.6);
    G.scale.setScalar(0.2);
    G.userData.born = g.time;
    c.rig.root.add(G);
    c.rig.props.bodhi = G;
    g.setForm(c, 'bodhi', BODHI_TIME);
    c.dmgTaken = 0.8; // the Bodhisattva shields its master
    c.atkSpeed = 1.15;
    c.speedMult = 1.06;
    c.rangeMult = 1;
    g.fx.explosion(grnd(c.pos).setY(1.5), GD, 5, 0.5);
    g.fx.pillar(grnd(c.pos), GD, 3, 26, 0.9);
    sfx('boom');
  });
}

/** Z — Thousand Palms: the statue's many arms hammer the ground ahead */
function barrage(g: Game, c: Fighter) {
  begin(g, c, 'pray', 0.2, 0.9);
  sfx('charge');
  const n = 10;
  for (let i = 0; i < n; i++) {
    g.after(0.2 + i * 0.07, c, () => {
      const a = g.aim(c);
      c.faceNow(a.yaw);
      const last = i === n - 1;
      const ctr = grnd(c.pos).addScaledVector(a.flat, 6.5 + (i % 3) * 1.7);
      const to = ctr.clone().add(new THREE.Vector3(rnd(-2.2, 2.2), 1.2 + rnd(-0.5, 1), rnd(-2.2, 2.2)));
      c.setAnim(i % 2 ? 'palmL' : 'palmR', 0.1);
      palmFrom(g, c, i % 2 ? 1 : -1, to, last ? 2.2 : 1.1, 0.2);
      g.fx.impact(to, GD, last ? 1.6 : 0.7);
      sfx(last ? 'heavy' : 'swing');
      if (last) { g.shake(0.45); g.fx.shockwave(ctr, GD, 6, 0.45); g.fx.crack(ctr, GD, 4, 2); }
      g.hitSphere(ctr.clone().setY(1.6), last ? 5.4 : 3.7, c, last ? 15 : 4.2, { kb: last ? 11 : 0.4, stun: last ? 0.5 : 0.1, launch: last ? 8 : 0, heavy: last, color: GD, noCrit: !last, skill: true });
    });
  }
}

/** X — Bodhisattva's Judgement: a colossal palm falls on the marked ground */
function judgement(g: Game, c: Fighter) {
  const A = begin(g, c, 'castUp', 0.45, 0.55);
  sfx('charge');
  const tgt = A.target ? grnd(A.target.pos) : grnd(A.ground);
  const dd = tgt.clone().sub(grnd(c.pos));
  if (dd.length() > 38) tgt.copy(grnd(c.pos)).addScaledVector(dd.normalize(), 38);
  g.fx.telegraph(tgt, 7.6, GD, 0.5);
  palmFrom(g, c, 1, tgt.clone().setY(9), 1.2, 0.3);
  g.later(0.5, () => {
    const h = buildHand(GD, 4.6);
    h.rotation.x = Math.PI / 2;
    h.position.set(tgt.x, 30, tgt.z);
    g.fx.custom(h, 0.45, (p) => {
      h.position.y = 30 - Math.min(1, p / 0.25) * 28.5;
      setOpacity(h, p < 0.5 ? 1 : Math.max(0, 1 - (p - 0.5) * 2));
    }, () => disposeObj(h));
    g.later(0.12, () => {
      g.fx.beamColumn(tgt, GD, 6, 28, 0.5);
      g.fx.shockwave(tgt, GD, 11, 0.65);
      g.fx.crack(tgt, GD, 8, 3.5);
      g.fx.debris(tgt, 22, 11);
      g.fx.explosion(tgt.clone().setY(1.2), GD, 5, 0.5);
      g.shake(0.7);
      g.flash('#ffd36a', 0.25);
      sfx('boom');
      const hits = g.hitSphere(tgt, 7.8, c, 38, { kb: 12, stun: 0.8, launch: 5, heavy: true, color: GD, skill: true });
      hits.forEach((v) => g.fx.impact(v.chestPos(), GD, 2.2));
    });
  });
}

/** C — Sweeping Palm: a titanic backhand across the whole front */
function sweepPalm(g: Game, c: Fighter) {
  begin(g, c, 'slashSide', 0.4, 0.5);
  sfx('swing');
  g.after(0.2, c, () => {
    const a = g.aim(c);
    c.faceNow(a.yaw);
    const f = c.forward();
    const mid = c.chestPos().addScaledVector(f, 5);
    g.fx.slashArc(mid, f, 0, 11, 0.95, GD, 0.38);
    g.fx.slashArc(mid.clone().setY(mid.y + 0.6), f, 0.18, 9, 0.8, 0xffffff, 0.3);
    palmFrom(g, c, -1, mid.clone().addScaledVector(f, 3), 2.4, 0.3);
    g.fx.shockwave(grnd(c.pos).addScaledVector(f, 6), GD, 8, 0.5);
    g.shake(0.5);
    sfx('boom');
    const hits = g.hitArc(c, 12, -0.4, 28, { kb: 13, launch: 5, stun: 0.5, heavy: true, color: GD, skill: true });
    hits.forEach((v) => g.fx.impact(v.chestPos(), GD, 2));
  });
}

/** V — Zero Hand: Hundredfold — the Bodhisattva fires one perfect, piercing strike */
function zeroHundred(g: Game, c: Fighter) {
  const A = begin(g, c, 'pray', 0.55, 0.95);
  sfx('charge');
  g.fx.telegraphLine(grnd(c.pos), A.flat, 44, 3.4, GD, 0.55);
  g.fx.gather(shoulder(c, 1), GD, 2.4, 10);
  g.fx.gather(shoulder(c, -1), GD, 2.4, 10);
  g.after(0.55, c, () => {
    const a = g.aim(c);
    c.faceNow(a.yaw);
    c.setAnim('palmR', 0.3);
    const o = c.chestPos().addScaledVector(a.flat, 1.5);
    const dir = a.flat.clone();
    const end = o.clone().addScaledVector(dir, 44);
    const hits = g.hitBeam(c, o, dir, 44, 3.4, 55, { kb: 15, stun: 0.8, launch: 4, heavy: true, color: GD, skill: true, noCrit: true });
    g.fx.beam(o, end, GD, 3.2, 0.4);
    g.fx.beam(o, end, 0xffffff, 1.2, 0.3);
    g.fx.speedLines(o.clone().addScaledVector(dir, 5), dir, GD, 20, 12, 0.4);
    palmFrom(g, c, 1, o.clone().addScaledVector(dir, 12), 3.4, 0.35);
    g.fx.shockwave(grnd(c.pos), GD, 7, 0.5);
    g.fx.explosion(end.clone().setY(1.5), GD, 4, 0.45);
    g.flash('#fff2b0', 0.4);
    g.shake(0.8);
    sfx('boom');
    hits.forEach((v) => { g.fx.impact(v.chestPos(), GD, 2.6, dir); g.popup(v, 'ZERO HAND', '#ffe07a', 24); });
  });
}

/** F — Guanyin Step: the whole Bodhisattva lunges forward in a flash */
function guanyinStep(g: Game, c: Fighter) {
  const A = begin(g, c, 'palmR', 0.3, 0.3);
  c.invuln = Math.max(c.invuln, 0.3);
  sfx('dash');
  g.fx.afterimage(c.pos, c.yaw, GD, 0.5);
  g.dashF(c, A.flat, 15, 0.16);
  g.trail(c, 1, GD, 0.4, 0.8);
  g.trail(c, 3, GD, 0.4, 0.6);
  g.after(0.17, c, () => {
    const f = c.forward();
    palmFrom(g, c, 1, c.chestPos().addScaledVector(f, 5), 2.0, 0.24);
    g.fx.shockwave(grnd(c.pos).addScaledVector(f, 3), GD, 6, 0.4);
    g.shake(0.35);
    sfx('heavy');
    const hits = g.hitSphere(grnd(c.pos).addScaledVector(f, 2.5).setY(1.4), 5.2, c, 15, { kb: 6, stun: 0.35, heavy: true, color: GD, skill: true });
    hits.forEach((v) => g.fx.impact(v.chestPos(), GD, 1.5));
  });
}

/** Zen Step — vanish and reappear behind the foe with a palm strike */
function zen(g: Game, c: Fighter) {
  const A = g.aim(c);
  const t = A.target ?? g.target(c, 26);
  c.faceNow(A.yaw);
  c.lock = 0.4;
  c.invuln = Math.max(c.invuln, 0.35);
  sfx('dash');
  g.fx.afterimage(c.pos, c.yaw, GD, 0.6);
  g.fx.burst(c.chestPos(), GD, 14, 8, 0.3);
  if (t) {
    g.fx.speedLines(c.chestPos(), A.flat, GD, 10, 6, 0.3);
    g.after(0.08, c, () => {
      const fw = new THREE.Vector3(Math.sin(t.yaw), 0, Math.cos(t.yaw));
      c.pos.x = t.pos.x - fw.x * 2.0;
      c.pos.z = t.pos.z - fw.z * 2.0;
      g.clampPos(c.pos);
      c.faceNow(Math.atan2(t.pos.x - c.pos.x, t.pos.z - c.pos.z));
      g.fx.burst(c.chestPos(), GD, 14, 8, 0.3);
      c.setAnim('palmR', 0.3);
    });
    g.after(0.2, c, () => {
      const hits = g.hitArc(c, 5, 0.0, 16, { kb: 6, stun: 0.3, heavy: true, color: GD, skill: true });
      g.fx.slashX(c.chestPos().addScaledVector(c.forward(), 1.5), c.forward(), GD, 4, 0.3);
      hits.forEach((v) => g.fx.impact(v.chestPos(), GD, 1.5));
      sfx('heavy');
    });
  } else {
    g.dashF(c, A.flat, 13, 0.18);
    g.trail(c, 1, GD, 0.35, 0.7);
  }
}

const SKILLS: SkillDef[] = [
  { key: 'Z', name: 'Zero Hand', cost: 0, cd: 9, charge: 0.8, chargeAnim: 'chargePalm', ai: [3, 22], desc: 'A strike with no wind-up that reaches farther than it should. HOLD to focus for longer reach, more damage and a longer stun.', cast: (g, c, ch) => zeroHand(g, c, ch) },
  { key: 'X', name: '10,000 Prayers', cost: 0, cd: 10, ai: [2, 14], desc: 'Close the gap and unleash twelve blinding palm strikes — the final one launches. A lifetime of gratitude, one blow at a time.', cast: (g, c) => prayers(g, c) },
  { key: 'C', name: "Bodhisattva's Palm", cost: 0, cd: 13, ai: [4, 28], desc: 'Mark the ground; after a beat a colossal golden hand crashes down, stunning everyone caught beneath it.', cast: (g, c) => palm(g, c) },
  {
    key: 'V', name: '100-Type Guanyin Bodhisattva', cost: 55, cd: 70, ai: [0, 24], can: (_g, c) => !c.form,
    desc: "TRANSFORMATION (55 energy): the 100-Type Guanyin Bodhisattva rises behind you for 16s. Every attack becomes the statue's — giant palms, a thousand-palm barrage, judgement slam, sweep and Zero Hand. You take 20% less damage while it stands.",
    cast: (g, c) => guanyin(g, c),
  },
  { key: 'F', name: 'Zen Step', cost: 0, cd: 6, ai: [6, 26], desc: 'Vanish and reappear behind the aimed enemy with a palm strike. Without a target, a long gliding dash.', cast: (g, c) => zen(g, c) },
];

export const NETERO: CharDef = {
  kind: 'netero', name: 'Netero', title: 'ISAAC NETERO', typ: 'Enhancement · Hunter Chairman', color: GD, css: '#ffd35a', hp: 440, speed: 10.6,
  blurb: 'The 12th Chairman of the Hunter Association. Terrifyingly fast, impossibly precise and backed by a towering golden Bodhisattva.',
  meter: { name: 'GRATITUDE', color: '#ffd35a', start: 0, max: 100 },
  passive: { name: 'Zen Mastery', desc: 'Landing hits builds Gratitude; at full, you are blessed for 5s (+12% damage, +20% attack speed). Dashing grants a short burst of speed.' },
  gainHit: 0.7, gainHurt: 0.3,
  skills: SKILLS,
  update(g, c, dt) {
    const p = (c.st.prayerT ?? 0) > 0;
    const z = (c.st.zenT ?? 0) > 0;
    if (c.form !== 'bodhi') {
      c.atkSpeed = p ? 1.2 : 1;
      c.buffDmg = p ? 1.12 : 1;
      if (c.form !== 'exhaust') c.speedMult = z ? 1.15 : 1;
    }
    if (p && Math.random() < dt * 8) g.fx.aura(c.pos, GD, 1, 3.4 * c.scaleNow, 0.9);
    // animate the Bodhisattva that stands behind Netero
    const G = statue(c);
    if (G && c.form === 'bodhi') {
      const age = g.time - (G.userData.born as number);
      const k = Math.min(1, age / 0.7);
      G.scale.setScalar((0.25 + 0.75 * (1 - Math.pow(1 - k, 3))) * 1.18);
      G.position.y = Math.sin(g.time * 2) * 0.25 - (1 - k) * 4;
      (G.userData.arms as THREE.Object3D).rotation.z += dt * 0.9;
      (G.userData.halo as THREE.Object3D).rotation.z += dt * 1.4;
      (G.userData.halo2 as THREE.Object3D).rotation.z -= dt * 2;
      setOpacity(G, Math.min(1, k * 1.5, c.formT / 1.0));
      if (Math.random() < dt * 30) {
        const wp = G.getWorldPosition(new THREE.Vector3());
        g.fx.aura(new THREE.Vector3(wp.x, 0, wp.z), GD, 1, 9, 2.6);
      }
    }
  },
  onFormEnd(g, c, was) {
    if (was !== 'bodhi') return;
    g.popup(c, 'THE BODHISATTVA FADES', '#ffe07a', 22);
    g.fx.pillar(grnd(c.pos), GD, 2, 14, 0.5);
    g.fx.burst(c.chestPos(), GD, 24, 8, 0.6);
    g.applySlow(c, 2.5, 0.85); // the strain of a lifetime of prayer
    c.hp = Math.max(1, c.hp - c.maxHp * 0.04);
  },
  formSkills: [
    { key: 'Z', name: 'Thousand Palms', cost: 0, cd: 6, ai: [3, 16], desc: "The statue's hundred arms hammer the ground ahead with ten rapid palms — the last one launches.", cast: (g, c) => barrage(g, c) },
    { key: 'X', name: "Bodhisattva's Judgement", cost: 0, cd: 9, ai: [4, 36], desc: 'A colossal palm crashes down on the marked ground: huge radius, long stun.', cast: (g, c) => judgement(g, c) },
    { key: 'C', name: 'Sweeping Palm', cost: 0, cd: 7, ai: [0, 11], desc: 'The statue backhands the whole front: wide arc, huge knockback and launch.', cast: (g, c) => sweepPalm(g, c) },
    { key: 'V', name: 'Zero Hand: Hundredfold', cost: 0, cd: 14, ai: [4, 40], desc: 'The Bodhisattva fires one perfect piercing strike across the arena. Massive damage and stun.', cast: (g, c) => zeroHundred(g, c) },
    { key: 'F', name: 'Guanyin Step', cost: 0, cd: 4, ai: [6, 22], desc: 'The whole statue lunges forward in a flash, slamming a palm where you land.', cast: (g, c) => guanyinStep(g, c) },
  ],
  m1Form: m1(0.5, 0.9, [
    S('palmR', 11, 0.24, 0.08, 8.4, { color: GD, trail: 1, arc: -0.05, kb: 1.4, lunge: 2.4 }),
    S('palmL', 11, 0.24, 0.08, 8.4, { color: GD, trail: 2, arc: -0.05, kb: 1.4 }),
    S('jabR', 13, 0.26, 0.09, 8.8, { color: GD, trail: 1, arc: -0.05, kb: 3 }),
    S('slamR', 22, 0.42, 0.15, 9.4, { color: GD, trail: 1, arc: -0.2, kb: 9, launch: 5, heavy: true, shock: 5.5, lunge: 3 }),
  ]),
  onM1(g, c, s) {
    if (c.form !== 'bodhi') return;
    const f = c.forward();
    const to = c.chestPos().addScaledVector(f, Math.min(7.5, s.range * 0.85));
    palmFrom(g, c, c.combo % 2 ? 1 : -1, to, s.heavy ? 2.3 : 1.4, 0.22);
    g.fx.impact(to, GD, s.heavy ? 1.4 : 0.6, f);
  },

  onDealt(g, att) {
    if (att.meter >= 99) {
      att.meter = 0;
      att.st.prayerT = 5;
      g.popup(att, 'GRATITUDE', '#ffe07a', 22);
      g.fx.pillar(att.pos, GD, 1.8, 10, 0.5);
    }
  },
  onDash(_g, c) {
    c.st.zenT = 1.6;
  },
  m1: m1(0.7, 0.8, [
    S('jabR', 9, 0.26, 0.09, 4.4, { color: GD, trail: 1, lunge: 1.8 }),
    S('palmL', 9, 0.26, 0.09, 4.4, { color: GD, trail: 2 }),
    S('kickR', 10, 0.28, 0.11, 4.7, { color: GD, trail: 3, kb: 2.2 }),
    S('elbowL', 10, 0.26, 0.09, 4.3, { color: GD, trail: 2, kb: 1 }),
    S('palmR', 17, 0.42, 0.16, 5.3, { color: GD, trail: 1, kb: 8, heavy: true, launch: 6, shock: 3.5, lunge: 3 }),
  ]),
  m1Air: m1(0.7, 0.8, [
    S('jabR', 9, 0.26, 0.09, 4.2, { color: GD, trail: 1 }),
    S('jabL', 9, 0.26, 0.09, 4.2, { color: GD, trail: 2 }),
    S('kickR', 10, 0.28, 0.11, 4.4, { color: GD, trail: 3, kb: 2 }),
    S('spinKick', 11, 0.32, 0.15, 4.6, { color: GD, trail: 3, arc: -0.3, kb: 4, side: true }),
    S('slamR', 15, 0.45, 0.2, 4.4, { color: GD, arc: 0.0, kb: 2, slam: true, heavy: true, shock: 4.5 }),
  ]),
  m1Mode: 'repeat', m1Range: 4.5,
};
