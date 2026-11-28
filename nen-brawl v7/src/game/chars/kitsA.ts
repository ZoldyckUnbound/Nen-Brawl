/** Reworked kits – part A: Gon, Killua, Leorio, Kurapika, Hisoka, Morel */
import * as THREE from 'three';
import type { CharDef } from '../defs';
import type { Fighter } from '../Fighter';
import { sfx } from '../audio';
import {
  type Kit, skill, prep, cut, blast, rush, shot, fan, field, delayed, pullTo, tele, seq, mark, marks, clearMark, decayMarks, spot, stance,
  gnd, rotY, rnd, clamp, V3, stage, behind, WHITE,
} from './mv';
import { gy } from '../terrain';

// ============================================================ GON  –  Enhancement: Jajanken, Hunt stacks, the covenant
export const gon = (old: CharDef): Kit => {
  const col = old.color, DK = 0x2fd05a, AMB = 0xffb04a;
  const ex = (c: Fighter) => { if ((c.st.execT ?? 0) > 0) { c.st.execT = 0; return 1.4; } return 1; };
  const enhance = (c: Fighter) => { if (c.meter >= 60) { c.meter -= 20; c.st.auraT = 1.2; return true; } return false; };
  const leap = (adult: boolean) => skill('F', adult ? 'Adult Nen Leap' : 'Nen Leap', 0, adult ? 4 : 5, [8, 30], adult ? 'A huge, fast leap. The landing shockwave staggers and marks everything near.' : 'Pounce across the field (hold to go farther, aim up to jump high). The landing shockwave staggers enemies and stacks Hunt.', (g, c, ch) => {
    const A = g.aim(c); c.faceNow(A.yaw);
    const up = Math.max(0, A.dir.y);
    c.setAnim('leap', 0.5); c.lock = 0.12;
    const vy = (14 + ch * 7 + up * 15) * (adult ? 1.12 : 1);
    const hor = (adult ? 27 : 16) * (0.75 + ch * 0.9) * (1 - up * 0.45);
    g.after(0.06, c, () => {
      c.vy = vy; c.onGround = false; c.coyote = 0; c.floatT = 0; c.invuln = Math.max(c.invuln, 0.15);
      c.forced = { vx: A.flat.x * hor, vz: A.flat.z * hor, t: 1.6, T: 1.6, ease: false, land: true };
      sfx('dash'); g.fx.shockwave(gnd(c.pos), col, 3, 0.3); g.trail(c, 3, adult ? DK : col, 0.8, 0.5); c.setAnim('flyKick', 0.6);
      c.onLand = { t: 3, fn: () => {
        const R = adult ? 8.5 : 5.5 + ch * 1.5;
        blast(g, c, gnd(c.pos), R, adult ? 18 : 11, adult ? DK : col, { kb: 3, stun: 0.6, heavy: true });
        g.shake(0.35); sfx('heavy'); c.forced = null; c.lock = 0; c.anim = null;
      } };
    });
    return adult ? 4 : 5;
  }, { charge: adult ? 0.7 : 0.9, chargeAnim: 'charge' });

  const rock = (adult: boolean) => (g: import('../Game').Game, c: Fighter, ch: number) => {
    const st = adult ? 3 : stage(ch);
    const enh = enhance(c), e = ex(c), cc = adult ? DK : col;
    prep(g, c, 'rock', 0.24, 0.8, cc);
    g.fx.gather(c.handPos(), cc, 2.2, 8);
    const near = g.enemies(c).filter((v) => Math.hypot(v.pos.x - c.pos.x, v.pos.z - c.pos.z) < 3.6).sort((a, b) => Math.hypot(a.pos.x - c.pos.x, a.pos.z - c.pos.z) - Math.hypot(b.pos.x - c.pos.x, b.pos.z - c.pos.z))[0];
    if (near) { g.stunFighter(near, 0.5, true); g.fx.chain(() => c.handPos(), () => near.chestPos(), WHITE, 0.25, 4); g.popup(near, 'GRABBED', '#bfffa0', 18); }
    g.after(0.26, c, () => {
      const A2 = g.aim(c); c.faceNow(A2.yaw);
      const f = c.forward();
      g.dashF(c, f, 2.2 + st * 1.2 + (adult ? 2 : 0), 0.1);
      g.trail(c, 1, cc, 0.25, 0.6 + st * 0.15);
      g.after(0.1, c, () => {
        const dmg = (adult ? 66 : [0, 30, 44, 62][st]) * e * (enh ? 1.2 : 1);
        const vs = cut(g, c, { range: adult ? 8.5 : 4.8 + st * 0.9 + (enh ? 0.8 : 0), half: 0.1, dmg, col: cc, kb: adult ? 22 : 7 + st * 4, stun: 0.5 + st * 0.12, heavy: true, onHit: (v) => { v.st.rockT = 5; } });
        for (const v of vs) if (!v.onGround) g.slamDown(v, c);
        const p = c.chestPos().addScaledVector(f, 2.8);
        g.fx.explosion(p, cc, 2 + st * 1.2, 0.4); g.fx.vring(p, f, WHITE, 0.6, 4 + st * 2, 0.35); g.shake(0.2 + 0.15 * st); g.kick(2 + st); sfx('boom');
        if (c.onGround && st >= 2) {
          const gp = gnd(c.pos).addScaledVector(f, 3.4), R = adult ? 11 : st === 2 ? 6 : 9.5;
          g.fx.crack(gp, cc, R * 0.9, 4);
          blast(g, c, gp, R, adult ? 20 : st === 2 ? 12 : 22, cc, { kb: 5, exclude: vs });
        }
      });
    });
  };

  const scissors = (adult: boolean) => (g: import('../Game').Game, c: Fighter) => {
    const enh = enhance(c), e = ex(c), cc = adult ? DK : col;
    prep(g, c, 'slashSide', 0.14, 0.5, cc);
    g.after(0.14, c, () => {
      const A2 = g.aim(c); c.faceNow(A2.yaw);
      const L = adult ? 22 : 9;
      const o = c.chestPos().addScaledVector(A2.flat, 0.8);
      g.fx.slashArc(o.clone().addScaledVector(A2.flat, L * 0.35), A2.flat, 0.35, L * 0.5, 1.1, cc, 0.3);
      g.fx.beam(o, o.clone().addScaledVector(A2.flat, L), cc, adult ? 1.5 : 1.0, 0.22);
      sfx('slash');
      const mult = (v: Fighter) => ((v.st.rockT ?? 0) > 0 ? 1.4 : 1);
      const onHit = (v: Fighter) => { if ((v.st.rockT ?? 0) > 0) { v.st.rockT = 0; g.popup(v, 'ROCK + SCISSORS!', '#ffe8a0', 20); g.fx.explosion(v.chestPos(), 0xfff0a0, 1.8, 0.3); } };
      if (adult) g.hitBeam(c, o, A2.flat, L, 4.2, 52 * e, { kb: 8, heavy: true, color: cc, skill: true, bleed: 5, bleedDps: 7, mult, onHit });
      else rush(g, c, A2.flat, L, 0.18, cc, 28 * e * (enh ? 1.2 : 1), { bleed: 3.5, bleedDps: 6, kb: 4, mult, onHit }, 4, 3.4);
    });
  };

  const paper = (adult: boolean) => (g: import('../Game').Game, c: Fighter, ch: number) => {
    const st = adult ? 3 : stage(ch), enh = enhance(c), e = ex(c), cc = adult ? DK : col;
    prep(g, c, 'castR', adult ? 0.3 : 0.18, 0.45, cc);
    g.fx.gather(c.handPos(), cc, adult ? 3 : 1.8, 8);
    g.after(adult ? 0.3 : 0.18, c, () => {
      const A2 = g.aim(c); c.faceNow(A2.yaw);
      const hunted = A2.target && marks(A2.target, 'hunt') >= 3;
      const R = adult ? 11 : st === 3 ? 6.5 : st === 2 ? 4 : 0;
      sfx('boom'); g.shake(0.15 + ch * 0.2);
      shot(g, c, {
        pos: c.handPos().addScaledVector(A2.flat, 0.6), dir: A2.dir, speed: adult ? 40 : 54 - ch * 14, r: adult ? 3.4 : 1.0 + ch * 1.4, dmg: (adult ? 36 : 15 + ch * 22) * e * (enh ? 1.2 : 1) * (hunted ? 1.3 : 1),
        life: 1.8, col: cc, size: adult ? 3.2 : 0.9 + ch * 1.4, shape: 'orb', pierce: R === 0, homing: hunted && A2.target ? { target: A2.target, rate: 3 } : undefined,
        opts: { stun: 0.2, kb: adult ? 12 : 4 + ch * 5, heavy: ch > 0.5 || adult },
        onEnd: (p, why) => {
          if (R > 0 && why !== 'life') { blast(g, c, p, R, adult ? 42 : 22, cc, { heavy: true, kb: adult ? 14 : 9, stun: 0.5 }); g.shake(adult ? 0.9 : 0.5); g.flash('#d8ffc8', 0.3); }
          else if (why === 'ground') blast(g, c, p, 4 + ch * 3, 8 + ch * 8, cc, { kb: 6 });
        },
      });
    });
  };

  return {
    notes: [
      'Nen type: Enhancement. Every landed blow builds a Hunt stack; the last strike is held and released as one heavier blow',
      'Hunt: every hit stacks Hunt on a target (max 5). At 5 stacks your next skill is a HUNT EXECUTION: +40% damage',
      'Nen meter is now 3× harder to fill. Enhanced Jajanken spends 20 Nen (needs 60+). Adult Gon needs a FULL meter + 55 energy',
      'Z/X/C: three Jajanken forms, Z has 3 charge stages · F: Nen Leap',
    ],
    gain: 1 / 3,
    skills: [
      skill('Z', 'Jajanken: Rock', 0, 8, [2, 11], 'Lunging heavy punch. HOLD to charge: stage 2 cracks the ground (6m), stage 3 craters it (9.5m) and spikes airborne foes down. Grabs close enemies first.', rock(false), { charge: 1.2, chargeAnim: 'chargeFist' }),
      skill('X', 'Jajanken: Scissors', 0, 9, [2, 13], 'Dash-slash 9m through everything in your path. Pierces, bleeds, and detonates a Rock mark for +40%.', scissors(false), { charge: 0.5, chargeAnim: 'chargeBlade' }),
      skill('C', 'Jajanken: Paper', 0, 12, [5, 30], 'Nen blast. HOLD for a bigger orb – stage 2/3 explode on impact. Homes in on enemies with 3+ Hunt stacks.', paper(false), { charge: 1.3, chargeAnim: 'chargePalm' }),
      skill('V', 'Adult Gon: Restriction & Covenant', 55, 90, [0, 30], 'Needs a FULL Nen meter and 55 energy. Sacrifice your future for 30s of adult form: more speed, reach and power. Leaves you exhausted afterwards.', (g, c) => old.skills[3].cast(g, c, 0), { can: (_g, c) => !c.form && c.meter >= 99.5 }),
      leap(false),
    ],
    form: [
      skill('Z', 'Adult Rock', 0, 6, [2, 11], 'An enormous punch: devastating knockback and a crater.', rock(true)),
      skill('X', 'Adult Scissors', 0, 8, [3, 20], 'A massive 22m Nen blade that cleaves the whole lane.', scissors(true)),
      skill('C', 'Adult Paper', 0, 10, [6, 34], 'A gigantic Nen blast with a huge explosion.', paper(true)),
      skill('V', 'Pitou Punishment', 0, 22, [0, 14], 'A devastating close-range kick, then a massive delayed explosion.', (g, c) => old.formSkills![3].cast(g, c, 0)),
      leap(true),
    ],
    onDealt: (g, att, vic, _a, o) => {
      if (o.dot || att === vic || (vic.st.huntI ?? 0) > 0) return;
      vic.st.huntI = 0.3;
      mark(vic, 'hunt', 1, 5, 7);
      if (marks(vic, 'hunt') >= 5 && (att.st.execT ?? 0) <= 0) { att.st.execT = 8; g.popup(att, 'HUNT EXECUTION READY', '#ffb04a', 20); g.fx.ring(gnd(att.pos), AMB, 1, 6, 0.5); clearMark(vic, 'hunt'); }
    },
    update: (g, c, dt) => {
      decayMarks(g, c, ['hunt'], dt);
      for (const e of g.enemies(c)) if ((e.st.huntI ?? 0) > 0) e.st.huntI -= dt;
      if ((c.st.execT ?? 0) > 0) { c.st.execT -= dt; c.st.auraT = Math.max(c.st.auraT ?? 0, 0.15); }
    },
  };
};

// ============================================================ KILLUA  –  Transmutation: lightning, godspeed steps, afterimages
export const killua = (old: CharDef): Kit => {
  const col = old.color;
  const shock = (g: import('../Game').Game, c: Fighter, v: Fighter) => { mark(v, 'shock', 1, 3, 5); g.fx.bolt(c.chestPos(), v.chestPos(), col, 0.15, 0.2, 1, 0.6); };
  const strike = (g: import('../Game').Game, c: Fighter, at: THREE.Vector3, r: number, dmg: number, stun: number) => {
    g.fx.bolt(V3(at.x + rnd(-2, 2), at.y + 36, at.z + rnd(-2, 2)), at.clone().setY(at.y + 0.5), col, 0.22, 0.6, 3, 2);
    g.fx.beamColumn(gnd(at), WHITE, r * 0.35, 30, 0.25);
    sfx('thunder');
    blast(g, c, at, r, dmg, col, { stun, heavy: stun > 0.5, mult: (v) => (marks(v, 'shock') > 0 ? 1.2 : 1), onHit: (v) => shock(g, c, v) }, true);
  };
  const echo = (g: import('../Game').Game, c: Fighter, n: number, gap: number, dmg: number, god: boolean) => {
    const A = g.aim(c), t = A.target ?? g.target(c, 40);
    prep(g, c, 'castFwd', 0.12, 0.4 + n * gap, col);
    if (!t) { g.popup(c, 'no target', '#aaa', 14); return; }
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd(-0.3, 0.3);
      const spot2 = V3(t.pos.x + Math.cos(a) * 3.4, 0, t.pos.z + Math.sin(a) * 3.4);
      g.after(0.15 + i * gap, c, () => {
        if (t.dead) return;
        g.fx.afterimage(spot2.clone().setY(gy(spot2.x, spot2.z)), Math.atan2(t.pos.x - spot2.x, t.pos.z - spot2.z), col, 0.4, 0.6);
        g.fx.bolt(spot2.clone().setY(gy(spot2.x, spot2.z) + 2), t.chestPos(), WHITE, 0.12, 0.25, 1, 0.8);
        g.damage(c, t, dmg, { color: col, skill: true, kb: 1.5, stun: i === n - 1 ? 0.45 : 0, heavy: i === n - 1, dirx: t.pos.x - spot2.x, dirz: t.pos.z - spot2.z, onHit: (v) => shock(g, c, v) });
        sfx('zap');
      });
    }
    g.after(0.3 + n * gap, c, () => { if (!t.dead) { blast(g, c, t.pos, god ? 6.5 : 5, god ? 20 : 16, col, { kb: 8, launch: 7, heavy: true }); g.shake(0.35); } });
  };
  const chain = (god: boolean) => (g: import('../Game').Game, c: Fighter) => {
    const A = g.aim(c); c.faceNow(A.yaw);
    c.setAnim('crouch', 0.2);
    rush(g, c, A.flat, god ? 16 : 13, god ? 0.12 : 0.15, col, 10, { stun: 0.2 }, 3, 2.6);
    c.st.solN = (c.st.solN ?? 0) + 1;
    if (c.st.solN === 1) { c.st.solT = 1.3; return 0.7; }
    c.st.solN = 0; return god ? 3 : 4;
  };
  return {
    notes: [
      'Nen type: Transmutation. Lightning aura paralyses on a full discharge, and afterimages step through the space between strikes',
      'Shock marks: lightning hits mark the target; Thunderbolt does +20% to shocked enemies',
      'F chains: first use reuses in 0.7s, then a normal cooldown',
      'Godspeed (V) now costs 40 energy and unlocks a barrage moveset',
    ],
    skills: [
      skill('Z', 'Thunderbolt', 0, 7, [4, 28], 'Call lightning on the cursor (0.45s warning). HOLD for a bigger, longer-stunning strike. Shocked foes take +20%.', (g, c, ch) => {
        prep(g, c, 'castUp', 0.2, 0.5, col);
        const at = spot(g, c, 30);
        delayed(g, c, at, 4.2 + ch * 1.5, 0.45, col, () => strike(g, c, at, 4.2 + ch * 1.5, 26 + ch * 16, 0.5 + ch * 0.35));
      }, { charge: 1.0, chargeAnim: 'chargeUp' }),
      skill('X', 'Lightning Palm', 0, 9, [3, 22], 'Blink 10m through the enemy with a paralysing palm: 0.5s stun, applies a Shock mark.', (g, c) => {
        const A = prep(g, c, 'palm', 0.12, 0.45, col);
        g.after(0.12, c, () => { const A2 = g.aim(c); c.faceNow(A2.yaw); rush(g, c, A2.flat, 10, 0.12, col, 32, { stun: 0.5, heavy: true, onHit: (v) => shock(g, c, v) }, 3, 3); void A; });
      }),
      skill('C', 'Rhythm Echo', 0, 13, [3, 26], 'Afterimages surround the target and strike in rhythm – HOLD for more echoes (3-5). The last echo launches.', (g, c, ch) => echo(g, c, 3 + Math.round(ch * 2), 0.16, 12, false), { charge: 1.2, chargeAnim: 'charge' }),
      skill('V', 'Godspeed', 40, 75, [0, 30], 'ULTIMATE (40 energy): channel lightning into your body for 25s – blinding speed, a Whirlwind auto-counter and a new barrage moveset.', (g, c) => old.skills[3].cast(g, c, 0), { can: (_g, c) => !c.form }),
      skill('F', 'Speed of Lightning', 0, 4, [9, 30], 'Lightning blink 13m, shocking whatever you cross. Use again within 1.3s for a chain dash.', chain(false)),
    ],
    form: [
      skill('Z', 'Thunderbolt Barrage', 0, 5, [4, 30], 'Five consecutive lightning strikes walk across the target area.', (g, c) => {
        prep(g, c, 'castUp', 0.15, 1.2, col);
        const at = spot(g, c, 30);
        for (let i = 0; i < 5; i++) g.after(0.2 + i * 0.16, c, () => { const p = V3(at.x + rnd(-4, 4), 0, at.z + rnd(-4, 4)); p.y = gy(p.x, p.z); g.fx.telegraph(p, 3, col, 0.1); strike(g, c, p, 3.4, 14, 0.2); });
      }),
      skill('X', 'Lightning Palm: Godspeed', 0, 6, [3, 26], 'Three Godspeed dashes through the target from different angles, each a palm strike.', (g, c) => {
        prep(g, c, 'palm', 0.1, 1.0, col);
        for (let i = 0; i < 3; i++) g.after(0.1 + i * 0.28, c, () => { const A2 = g.aim(c); const a = (i - 1) * 0.9; const d = rotY(A2.flat, a); c.faceNow(Math.atan2(d.x, d.z)); rush(g, c, d, 11, 0.1, col, i === 2 ? 26 : 16, { stun: i === 2 ? 0.5 : 0.15, onHit: (v) => shock(g, c, v) }, 2, 3); });
      }),
      skill('C', 'Rhythm Echo: Godspeed', 0, 9, [3, 28], 'Six afterimages assault from every direction at once.', (g, c) => echo(g, c, 6, 0.1, 9, true)),
      skill('V', 'Godspeed Overload', 0, 20, [0, 10], 'Spend Godspeed charge to unleash an all-out overload burst.', (g, c) => old.formSkills![3].cast(g, c, 0), { can: (_g, c) => c.meter >= 25 }),
      skill('F', 'Speed of Lightning', 0, 2.5, [9, 30], 'Chain dashes with almost no cooldown.', chain(true)),
    ],
    update: (g, c, dt) => { decayMarks(g, c, ['shock'], dt); if ((c.st.solT ?? 0) > 0) { c.st.solT -= dt; if (c.st.solT <= 0) c.st.solN = 0; } },
  };
};

// ============================================================ LEORIO  –  Emission: shockwave fists, the clinic, the lingering haze
export const leorio = (old: CharDef): Kit => {
  const col = old.color;
  const rx = (v: Fighter) => mark(v, 'rx', 1, 3, 6);
  return {
    notes: ['Nen type: Specialisation. A shockwave fist, a skill that switches between mending and harming, and a field that lingers', 'Prescribe: Remote Punch and Briefcase mark enemies – marked foes take +30% from Rapid Fists', 'Doctor\'s Orders is a healing clinic for allies and a toxic field for enemies'],
    skills: [
      skill('Z', 'Remote Punch', 0, 7, [4, 32], 'Launch a giant remote fist (HOLD for speed and power). Heavy knockback, marks the target.', (g, c, ch) => {
        prep(g, c, 'chargePalm', 0.14, 0.4, col);
        g.after(0.14, c, () => { const A = g.aim(c); c.faceNow(A.yaw); sfx('boom'); shot(g, c, { pos: c.chestPos().addScaledVector(A.flat, 1.2), dir: A.dir, speed: 34 + ch * 22, r: 1.9, dmg: 22 + ch * 22, life: 1.2, col, size: 2.2 + ch * 0.8, shape: 'fist', opts: { kb: 10 + ch * 6, stun: 0.3, heavy: true, onHit: rx }, onEnd: (p, why) => { if (why !== 'life') g.fx.explosion(p, col, 2.2, 0.3); } }); });
      }, { charge: 1.2, chargeAnim: 'chargePalm' }),
      skill('X', 'Briefcase Boomerang', 0, 9, [3, 24], 'Hurl the briefcase: it hits on the way out AND on the way back, dragging enemies toward you.', (g, c) => {
        prep(g, c, 'throw', 0.12, 0.4, col);
        g.after(0.12, c, () => { const A = g.aim(c); c.faceNow(A.yaw); shot(g, c, { pos: c.handPos(), dir: A.dir, speed: 38, r: 1.6, dmg: 18, life: 1.5, col, size: 1.3, shape: 'case', pierce: true, boomerang: true, noGround: true, opts: { kb: 2, onHit: rx } }); sfx('swing'); });
        g.after(1.0, c, () => pullTo(g, c, c.pos, 12, 5));
      }),
      skill('C', 'Rapid Remote Fists', 0, 12, [3, 24], 'Plant your feet and unload nine remote fists in a cone. Marked enemies take +30%.', (g, c) => {
        prep(g, c, 'chargePalm', 0.1, 1.3, col);
        c.root_ = Math.max(c.root_, 1.0);
        for (let i = 0; i < 9; i++) g.after(0.15 + i * 0.1, c, () => { const A = g.aim(c); c.faceNow(A.yaw); const d = rotY(A.dir, rnd(-0.2, 0.2)); shot(g, c, { pos: c.chestPos().addScaledVector(A.flat, 1.1).add(V3(rnd(-0.6, 0.6), rnd(-0.3, 0.5), 0)), dir: d, speed: 56, r: 1.2, dmg: 8, life: 0.5, col, size: 1.2, shape: 'fist', opts: { kb: 1.2, mult: (v) => (marks(v, 'rx') > 0 ? 1.3 : 1) } }); sfx('swing'); });
      }),
      skill('V', "Doctor's Orders", 55, 60, [0, 28], 'ULTIMATE (55 energy): open a 7s clinic field (10m). Allies heal 6%/s; enemies take toxic damage and slow. You gain a 70 shield.', (g, c) => {
        prep(g, c, 'castUp', 0.3, 0.7, col);
        g.after(0.3, c, () => { g.addShield(c, 70); g.fx.pillar(gnd(c.pos), col, 3, 26, 0.9); g.fx.dome(c.chestPos(), 10, col, 7, 0.15); g.flash('#ffe8a0', 0.25); field(g, c, gnd(c.pos), 10, 7, col, { dps: 9, heal: 0.06, slow: [0.7, 0.7], every: 0.5 }); sfx('level'); });
      }),
      skill('F', 'Remote Boost', 0, 5, [6, 22], 'Rocket yourself forward 14m on a remote fist: shoves enemies aside and staggers the one you hit.', (g, c) => {
        const A = prep(g, c, 'flykick', 0.1, 0.35, col);
        g.after(0.1, c, () => { rush(g, c, A.flat, 14, 0.2, col, 16, { kb: 5, stun: 0.3, onHit: rx }, 4, 3); });
      }),
    ],
    update: (g, c, dt) => decayMarks(g, c, ['rx'], dt),
  };
};

// ============================================================ KURAPIKA  –  Control (Domain + chains) rework
export const kurapika = (old: CharDef): Kit => {
  const col = old.color;
  const em = (c: Fighter) => (c.form === 'emperor' ? 1.3 : 1);
  return {
    notes: ['Nen type: Manipulation. Absolute control over chains, sealed into a conjured territory', 'Chain Jail is a Domain: a telegraphed cage that roots and lingers', 'Emperor Time (V) boosts every chain: +30% damage'],
    skills: [
      skill('Z', 'Holy Chain: Lash', 0, 8, [4, 26], 'Whip a chain 26m: damages, slows, and drags the target 8m toward you.', (g, c) => {
        prep(g, c, 'throw', 0.12, 0.38, col);
        g.after(0.12, c, () => { const A = g.aim(c); c.faceNow(A.yaw); sfx('chain'); shot(g, c, { pos: c.handPos(), dir: A.dir, speed: 70, r: 1.3, dmg: 20 * em(c), life: 0.4, col, size: 1.0, shape: 'hook', opts: { slow: 2, slowMul: 0.6 }, onHit: (v) => { g.fx.chain(() => c.handPos(), () => v.chestPos(), col, 0.35, 12); const dx = c.pos.x - v.pos.x, dz = c.pos.z - v.pos.z, d = Math.hypot(dx, dz); if (d > 3) g.knock(v, dx / d, dz / d, Math.min(8, d - 2.4), 0.2); mark(v, 'chain', 1, 3, 7); } }); });
      }),
      skill('X', 'Chain Jail', 0, 13, [4, 26], 'DOMAIN: mark the ground; after 0.6s chains erupt, rooting everything inside (1.4s) and lingering for 3s with a slowing field.', (g, c) => {
        prep(g, c, 'castFwd', 0.18, 0.5, col);
        const at = spot(g, c, 26), r = 7 * (em(c) > 1 ? 1.2 : 1);
        delayed(g, c, at, r, 0.6, col, () => {
          g.fx.pillar(gnd(at), col, r * 0.5, 14, 0.5); g.fx.crack(gnd(at), col, r * 0.9, 3); sfx('chain'); g.shake(0.3);
          blast(g, c, at, r, 26 * em(c), col, { root: 1.4, stun: 0.3, heavy: true });
          field(g, c, at, r, 3, col, { dps: 7, slow: [0.5, 0.6], every: 0.5 });
        });
      }),
      skill('C', 'Judgment Chain', 0, 16, [3, 24], 'Pierce the heart with a chain. For 7s, if the enemy uses ANY skill or dashes, they take 30 punishment damage.', (g, c) => {
        prep(g, c, 'point', 0.2, 0.45, col);
        g.after(0.2, c, () => { const A = g.aim(c); c.faceNow(A.yaw); sfx('chain'); shot(g, c, { pos: c.chestPos(), dir: A.dir, speed: 64, r: 1.2, dmg: 22 * em(c), life: 0.45, col: 0xff4040, size: 1.0, shape: 'hook', onHit: (v) => { v.st.judgeT = 7; g.popup(v, 'JUDGMENT', '#ff4040', 22); g.fx.chain(() => c.handPos(), () => v.chestPos(), 0xff4040, 0.8, 12); } }); });
      }),
      skill('V', 'Emperor Time', 50, 75, [0, 30], 'ULTIMATE (50 energy): activate all five Nen types for 18s – chains hit harder, wider, and everything is faster.', (g, c) => old.skills[3].cast(g, c, 0), { can: (_g, c) => !c.form }),
      skill('F', 'Grapple Chain', 0, 6, [8, 28], 'Fire a chain and reel yourself to the cursor (up to 18m), slicing whatever you pass. Targeting an enemy ends in a kick.', (g, c) => {
        const A = prep(g, c, 'throw', 0.1, 0.4, col);
        g.after(0.1, c, () => { const A2 = g.aim(c); const L = clamp(A2.dist, 5, 18); sfx('chain'); g.fx.chain(() => c.handPos(), () => c.pos.clone().addScaledVector(A2.flat, L).setY(c.pos.y + 1.6), col, 0.25, 10); rush(g, c, A2.flat, L, 0.2, col, 16, { kb: 4 }, 3, 2.8); void A; });
        g.after(0.36, c, () => { c.setAnim('kickR', 0.3); cut(g, c, { range: 4.5, dmg: 14, col, kb: 7, stun: 0.3 }); });
      }),
    ],
    update: (g, c, dt) => decayMarks(g, c, ['chain'], dt),
  };
};

// ============================================================ HISOKA  –  Transmutation: Bungee Gum, Texture Surprise, decoys
export const hisoka = (old: CharDef): Kit => {
  const col = old.color;
  return {
    notes: ['Nen type: Transmutation. Aura that is both rubber and gum – sticky, elastic, and it never lets go', 'Bungee Gum tethers an enemy: they are yanked back if they run beyond 16m', 'Texture Surprise leaves a decoy that detonates in a card burst'],
    skills: [
      skill('Z', 'Trump Cards', 0, 6, [4, 30], 'Fling a fan of razor cards. HOLD for more (3-7). Tethered enemies take +30%.', (g, c, ch) => {
        prep(g, c, 'fling', 0.12, 0.38, col);
        const n = 3 + Math.round(ch * 4);
        g.after(0.12, c, () => { sfx('swing'); fan(g, c, n, 0.1 + n * 0.07, { speed: 62, r: 0.8, dmg: 9, life: 0.9, col, size: 0.9, shape: 'card', opts: { kb: 0.8, mult: (v) => (marks(v, 'gum') > 0 ? 1.3 : 1) } }); });
      }, { charge: 1.0, chargeAnim: 'charge' }),
      skill('X', 'Bungee Gum', 0, 10, [4, 28], 'Stick gum to an enemy and tether them for 4s. Far away: you rocket to them with a launcher. Close: you yank them in. Slows 35%.', (g, c) => {
        prep(g, c, 'throw', 0.14, 0.5, col);
        g.after(0.14, c, () => { const A = g.aim(c); c.faceNow(A.yaw); sfx('chain'); shot(g, c, { pos: c.handPos(), dir: A.dir, speed: 64, r: 1.3, dmg: 14, life: 0.5, col, size: 1.0, shape: 'hook', opts: { slow: 2.5, slowMul: 0.65 }, onHit: (v) => {
          mark(v, 'gum', 1, 1, 4); g.fx.chain(() => c.handPos(), () => v.chestPos(), col, 4, 12);
          const dx = v.pos.x - c.pos.x, dz = v.pos.z - c.pos.z, d = Math.hypot(dx, dz) || 1;
          if (d > 8) { c.faceNow(Math.atan2(dx, dz)); g.dashF(c, V3(dx / d, 0, dz / d), d - 2.3, 0.16); g.after(0.18, c, () => { c.setAnim('upperR', 0.3); cut(g, c, { range: 4.5, dmg: 18, col, launch: 8, kb: 2 }); }); }
          else { g.knock(v, -dx / d, -dz / d, Math.max(0, d - 2.2), 0.18); g.after(0.2, c, () => { c.faceNow(Math.atan2(dx, dz)); c.setAnim('upperR', 0.3); cut(g, c, { range: 4.5, dmg: 18, col, launch: 8, kb: 2 }); }); }
        } }); });
      }),
      skill('C', 'Texture Surprise', 0, 13, [0, 30], 'Leave a false image of yourself and slip away 6m. After 1.4s it detonates in a card burst (6m) – lure them in!', (g, c) => {
        const A = prep(g, c, 'crouch', 0.1, 0.3, col);
        const p = c.pos.clone();
        const decoy = new THREE.Vector3(p.x, p.y, p.z);
        g.fx.afterimage(decoy, c.yaw, col, 1.6, 0.8);
        g.after(0.1, c, () => rush(g, c, rotY(A.flat, Math.PI * 0.8 * (Math.random() < 0.5 ? 1 : -1)), 6, 0.12, col, 0, {}, 1, 1, true));
        g.later(1.4, () => {
          g.fx.explosion(decoy.clone().setY(decoy.y + 1.5), col, 4, 0.5); g.fx.shockwave(gnd(decoy), col, 6, 0.5); sfx('boom');
          blast(g, c, decoy, 6, 30, col, { kb: 8, stun: 0.4, heavy: true }, false);
          for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; shot(g, c, { pos: decoy.clone().setY(decoy.y + 1.4), dir: V3(Math.cos(a), 0, Math.sin(a)), speed: 40, r: 0.8, dmg: 6, life: 0.4, col, size: 0.9, shape: 'card' }); }
        });
      }),
      skill('V', "Magician's Finale", 55, 65, [0, 24], 'ULTIMATE (55 energy): gum-snare every enemy within 24m (yanked to you, rooted), rip into them with a 6-hit flurry and finish with a Joker explosion.', (g, c) => {
        prep(g, c, 'summon', 0.3, 2.4, col);
        g.flash('#ff7ab8', 0.3);
        g.after(0.3, c, () => { sfx('chain'); for (const v of g.enemies(c)) if (Math.hypot(v.pos.x - c.pos.x, v.pos.z - c.pos.z) < 24) { g.fx.chain(() => c.handPos(), () => v.chestPos(), col, 1.2, 12); } pullTo(g, c, c.pos, 24, 18, 0.25); for (const v of g.enemies(c)) if (Math.hypot(v.pos.x - c.pos.x, v.pos.z - c.pos.z) < 8) { v.root_ = Math.max(v.root_, 1.4); } });
        for (let i = 0; i < 6; i++) g.after(0.65 + i * 0.14, c, () => { const t = g.target(c, 9); if (t) { c.faceNow(Math.atan2(t.pos.x - c.pos.x, t.pos.z - c.pos.z)); c.setAnim(i % 2 ? 'hookL' : 'jabR', 0.12); } cut(g, c, { range: 5, half: -0.2, dmg: 11, col, kb: 0.6 }); });
        g.after(1.65, c, () => { c.setAnim('slamR', 0.4); const at = gnd(c.pos).addScaledVector(c.forward(), 3); g.fx.pillar(at, col, 3, 30, 0.5); g.flash('#ffffff', 0.4); sfx('boom'); g.shake(0.8); blast(g, c, at, 8, 52, col, { kb: 14, launch: 10, heavy: true, stun: 0.6 }); });
      }),
      skill('F', 'Elastic Leap', 0, 5, [6, 30], 'Spring off bungee gum: a huge leap toward the cursor with a landing shockwave (6m).', (g, c) => {
        const A = g.aim(c); c.faceNow(A.yaw); c.setAnim('leap', 0.5); c.lock = 0.1;
        g.after(0.06, c, () => { c.vy = 20 + Math.max(0, A.dir.y) * 12; c.onGround = false; c.invuln = Math.max(c.invuln, 0.2); c.forced = { vx: A.flat.x * 22, vz: A.flat.z * 22, t: 1.5, T: 1.5, ease: false, land: true }; g.fx.shockwave(gnd(c.pos), col, 3, 0.3); sfx('dash'); c.onLand = { t: 3, fn: () => { blast(g, c, gnd(c.pos), 6, 12, col, { kb: 5, stun: 0.5, heavy: true }); g.shake(0.3); c.forced = null; c.lock = 0; } }; });
      }),
    ],
    update: (g, c, dt) => {
      decayMarks(g, c, ['gum'], dt);
      for (const v of g.enemies(c)) if (marks(v, 'gum') > 0) { const d = Math.hypot(v.pos.x - c.pos.x, v.pos.z - c.pos.z); if (d > 16 && !v.forced) { g.knock(v, (c.pos.x - v.pos.x) / d, (c.pos.z - v.pos.z) / d, 6, 0.2); g.fx.chain(() => c.handPos(), () => v.chestPos(), col, 0.3, 10); } }
    },
  };
};

// ============================================================ MOREL  –  Transmutation: smoke that stays and thickens
export const morel = (old: CharDef): Kit => {
  const col = old.color;
  const smokeMark = (g: import('../Game').Game, c: Fighter) => (v: Fighter) => {
    mark(v, 'smoke', 1, 5, 6);
    if (marks(v, 'smoke') >= 5) { clearMark(v, 'smoke'); g.damage(c, v, 18, { color: col, skill: true, noCrit: true, heavy: true }); g.popup(v, 'TOXIC BURST', '#d6b0ff', 20); g.fx.explosion(v.chestPos(), col, 2.2, 0.3); }
  };
  return {
    notes: ['Nen type: Transmutation. Smoke that stays where it was left and thickens instead of dispersing', 'Standing in smoke stacks Deep Smoke; at 5 stacks it bursts for bonus damage', 'Pipe Slam and Smoke Step leave clouds as area denial'],
    skills: [
      skill('Z', 'Smoke Burst', 0, 8, [4, 26], 'Lob a smoke bomb (HOLD for a bigger cloud). It blooms into a lingering cloud that slows and stacks Deep Smoke.', (g, c, ch) => {
        prep(g, c, 'castFwd', 0.14, 0.38, col);
        g.after(0.14, c, () => { const A = g.aim(c); c.faceNow(A.yaw); sfx('smoke'); shot(g, c, { pos: c.handPos(), dir: A.dir.clone().add(V3(0, 0.25, 0)), speed: 34, r: 1.1, dmg: 14, life: 1.2, col, size: 1.4, shape: 'smoke', grav: 22, onEnd: (p) => { const R = 5.5 + ch * 2.5; blast(g, c, p, R * 0.7, 10, col, { kb: 3 }); field(g, c, gnd(p), R, 5, col, { dps: 7, slow: [0.6, 0.75], every: 0.5, onTick: smokeMark(g, c) }); g.fx.smoke(p, 14, R * 0.7); } }); });
      }, { charge: 1.0, chargeAnim: 'chargeCast' }),
      skill('X', 'Smoke Jail', 0, 12, [4, 24], 'Loose a slow homing smoke wisp. On contact it encases the enemy: 1.2s stun, 2s root.', (g, c) => {
        prep(g, c, 'castFwd', 0.14, 0.4, col);
        g.after(0.14, c, () => { const A = g.aim(c); c.faceNow(A.yaw); sfx('smoke'); shot(g, c, { pos: c.handPos(), dir: A.dir, speed: 24, r: 1.5, dmg: 16, life: 2.2, col, size: 1.6, shape: 'wisp', homing: A.target ? { target: A.target, rate: 2.4 } : undefined, onHit: (v) => { g.stunFighter(v, 1.2); v.root_ = Math.max(v.root_, 2); g.fx.smoke(v.chestPos(), 12, 2); g.popup(v, 'SMOKE JAIL', '#d6b0ff', 18); smokeMark(g, c)(v); } }); });
      }),
      skill('C', 'Pipe Slam', 0, 11, [0, 14], 'Leap to the cursor and bring your pipe down: 6.5m shockwave that leaves a smoke cloud.', (g, c) => {
        const A = g.aim(c); c.faceNow(A.yaw); c.setAnim('leap', 0.5); c.lock = 0.1;
        const L = clamp(A.dist, 4, 16);
        g.after(0.06, c, () => { c.vy = 17; c.onGround = false; c.invuln = Math.max(c.invuln, 0.2); c.forced = { vx: A.flat.x * L * 1.15, vz: A.flat.z * L * 1.15, t: 1.4, T: 1.4, ease: false, land: true }; sfx('dash'); c.onLand = { t: 3, fn: () => { c.setAnim('slamR', 0.3); const p = gnd(c.pos); blast(g, c, p, 6.5, 36, col, { kb: 8, stun: 0.7, heavy: true }); g.fx.crack(p, col, 5, 3); g.shake(0.5); field(g, c, p, 5, 4, col, { dps: 6, slow: [0.6, 0.8], every: 0.5, onTick: smokeMark(g, c) }); c.forced = null; c.lock = 0; } }; });
      }),
      skill('V', 'Deep Purple', 55, 70, [0, 18], 'ULTIMATE (55 energy): your pipe pours out Deep Purple – 9s of super smoke form: faster, tougher, wider hits.', (g, c) => old.skills[3].cast(g, c, 0), { can: (_g, c) => !c.form }),
      skill('F', 'Smoke Step', 0, 6, [5, 28], 'Dissolve into smoke and dash 12m through enemies (brief invulnerability), leaving a cloud at both ends.', (g, c) => {
        const A = prep(g, c, 'crouch', 0.08, 0.3, col);
        const start = gnd(c.pos);
        g.after(0.08, c, () => { sfx('smoke'); field(g, c, start, 4, 3, col, { dps: 5, slow: [0.6, 0.8], every: 0.5, onTick: smokeMark(g, c) }); g.fx.smoke(c.chestPos(), 12, 2); rush(g, c, A.flat, 12, 0.16, col, 14, { slow: 1.5, slowMul: 0.7, onHit: smokeMark(g, c) }, 3, 3); });
        g.after(0.3, c, () => field(g, c, gnd(c.pos), 4, 3, col, { dps: 5, slow: [0.6, 0.8], every: 0.5, onTick: smokeMark(g, c) }));
      }),
    ],
    update: (g, c, dt) => decayMarks(g, c, ['smoke'], dt),
  };
};

// keep helper exports referenced
export const _unused = { behind, tele, seq, stance };
