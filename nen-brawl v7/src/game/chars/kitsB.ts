/** Reworked kits – part B: Chrollo, Netero, Kite, Knov, Knuckle, Pitou */
import * as THREE from 'three';
import type { CharDef } from '../defs';
import type { Fighter } from '../Fighter';
import type { Game } from '../Game';
import { sfx } from '../audio';
import { type Kit, skill, prep, cut, blast, rush, shot, field, delayed, tele, mark, marks, decayMarks, spot, gnd, rotY, rnd, clamp, V3, stage, empower, empMult, behind, WHITE } from './mv';
import { gy } from '../terrain';

// ============================================================ CHROLLO  –  Specialisation: stolen techniques, phantoms, the sealed book
export const chrollo = (old: CharDef): Kit => {
  const col = old.color;
  const phantom = (g: Game, c: Fighter, from: THREE.Vector3, to: Fighter | THREE.Vector3, dmg: number, o: object = {}) => {
    const tp = to instanceof THREE.Vector3 ? to : to.chestPos();
    g.fx.afterimage(from, Math.atan2(tp.x - from.x, tp.z - from.z), col, 0.5, 0.7);
    g.fx.bolt(from.clone().setY(from.y + 2), tp.clone(), col, 0.18, 0.25, 1, 0.6);
    g.fx.slashX(tp.clone(), V3(tp.x - from.x, 0, tp.z - from.z).normalize(), col, 4, 0.25);
    g.hitSphere(tp, 3.2, c, dmg, { color: col, skill: true, kb: 3, ...o });
    sfx('slash');
  };
  return {
    notes: ['Nen type: Specialisation. A stolen ability, a bandaged book, and a conjured copy of whatever it has seen', 'Skill Hunter still steals the enemy\'s last skill (85% power) – the Counter/Adaptive archetype', 'Lucilfer\'s Book seals a huge ring, then seven phantoms converge'],
    skills: [
      skill('Z', 'Pistol Finger', 0, 5, [5, 36], 'Fire a fast Nen bullet. HOLD for a heavy, piercing shot.', (g, c, ch) => {
        prep(g, c, 'point', 0.1, 0.28, col);
        g.after(0.1, c, () => { const A = g.aim(c); c.faceNow(A.yaw); sfx('zap'); shot(g, c, { pos: c.handPos(), dir: A.dir, speed: 95, r: 0.8, dmg: 14 + ch * 24, life: 0.7, col, size: 0.8 + ch * 0.7, shape: 'bullet', pierce: ch > 0.9, opts: { kb: 2 + ch * 6, stun: ch > 0.9 ? 0.4 : 0, heavy: ch > 0.7 } }); g.shake(0.1 + ch * 0.2); });
      }, { charge: 1.0, chargeAnim: 'chargePalm' }),
      skill('X', 'Gallery Fake', 0, 11, [3, 26], 'Two phantoms rush in from opposite sides and slash across the target area; the second slash launches.', (g, c) => {
        prep(g, c, 'castFwd', 0.15, 0.7, col);
        const at = spot(g, c, 26);
        g.fx.telegraph(gnd(at), 5.5, col, 0.55);
        g.after(0.5, c, () => phantom(g, c, V3(at.x - 9, gy(at.x - 9, at.z), at.z), at.clone().setY(at.y + 1.4), 18, { stun: 0.2 }));
        g.after(0.7, c, () => { phantom(g, c, V3(at.x + 9, gy(at.x + 9, at.z), at.z), at.clone().setY(at.y + 1.4), 20, { launch: 9, heavy: true }); g.shake(0.3); });
      }),
      skill('C', 'Skill Hunter', 0, 12, [2, 30], "Steal and cast the enemy's most recent skill (85% power). With nothing to steal, you throw conjured pages.", (g, c, ch) => old.skills[2].cast(g, c, ch)),
      skill('V', "Lucilfer's Book", 55, 70, [0, 26], 'ULTIMATE (55 energy): seal everyone near the target in a Nen circle (heavy slow), then seven phantoms slash from all sides and converge in a huge blast.', (g, c) => {
        prep(g, c, 'summon', 0.3, 3.2, col);
        const at = spot(g, c, 22);
        g.flash('#b48cff', 0.25); g.fx.pillar(gnd(at), col, 3, 26, 0.9);
        field(g, c, at, 12, 4, col, { dps: 3, slow: [0.5, 0.35], every: 0.4 });
        for (let i = 0; i < 7; i++) g.after(0.7 + i * 0.28, c, () => { const a = (i / 7) * 6.28; phantom(g, c, V3(at.x + Math.cos(a) * 11, gy(at.x, at.z), at.z + Math.sin(a) * 11), at.clone().setY(at.y + 1.4), 14, { kb: 1.5 }); });
        g.after(2.9, c, () => { g.fx.pillar(gnd(at), WHITE, 4, 40, 0.5); g.flash('#ffffff', 0.45); sfx('boom'); g.shake(0.9); blast(g, c, at, 10, 58, col, { kb: 14, launch: 9, heavy: true, stun: 0.7 }); });
      }),
      skill('F', 'Dark Blink', 0, 6, [8, 30], 'Teleport up to 18m (aim at an enemy to land behind them with an ambush slash and bleed).', (g, c) => {
        const A = g.aim(c); c.faceNow(A.yaw); c.setAnim('crouch', 0.15);
        const t = A.target && A.dist < 22 ? A.target : null;
        const to = t ? behind(t, 2.1) : spot(g, c, 18);
        sfx('dash'); g.fx.burst(c.chestPos(), col, 14, 7, 0.3);
        tele(g, c, to);
        if (t) { c.faceNow(Math.atan2(t.pos.x - c.pos.x, t.pos.z - c.pos.z)); g.after(0.08, c, () => { c.setAnim('slashR', 0.3); cut(g, c, { range: 5, half: -0.2, dmg: 22, col, bleed: 3, kb: 4, heavy: true }); }); }
        g.fx.burst(c.chestPos(), col, 14, 7, 0.3);
      }),
    ],
  };
};

// ============================================================ NETERO  –  Emission: the hundred-type prayer, colossal palms
export const netero = (old: CharDef): Kit => {
  const col = old.color;
  const beamGold = (g: Game, c: Fighter, len: number, w: number, dmg: number, o: object = {}) => {
    const A = g.aim(c); c.faceNow(A.yaw);
    const origin = c.chestPos().addScaledVector(A.flat, 0.9);
    g.fx.beam(origin, origin.clone().addScaledVector(A.dir, len), col, w * 0.6, 0.22);
    g.fx.vring(origin.clone().addScaledVector(A.dir, 2), A.dir, WHITE, 0.4, w * 2.5, 0.25);
    sfx('boom');
    return g.hitBeam(c, origin, A.dir, len, w, dmg, { color: col, skill: true, heavy: true, ...o });
  };
  return {
    notes: ['Nen type: Emission. Prayer made into a thousand-armed body of aura', 'Zero Hand has no wind-up and reaches farther the longer you focus', 'Guanyin (V) now unlocks a fully reworked Bodhisattva moveset'],
    skills: [
      skill('Z', 'Zero Hand', 0, 8, [3, 24], 'A strike with no wind-up that reaches farther than it should. HOLD to focus for longer reach and heavier damage.', (g, c, ch) => { prep(g, c, 'palm', 0.04, 0.3, col); g.after(0.05, c, () => { beamGold(g, c, 11 + ch * 12, 1.7, 28 + ch * 22, { kb: 9 + ch * 6, stun: 0.4 }); }); }, { charge: 0.8, chargeAnim: 'chargePalm' }),
      skill('X', '10,000 Prayers', 0, 10, [2, 14], 'Close the gap and unleash twelve blinding palm strikes. The last one launches.', (g, c) => {
        prep(g, c, 'palm', 0.08, 1.4, col);
        g.after(0.08, c, () => { const A = g.aim(c); const t = A.target; const L = t ? clamp(Math.hypot(t.pos.x - c.pos.x, t.pos.z - c.pos.z) - 2.4, 0, 9) : 4; g.dashF(c, A.flat, L, 0.1); });
        for (let i = 0; i < 12; i++) g.after(0.2 + i * 0.07, c, () => { const t = g.target(c, 8); if (t) c.faceNow(Math.atan2(t.pos.x - c.pos.x, t.pos.z - c.pos.z)); c.setAnim(i % 2 ? 'palm' : 'jabR', 0.1); const last = i === 11; cut(g, c, { range: 5.2, half: -0.1, dmg: last ? 18 : 6, col, kb: last ? 12 : 0.5, launch: last ? 10 : 0, heavy: last }); });
      }),
      skill('C', "Bodhisattva's Palm", 0, 13, [4, 30], 'Mark the ground: after 0.8s a colossal golden hand crashes down (8m), stunning everyone caught and leaving a slowing field.', (g, c) => {
        prep(g, c, 'castUp', 0.2, 0.55, col);
        const at = spot(g, c, 30);
        delayed(g, c, at, 8, 0.8, col, () => { g.fx.pillar(gnd(at), col, 5, 40, 0.5); g.fx.crack(gnd(at), col, 8, 3); g.flash('#fff0b0', 0.3); g.shake(0.8); sfx('boom'); blast(g, c, at, 8, 50, col, { kb: 10, stun: 1.2, heavy: true }); field(g, c, at, 7, 3, col, { slow: [0.5, 0.6], every: 0.5 }); });
      }),
      skill('V', '100-Type Guanyin Bodhisattva', 55, 70, [0, 24], 'ULTIMATE (55 energy): the Bodhisattva rises behind you for 10s – faster, armoured, and a whole new moveset.', (g, c) => old.skills[3].cast(g, c, 0), { can: (_g, c) => !c.form }),
      skill('F', 'Zen Step', 0, 5, [6, 26], 'Vanish and reappear up to 14m away. Your next skill within 3s hits 15% harder.', (g, c) => {
        const A = g.aim(c); c.faceNow(A.yaw); sfx('dash'); g.fx.burst(c.chestPos(), col, 16, 7, 0.3);
        tele(g, c, spot(g, c, 14)); g.fx.burst(c.chestPos(), col, 16, 7, 0.3); c.invuln = Math.max(c.invuln, 0.2);
        empower(g, c, 3, 1.15, 'ZEN', col);
      }),
    ],
    form: [
      skill('Z', 'Guanyin Palm Barrage', 0, 6, [3, 24], 'The Bodhisattva fires five golden palm blasts down a 20m lane.', (g, c) => { prep(g, c, 'palm', 0.1, 0.9, col); for (let i = 0; i < 5; i++) g.after(0.12 + i * 0.12, c, () => { beamGold(g, c, 20, 1.6, 14, { kb: 3 }); }); }),
      skill('X', 'Prayer Beads', 0, 9, [0, 9], 'A ring of prayer beads whirls around you, shredding everything within 8m three times.', (g, c) => { prep(g, c, 'pray', 0.1, 1.0, col); for (let i = 0; i < 3; i++) g.after(0.15 + i * 0.28, c, () => { g.fx.ring(gnd(c.pos), col, 1, 8, 0.4); g.fx.orbit(() => c.chestPos(), 8, 4, col, 0.4, 0.5, 2, 12); blast(g, c, gnd(c.pos), 8, 16, col, { kb: 5, heavy: i === 2 }, i === 2); }); }),
      skill('C', 'Heaven Crush', 0, 10, [4, 32], 'A huge hand falls from the sky (11m).', (g, c) => { prep(g, c, 'castUp', 0.2, 0.6, col); const at = spot(g, c, 32); delayed(g, c, at, 11, 0.7, col, () => { g.fx.pillar(gnd(at), col, 7, 50, 0.6); g.flash('#fff0b0', 0.35); g.shake(1); sfx('boom'); blast(g, c, at, 11, 66, col, { kb: 14, stun: 1.0, heavy: true }); }); }),
      skill('V', 'Zero Hand: Final Prayer', 0, 25, [0, 36], 'Gather the Bodhisattva\'s fist and release one enormous Zero Hand across 36m.', (g, c) => { prep(g, c, 'chargePalm', 0.9, 1.5, col); g.fx.gather(c.chestPos(), col, 4, 12); g.after(0.9, c, () => { g.flash('#ffffff', 0.4); beamGold(g, c, 36, 4.4, 130, { kb: 20, stun: 1.0 }); g.shake(1); }); }),
      skill('F', 'Guanyin Flight', 0, 3, [6, 30], 'Glide 20m on the Bodhisattva\'s palm.', (g, c) => { const A = prep(g, c, 'flykick', 0.06, 0.3, col); g.after(0.06, c, () => rush(g, c, A.flat, 20, 0.2, col, 14, { kb: 4 }, 4, 3)); }),
    ],
  };
};

// ============================================================ KITE  –  Conjuration: Crazy Slots, one weapon at a time
export const kite = (old: CharDef): Kit => {
  const col = old.color;
  const gun = (g: Game, c: Fighter, dmg: number, hold = 0) => { const A = g.aim(c); c.faceNow(A.yaw); sfx('zap'); shot(g, c, { pos: c.handPos(), dir: rotY(A.dir, rnd(-0.015, 0.015)), speed: 120, r: 0.7 + hold, dmg, life: 0.6, col, size: 0.7 + hold, shape: 'bullet', pierce: hold > 0.4, opts: { kb: 1 + hold * 6, stun: hold > 0.4 ? 0.4 : 0, heavy: hold > 0.4 } }); };
  const weapon = (g: Game, c: Fighter, w: number) => {
    const A = g.aim(c);
    const sc = c.form === 'scythe' ? 1.2 : 1;
    if (w === 0) { c.setAnim('slashSide', 0.35); cut(g, c, { range: 8 * sc, half: -0.3, dmg: 34, col, bleed: 3, kb: 6, heavy: true }); g.popup(c, '② SCYTHE', '#ffd0f0', 16); }
    else if (w === 1) { c.setAnim('overhead', 0.35); const p = gnd(c.pos).addScaledVector(c.forward(), 3.5); g.after(0.15, c, () => { blast(g, c, p, 6 * sc, 38, col, { kb: 8, stun: 0.8, heavy: true }); g.fx.crack(p, col, 5, 3); g.shake(0.4); }); g.popup(c, '③ MACE', '#ffd0f0', 16); }
    else if (w === 2) { c.setAnim('castFwd', 0.3); shot(g, c, { pos: c.handPos(), dir: A.dir, speed: 46, r: 1.3, dmg: 20, life: 1.2, col, size: 1.7, shape: 'orb', onEnd: (p, why) => { if (why !== 'life') blast(g, c, p, 5, 24, col, { kb: 9, heavy: true }); } }); g.popup(c, '⑤ BAZOOKA', '#ffd0f0', 16); }
    else { c.setAnim('jabR', 0.3); rush(g, c, A.flat, 12, 0.16, col, 30, { kb: 6, heavy: true }, 3, 3); g.popup(c, '① LANCE', '#ffd0f0', 16); }
  };
  return {
    notes: ['Nen type: Conjuration. A dying man\'s circus of blades, rolled out one weapon at a time', 'Crazy Slots rolls scythe / mace / bazooka / lance – a 1-in-12 JACKPOT 7-7-7 fires all four', 'Carbine shots charge into a piercing round'],
    skills: [
      skill('Z', 'Crazy Slots', 0, 8, [3, 22], 'The roulette spins and conjures a random weapon: scythe sweep, mace smash, bazooka or lance dash. A 1-in-12 JACKPOT fires all four!', (g, c) => {
        prep(g, c, 'summon', 0.18, 0.7, col);
        const jackpot = Math.random() < 1 / 12, w = Math.floor(Math.random() * 4);
        g.after(0.2, c, () => { if (jackpot) { g.popup(c, '7 · 7 · 7  JACKPOT!', '#ffe14a', 26); g.flash('#ffe14a', 0.3); [0, 1, 2, 3].forEach((k, i) => g.after(i * 0.32, c, () => { const A = g.aim(c); c.faceNow(A.yaw); weapon(g, c, k); })); c.lock = 1.5; } else weapon(g, c, w); });
      }),
      skill('X', 'Silent Waltz', 0, 10, [0, 8], 'Spin with the scythe, releasing three invisible slashes in every direction. The third launches.', (g, c) => {
        prep(g, c, 'spin', 0.1, 0.9, col);
        for (let i = 0; i < 3; i++) g.after(0.15 + i * 0.22, c, () => { c.faceNow(c.yaw + 2.1); c.setAnim('slashSide', 0.2); g.fx.ring(gnd(c.pos), col, 1, 7.5, 0.3); g.hitSphere(c.chestPos(), 7.5, c, i === 2 ? 22 : 12, { color: col, skill: true, kb: i === 2 ? 8 : 1, launch: i === 2 ? 9 : 0, heavy: i === 2, bleed: 2 }); sfx('slash'); });
      }),
      skill('C', 'Carbine: Dead Eye', 0, 7, [6, 38], 'Tap for a two-round burst. HOLD to line up a single piercing high-calibre round that staggers.', (g, c, ch) => {
        prep(g, c, 'point', 0.08, ch > 0.4 ? 0.5 : 0.4, col);
        if (ch > 0.4) g.after(0.1, c, () => gun(g, c, 30 + ch * 20, ch));
        else { g.after(0.08, c, () => gun(g, c, 12)); g.after(0.2, c, () => gun(g, c, 12)); }
      }, { charge: 0.9, chargeAnim: 'chargePalm' }),
      skill('V', 'Jackpot 7-7-7', 55, 70, [0, 22], 'ULTIMATE (55 energy): the slots land triple 7 – the Scythe awakens for 10s: giant reach, wide arcs, relentless attack speed.', (g, c) => old.skills[3].cast(g, c, 0), { can: (_g, c) => !c.form }),
      skill('F', 'Slot Flip', 0, 5, [2, 16], 'Backflip away (or in your move direction) while firing two carbine rounds at your target.', (g, c) => {
        const A = g.aim(c); c.faceNow(A.yaw); c.setAnim('leap', 0.4);
        const d = c.moveInput.lengthSq() > 0.05 ? V3(c.moveInput.x, 0, c.moveInput.y).normalize() : A.flat.clone().negate();
        c.vy = 12; c.onGround = false; g.dashF(c, d, 9, 0.28); c.invuln = Math.max(c.invuln, 0.2); sfx('dash');
        g.after(0.1, c, () => gun(g, c, 11)); g.after(0.22, c, () => gun(g, c, 11));
      }),
    ],
  };
};

// ============================================================ KNOV  –  Emission: doors, rifts, and the room between them
export const knov = (old: CharDef): Kit => {
  const col = old.color;
  const rift = (g: Game, at: THREE.Vector3, n: THREE.Vector3, r: number, t: number) => g.fx.portal(at.clone().setY(at.y + 1.6), n, r, col, t);
  return {
    notes: ['Nen type: Emission. Two doors placed in the world, and the small dark room between them', 'Doors: two linked portals redirect any enemy that touches the entrance', 'Window to the Void deals the biggest single hit but demands closing the gap'],
    skills: [
      skill('Z', 'Scream: Window to the Void', 0, 11, [2, 12], 'Dash up to 8m, wrap a portal around the enemy and snap it shut: "CLOSE!" A huge, near-silent hit with a long stun.', (g, c) => {
        const A = prep(g, c, 'castFwd', 0.12, 0.9, col);
        g.after(0.12, c, () => {
          const t = A.target ?? g.target(c, 14);
          if (t) { const d = Math.hypot(t.pos.x - c.pos.x, t.pos.z - c.pos.z); if (d > 3) g.dashF(c, V3((t.pos.x - c.pos.x) / d, 0, (t.pos.z - c.pos.z) / d), Math.min(8, d - 2.4), 0.12); }
          const at = t ? t.pos.clone() : gnd(c.pos).addScaledVector(c.forward(), 4);
          rift(g, at, V3(0, 0, 1), 4, 0.7); rift(g, at, V3(1, 0, 0), 4, 0.7); g.fx.telegraph(gnd(at), 4, col, 0.5); sfx('charge');
          g.after(0.5, c, () => { g.fx.explosion(at.clone().setY(at.y + 1.5), 0x05030c, 3.5, 0.4); g.flash('#1a1030', 0.3); sfx('boom'); blast(g, c, at, 4, 54, col, { stun: 0.9, kb: 4, heavy: true }, false); });
        });
      }),
      skill('X', 'Hide and Seek: Trapdoor', 0, 12, [3, 24], 'Open a door under the target: anyone caught is swallowed for 1.3s (stunned), then spat out beside you.', (g, c) => {
        prep(g, c, 'castFwd', 0.15, 0.5, col);
        const at = spot(g, c, 24);
        delayed(g, c, at, 4.5, 0.5, col, () => { g.fx.ring(gnd(at), col, 1, 4.5, 0.5); sfx('boom'); const vs = blast(g, c, at, 4.5, 24, col, { stun: 1.3, heavy: true }, true); for (const v of vs) { const A = g.aim(c); g.later(1.3, () => { if (v.dead) return; v.pos.x = c.pos.x + A.flat.x * 5 + rnd(-1, 1); v.pos.z = c.pos.z + A.flat.z * 5; g.clampPos(v.pos); g.fx.burst(v.chestPos(), col, 10, 6, 0.3); }); } });
      }),
      skill('C', 'Hide and Seek: Doors', 0, 14, [5, 26], 'Open a linked pair of portals and hop through. For 4.5s any enemy touching the entrance comes out at the exit, slowed.', (g, c) => {
        prep(g, c, 'castFwd', 0.12, 0.4, col);
        const a = gnd(c.pos), A = g.aim(c), b = spot(g, c, 22);
        rift(g, a, V3(A.flat.x, 0, A.flat.z), 3, 4.5); rift(g, b, V3(A.flat.x, 0, A.flat.z), 3, 4.5);
        g.after(0.15, c, () => { tele(g, c, b); g.fx.burst(c.chestPos(), col, 14, 7, 0.3); });
        g.addZone({ pos: a.clone(), r: 3.2, t: 4.5, owner: c, tick: (gg, z) => { for (const v of gg.enemies(c)) { if (Math.hypot(v.pos.x - a.x, v.pos.z - a.z) < z.r && (v.st.doorT ?? 0) <= 0) { v.st.doorT = 1.5; v.pos.x = b.x + rnd(-1, 1); v.pos.z = b.z + rnd(-1, 1); gg.applySlow(v, 1.5, 0.6); gg.fx.burst(v.chestPos(), col, 10, 6, 0.3); gg.popup(v, 'DOOR', '#c8d0ff', 16); } } for (const v of gg.enemies(c)) if ((v.st.doorT ?? 0) > 0) v.st.doorT -= 0.016; } });
      }),
      skill('V', 'Fourth-Dimension Condominium', 55, 70, [0, 28], 'ULTIMATE (55 energy): open the Condominium – a hidden Nen mansion that rewrites the fight.', (g, c) => old.skills[3].cast(g, c, 0), { can: (_g, c) => !c.form }),
      skill('F', 'Portal Step', 0, 5, [6, 20], 'Slip through a rift and reappear up to 13m away, blasting anyone near the exit.', (g, c) => {
        const A = g.aim(c); c.faceNow(A.yaw); const from = gnd(c.pos), to = spot(g, c, 13);
        rift(g, from, V3(A.flat.x, 0, A.flat.z), 2.4, 0.6); rift(g, to, V3(A.flat.x, 0, A.flat.z), 2.4, 0.6);
        sfx('dash'); tele(g, c, to); c.invuln = Math.max(c.invuln, 0.2);
        g.after(0.1, c, () => blast(g, c, gnd(c.pos), 5, 14, col, { kb: 5, stun: 0.3 }));
      }),
    ],
  };
};

// ============================================================ KNUCKLE  –  Enhancement: Hakoware debt, a fortress body
export const knuckle = (old: CharDef): Kit => {
  const col = old.color;
  return {
    notes: ['Nen type: Enhancement. A body trained into a fortress, with a debt of aura attached to every punch', 'Every hit lends aura (Hakoware debt). Collection Mode cashes the debt for damage and heals you', 'Ken (V) is a full guard stance with huge armour'],
    skills: [
      skill('Z', 'Loan Strike', 0, 7, [2, 14], 'Lunge and land a heavy punch. Every blow lends the victim aura – building their Hakoware debt.', (g, c) => {
        prep(g, c, 'bodyR', 0.16, 0.5, col);
        g.after(0.16, c, () => { const A = g.aim(c); c.faceNow(A.yaw); g.dashF(c, A.flat, 3.4, 0.1); g.after(0.1, c, () => cut(g, c, { range: 5, half: 0, dmg: 34, col, kb: 11, stun: 0.45, heavy: true })); });
      }),
      skill('X', 'Potclean Express', 0, 10, [4, 30], 'Launch Potclean (A.P.R.) after the enemy. It sticks on contact: big debt and a 2.5s slow.', (g, c) => {
        prep(g, c, 'throw', 0.14, 0.4, col);
        g.after(0.14, c, () => { const A = g.aim(c); c.faceNow(A.yaw); sfx('swing'); shot(g, c, { pos: c.handPos(), dir: A.dir, speed: 42, r: 1.6, dmg: 20, life: 1.6, col, size: 1.8, shape: 'wisp', homing: A.target ? { target: A.target, rate: 2.2 } : undefined, opts: { slow: 2.5, slowMul: 0.5 }, onHit: (v) => { v.st.debt = Math.min(99, (v.st.debt ?? 0) + 22); g.popup(v, 'POTCLEAN', '#ffe08a', 18); } }); });
      }),
      skill('C', 'Collection Mode', 0, 12, [0, 8], 'A thunderous slam that collects what you are owed: damage scales with the target\'s debt (cashes it in), high debt stuns, and you heal for part of it.', (g, c) => {
        prep(g, c, 'slamR', 0.25, 0.65, col);
        g.after(0.28, c, () => {
          const p = gnd(c.pos).addScaledVector(c.forward(), 2.5);
          g.fx.crack(p, col, 7, 3); sfx('boom'); g.shake(0.6);
          let total = 0;
          blast(g, c, p, 7.5, 24, col, { kb: 8, heavy: true, onHit: (v) => { const d = v.st.debt ?? 0; if (d > 0) { g.damage(c, v, d * 0.75, { color: col, skill: true, noCrit: true, heavy: true }); if (d >= 60) g.stunFighter(v, 1.1); total += d; v.st.debt = 0; g.popup(v, `COLLECTED ${Math.round(d)}`, '#ffe08a', 20); } } });
          if (total > 0) g.heal(c, total * 0.25);
        });
      }),
      skill('V', 'Hakoware: Bankruptcy', 55, 70, [0, 20], 'ULTIMATE (55 energy): Ken – 8s of total armour and a debt-collecting aura.', (g, c) => old.skills[3].cast(g, c, 0), { can: (_g, c) => !c.form }),
      skill('F', 'Ko Rush', 0, 6, [5, 22], 'A blistering shoulder charge: tramples whoever stands in your way.', (g, c) => { const A = prep(g, c, 'flykick', 0.08, 0.4, col); g.after(0.08, c, () => rush(g, c, A.flat, 11, 0.2, col, 18, { kb: 7, stun: 0.3 }, 4, 3.2)); }),
    ],
  };
};

// ============================================================ PITOU  –  Specialisation: Doctor Blythe, lifesteal claws
export const pitou = (old: CharDef): Kit => {
  const col = old.color, MINT = 0x9bffd0;
  return {
    notes: ['Nen type: Specialisation. A conjured physician that eats the wound it stitches', 'Razor Claws and Cat\'s Pounce heal you for part of the damage', 'Doctor Blythe: brief armour + heal over time'],
    skills: [
      skill('Z', 'Razor Claws', 0, 7, [3, 18], 'Blur through the enemy in six razor slashes (heal a sliver on every hit). The last one launches and bleeds.', (g, c) => {
        const A = prep(g, c, 'slashR', 0.1, 0.65, col);
        g.after(0.1, c, () => { const A2 = g.aim(c); c.faceNow(A2.yaw); rush(g, c, A2.flat, 9, 0.28, col, 36, { bleed: 3, bleedDps: 5, onHit: () => g.heal(c, 3, true) }, 6, 3.4); void A; });
        g.after(0.42, c, () => { c.setAnim('slashSide', 0.2); cut(g, c, { range: 5, half: -0.3, dmg: 14, col, launch: 9, bleed: 3 }); });
      }),
      skill('X', "Puppeteer's Strings", 0, 11, [4, 30], 'Nen strings seize the target in place for 1.1s while puppet-spirits rain homing bolts on them.', (g, c) => {
        const A = prep(g, c, 'point', 0.15, 0.6, col);
        const t = A.target ?? g.target(c, 30);
        if (!t) return;
        g.after(0.15, c, () => { g.fx.chain(() => c.handPos(), () => t.chestPos(), col, 1.1, 14); t.root_ = Math.max(t.root_, 1.1); g.stunFighter(t, 0.5); for (let i = 0; i < 4; i++) g.after(0.1 + i * 0.2, c, () => shot(g, c, { pos: t.chestPos().add(V3(rnd(-4, 4), 4 + rnd(0, 2), rnd(-4, 4))), dir: V3(0, -1, 0), speed: 30, r: 1.1, dmg: 11, life: 0.8, col, size: 1.1, shape: 'wisp', homing: { target: t, rate: 4 } })); });
      }),
      skill('C', 'Doctor Blythe', 0, 18, [0, 99], 'Summon the surgeon doll: for 2.4s you take 45% less damage and heal 30% of your health, with a 40 shield.', (g, c) => {
        prep(g, c, 'summon', 0.2, 1.6, MINT);
        g.addShield(c, 40); c.dmgTaken = 0.55; g.fx.dome(c.chestPos(), 3.4, MINT, 2.4, 0.18);
        for (let i = 0; i < 10; i++) g.after(0.2 + i * 0.24, c, () => { g.heal(c, c.maxHp * 0.03); g.fx.burst(c.chestPos(), MINT, 6, 4, 0.5); if (i % 3 === 0) g.fx.ring(gnd(c.pos), MINT, 0.5, 3.4, 0.4); });
        g.later(2.6, () => { if (c.form !== 'terps') c.dmgTaken = 1; });
      }, { can: (_g, c) => c.hp < c.maxHp * 0.9 }),
      skill('V', 'Terpsichora', 55, 70, [0, 20], 'ULTIMATE (55 energy): Dance Beyond the Limit – 10s of the puppeteer dancing through your body: blistering speed, attack rate and stun immunity.', (g, c) => old.skills[3].cast(g, c, 0), { can: (_g, c) => !c.form }),
      skill('F', "Cat's Pounce", 0, 6, [6, 24], 'Spring across the field and crash down with a clawed shockwave that makes enemies bleed (and heals you).', (g, c) => {
        const A = g.aim(c); c.faceNow(A.yaw); c.setAnim('leap', 0.5); c.lock = 0.1;
        g.after(0.06, c, () => { c.vy = 16; c.onGround = false; c.invuln = Math.max(c.invuln, 0.15); c.forced = { vx: A.flat.x * 19, vz: A.flat.z * 19, t: 1.4, T: 1.4, ease: false, land: true }; sfx('dash'); c.onLand = { t: 3, fn: () => { const vs = blast(g, c, gnd(c.pos), 5.5, 22, col, { kb: 5, bleed: 3, bleedDps: 5, heavy: true }); if (vs.length) g.heal(c, 8, true); g.shake(0.3); c.forced = null; c.lock = 0; } }; });
      }),
    ],
  };
};

export const _b = { stage, empMult, mark, marks, decayMarks };
