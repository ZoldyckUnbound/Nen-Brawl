import * as THREE from 'three';
import type { CharDef, SkillDef } from '../defs';
import type { Game } from '../Game';
import type { Fighter } from '../Fighter';
import { sfx } from '../audio';
import { begin, grnd, m1, S, rnd } from './kit';
import { buildRoulette, buildScythe, setOpacity, disposeObj } from './props';

const BL = 0x6fd0ff;
const PK = 0xff7ad0;

/** pop the clown roulette next to the caster, spin it and settle on a number */
function spinWheel(g: Game, c: Fighter, number: number, dur = 0.6, size = 1) {
  const w = buildRoulette();
  const wheel = w.userData.wheel as THREE.Object3D;
  const spinTo = -((number - 0.5) / 9) * Math.PI * 2;
  g.fx.custom(w, dur + 0.5, (p) => {
    const e = Math.min(1, p / (dur / (dur + 0.5)));
    const ease = 1 - Math.pow(1 - e, 3);
    w.position.set(c.pos.x, c.pos.y + 5.2 * c.scaleNow, c.pos.z);
    if (g.cameraYaw !== undefined) w.rotation.y = g.cameraYaw;
    wheel.rotation.z = spinTo + (1 - ease) * Math.PI * 10;
    const grow = Math.min(1, p * 8) * (0.8 + 0.2 * Math.min(1, (1 - p) * 4));
    w.scale.setScalar(size * grow);
    setOpacity(w, Math.min(1, (1 - p) * 4));
  }, () => disposeObj(w));
  sfx('charge');
}

function bullet(g: Game, c: Fighter, dir: THREE.Vector3, dmg: number, big = false) {
  const o = c.handPos().addScaledVector(dir, 1.2);
  g.fx.flashAt(o, 0xffe2a0, big ? 2.2 : 1.3, 0.1);
  g.fx.sparks(o, 0xffd080, 6, 9);
  g.shoot({
    owner: c, pos: o, dir: dir.clone(), speed: big ? 95 : 72, radius: big ? 1.0 : 0.7, dmg, life: 0.8, color: 0xffd9a0, size: big ? 0.8 : 0.5, shape: 'bullet', pierce: big,
    opts: { kb: big ? 8 : 1.6, stun: big ? 0.45 : 0.06, heavy: big, color: 0xffd9a0, skill: true, noCrit: !big },
    onHit: (_v, p) => g.fx.impact(p, 0xffe2a0, big ? 1.4 : 0.7),
  });
  sfx('boom');
}

/** Scythe weapon: wide sweeping Silent-Waltz style slash */
function scytheSweep(g: Game, c: Fighter, dmg: number) {
  const A = g.aim(c);
  c.faceNow(A.yaw);
  c.setAnim('slashSideL', 0.4);
  const f = c.forward();
  g.fx.slashX(c.chestPos().addScaledVector(f, 2.2), f, BL, 6.5, 0.34);
  g.fx.shockwave(grnd(c.pos).addScaledVector(f, 3), BL, 5, 0.4);
  const hits = g.hitArc(c, 7.2, -0.35, dmg, { kb: 8, stun: 0.35, heavy: true, color: BL, skill: true });
  hits.forEach((v) => g.fx.impact(v.chestPos(), BL, 1.6));
  g.shake(0.3);
  sfx('slash');
}
function maceSmash(g: Game, c: Fighter, dmg: number) {
  const A = g.aim(c);
  c.faceNow(A.yaw);
  c.setAnim('overhead', 0.5);
  g.dashF(c, A.flat, 4, 0.15);
  g.after(0.26, c, () => {
    const p = grnd(c.pos).addScaledVector(c.forward(), 3.6);
    g.fx.shockwave(p, 0xffb060, 6, 0.5);
    g.fx.crack(p, 0xffb060, 4.5, 3);
    g.fx.debris(p, 12, 8);
    g.fx.explosion(p.clone().setY(1), 0xffb060, 2.6, 0.4);
    g.shake(0.5);
    sfx('boom');
    const hits = g.hitSphere(p, 5, c, dmg, { kb: 10, stun: 0.6, heavy: true, color: 0xffb060, skill: true });
    hits.forEach((v) => g.fx.impact(v.chestPos(), 0xffb060, 2));
  });
}
function carbineBurst(g: Game, c: Fighter) {
  c.setAnim('point', 0.5);
  for (let i = 0; i < 4; i++)
    g.after(0.12 + i * 0.11, c, () => {
      const A = g.aim(c);
      c.faceNow(A.yaw);
      const d = A.dir.clone();
      d.x += rnd(-0.02, 0.02);
      d.z += rnd(-0.02, 0.02);
      bullet(g, c, d.normalize(), 10);
    });
}

/** Z – Crazy Slots: roll the roulette and get a random weapon attack */
function crazySlots(g: Game, c: Fighter) {
  const A = begin(g, c, 'castUp', 0.5, 0.55);
  void A;
  const roll = Math.random();
  const num = roll < 0.34 ? 2 : roll < 0.67 ? 3 : 4;
  spinWheel(g, c, num, 0.5);
  g.fx.gather(c.handPos(), PK, 2, 8);
  g.after(0.55, c, () => {
    const name = num === 2 ? 'No.2 · SCYTHE' : num === 3 ? 'No.3 · MACE' : 'No.4 · CARBINE';
    g.popup(c, name, '#ffb0e8', 22);
    g.fx.burst(c.chestPos().add(new THREE.Vector3(0, 2, 0)), PK, 18, 9, 0.5);
    if (num === 2) scytheSweep(g, c, 30);
    else if (num === 3) maceSmash(g, c, 34);
    else carbineBurst(g, c);
  });
  return 8;
}

/** X – Silent Waltz: three invisible, expanding slashes around Kite */
function silentWaltz(g: Game, c: Fighter) {
  c.lock = 0.95;
  c.setAnim('spin', 0.8, 2);
  sfx('charge');
  g.fx.gather(c.chestPos(), BL, 3, 8);
  for (let i = 0; i < 3; i++)
    g.after(0.2 + i * 0.22, c, () => {
      const last = i === 2;
      const p = grnd(c.pos);
      g.fx.ring(p, BL, 1, 8.5, 0.35, 0.6 + i * 0.5);
      g.fx.ring(p, 0xffffff, 1, 7.5, 0.28, 1.0 + i * 0.5);
      for (let k = 0; k < 5; k++) {
        const a = rnd(0, Math.PI * 2);
        const d = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        g.fx.slashArc(c.chestPos().addScaledVector(d, 2.4).add(new THREE.Vector3(0, rnd(-0.5, 0.8), 0)), d, rnd(-1, 1), 4.5, 0.5, BL, 0.2);
      }
      g.shake(last ? 0.45 : 0.2);
      sfx(last ? 'heavy' : 'slash');
      const hits = g.hitSphere(p, 7.6, c, last ? 20 : 11, { kb: last ? 11 : 3, launch: last ? 9 : 0, stun: last ? 0.5 : 0.12, heavy: last, color: BL, skill: true });
      hits.forEach((v) => g.fx.impact(v.chestPos(), BL, last ? 1.8 : 1));
    });
}

/** C – Carbine: aimed shot. Tap = 2-round burst, full charge = piercing high-calibre round */
function carbine(g: Game, c: Fighter, ch: number) {
  c.lock = 0.4 + ch * 0.1;
  c.setAnim('point', 0.4);
  const shots = ch > 0.85 ? 1 : 2;
  for (let i = 0; i < shots; i++)
    g.after(0.06 + i * 0.12, c, () => {
      const A = g.aim(c);
      c.faceNow(A.yaw);
      if (shots === 1) {
        g.fx.speedLines(c.chestPos().addScaledVector(A.dir, 4), A.dir, 0xffe2a0, 10, 9, 0.25);
        bullet(g, c, A.dir, 44, true);
        g.shake(0.3);
      } else bullet(g, c, A.dir, 15);
    });
}

/** V – Jackpot: 7-7-7. Enter the Jackpot state: bigger blade, auto-firing carbines, faster. */
function jackpot(g: Game, c: Fighter) {
  c.lock = 1.4;
  c.invuln = Math.max(c.invuln, 0.9);
  c.setAnim('summon', 1.0);
  spinWheel(g, c, 7, 0.9, 1.7);
  g.popup(c, 'JACKPOT! 7-7-7', '#ffb0e8', 28);
  g.flash('#ff7ad0', 0.3);
  g.after(1.0, c, () => {
    g.fx.beamColumn(grnd(c.pos), PK, 3, 16, 0.8);
    g.fx.shockwave(grnd(c.pos), PK, 11, 0.7);
    for (let i = 0; i < 40; i++) g.fx.glow.emit(c.pos.x, c.pos.y + 6, c.pos.z, rnd(-8, 8), rnd(2, 10), rnd(-8, 8), [0xff7ad0, 0xffd36a, 0x6fd0ff, 0x7aff9a][i % 4], 1, rnd(0.2, 0.4), rnd(0.8, 1.5), 12, 1, 0);
    sfx('boom');
    g.shake(0.45);
    // scythe slash wave + mace smash + carbine volley all at once
    const A = g.aim(c);
    c.faceNow(A.yaw);
    g.hitSphere(grnd(c.pos), 8.5, c, 24, { kb: 9, stun: 0.5, heavy: true, color: PK, skill: true });
    g.setForm(c, 'scythe', 10);
    c.buffDmg = 1.2;
    c.speedMult = 1.1;
    c.atkSpeed = 1.15;
  });
}

/** F – Slot Flip: acrobatic leap away, firing at the enemy as you go */
function flip(g: Game, c: Fighter) {
  const A = g.aim(c);
  let dx = c.moveInput.x;
  let dz = c.moveInput.y;
  if (dx * dx + dz * dz < 0.01) {
    dx = -A.flat.x;
    dz = -A.flat.z;
  }
  const l = Math.hypot(dx, dz) || 1;
  c.faceNow(A.yaw);
  c.lock = 0.5;
  c.invuln = Math.max(c.invuln, 0.3);
  c.setAnim('leap', 0.5);
  c.vy = 13;
  c.onGround = false;
  g.dashF(c, new THREE.Vector3(dx / l, 0, dz / l), 12, 0.35);
  g.fx.afterimage(c.pos, c.yaw, BL);
  g.fx.dust(grnd(c.pos), 8, 3);
  sfx('dash');
  for (let i = 0; i < 2; i++)
    g.after(0.14 + i * 0.12, c, () => {
      const a = g.aim(c);
      bullet(g, c, a.dir, 12);
    });
}

const SKILLS: SkillDef[] = [
  { key: 'Z', name: 'Crazy Slots', cost: 0, cd: 8, ai: [3, 22], desc: 'The clown roulette spins and conjures a random weapon: No.2 Scythe sweep, No.3 Mace smash, or No.4 Carbine volley. Fortune favours the bold.', cast: (g, c) => crazySlots(g, c) },
  { key: 'X', name: 'Silent Waltz', cost: 0, cd: 11, ai: [0, 7], desc: 'Spin with the scythe, releasing three invisible slashes in every direction. The third launches.', cast: (g, c) => silentWaltz(g, c) },
  { key: 'C', name: 'Carbine: Dead Eye', cost: 0, cd: 8, charge: 0.9, chargeAnim: 'chargePalm', ai: [6, 34], desc: 'Tap for a two-round burst. HOLD to line up a single piercing high-calibre round that staggers.', cast: (g, c, ch) => carbine(g, c, ch) },
  {
    key: 'V', name: 'Jackpot 7-7-7', cost: 55, cd: 70, ai: [0, 22], can: (_g, c) => !c.form,
    desc: 'ULTIMATE (55 energy): hit the jackpot. A blast of luck, then 10s of Jackpot: a bigger blade, wider combos, +20% damage and a carbine that fires on its own.',
    cast: (g, c) => jackpot(g, c),
  },
  { key: 'F', name: 'Slot Flip', cost: 0, cd: 5, ai: [2, 14], desc: 'Backflip away (or in your move direction) while firing two carbine rounds at your target.', cast: (g, c) => flip(g, c) },
];

export const KITE: CharDef = {
  kind: 'kite', name: 'Kite', title: 'KITE', typ: 'Conjuration · Crazy Slots', color: PK, css: '#ff9ae0', hp: 410, speed: 11.0,
  blurb: "Ging's top student. A scythe, a clown roulette and a gambler's nerve — you never know which weapon is coming next.",
  meter: { name: 'LUCK', color: '#ff9ae0', start: 0, max: 100 },
  passive: { name: "Gambler's Luck", desc: 'Skill hits have a 15% chance to be LUCKY: heal 8 HP and restore 12 energy. Hits build Luck; at full Luck your next Crazy Slots rolls twice.' },
  gainHit: 0.7, gainHurt: 0.3,
  skills: SKILLS,
  onSpawn(_g, c) {
    const sc = buildScythe();
    sc.position.set(0, -0.62, 0.05);
    sc.rotation.set(2.5, 0, 0);
    sc.scale.setScalar(0.62);
    c.rig.foreR.add(sc);
    c.rig.props.scythe = sc;
  },
  update(g, c, dt) {
    const sc = c.rig.props.scythe;
    if (sc) sc.scale.setScalar(0.62 * (c.form === 'scythe' ? 1.5 : 1));
    if (c.form === 'scythe' && !c.dead) {
      c.st.autoCd = (c.st.autoCd ?? 0) - dt;
      if (c.st.autoCd <= 0) {
        c.st.autoCd = 0.55;
        const t = g.target(c, 40);
        if (t && c.lock <= 0) {
          const d = t.chestPos().sub(c.chestPos()).normalize();
          const o = c.chestPos().add(new THREE.Vector3(rnd(-1.5, 1.5), 1.8, rnd(-1.5, 1.5)));
          g.fx.flashAt(o, 0xffe2a0, 1, 0.1);
          g.shoot({ owner: c, pos: o, dir: t.chestPos().sub(o).normalize(), speed: 80, radius: 0.6, dmg: 7, life: 0.7, color: 0xffd9a0, size: 0.45, shape: 'bullet', opts: { kb: 1, color: 0xffd9a0, noCrit: true, skill: true } });
          void d;
        }
      }
      if (Math.random() < dt * 10) g.fx.aura(c.pos, PK, 1, 3.4 * c.scaleNow, 0.9);
    }
  },
  onDealt(g, att, _v, _a, o) {
    if (o.skill && Math.random() < 0.15) {
      g.heal(att, 8);
      att.energy = Math.min(att.maxEnergy, att.energy + 12);
      g.popup(att, 'LUCKY!', '#ffe07a', 22);
      g.fx.burst(att.chestPos(), 0xffd36a, 12, 7, 0.4);
    }
  },
  m1: m1(0.75, 0.8, [
    S('slashR', 9, 0.28, 0.1, 4.8, { color: BL, trail: 1, lunge: 1.8 }),
    S('slashL', 9, 0.28, 0.1, 4.8, { color: BL, trail: 2 }),
    S('slashSideL', 10, 0.3, 0.12, 5.0, { color: BL, trail: 2, arc: -0.1, kb: 2.5, side: true }),
    S('slashR', 10, 0.28, 0.1, 4.8, { color: BL, trail: 1, kb: 1 }),
    S('overhead', 16, 0.46, 0.2, 5.2, { color: BL, trail: 1, kb: 8, heavy: true, launch: 5, shock: 3.5, lunge: 2.6 }),
  ]),
  m1Air: m1(0.75, 0.8, [
    S('slashR', 9, 0.28, 0.1, 4.6, { color: BL, trail: 1 }),
    S('slashL', 9, 0.28, 0.1, 4.6, { color: BL, trail: 2 }),
    S('kickR', 9, 0.28, 0.12, 4.2, { color: BL, trail: 3, kb: 2 }),
    S('spinKick', 10, 0.32, 0.15, 4.6, { color: BL, trail: 3, arc: -0.3, kb: 4, side: true }),
    S('slamR', 14, 0.45, 0.2, 4.4, { color: BL, arc: 0.0, kb: 2, slam: true, heavy: true, shock: 4.5 }),
  ]),
  m1Form: m1(0.6, 0.8, [
    S('slashR', 11, 0.2, 0.07, 6.0, { color: PK, trail: 1, lunge: 2.2, arc: -0.1 }),
    S('slashL', 11, 0.2, 0.07, 6.0, { color: PK, trail: 2, arc: -0.1 }),
    S('slashSideL', 12, 0.22, 0.08, 6.2, { color: PK, trail: 2, arc: -0.3, kb: 3, side: true }),
    S('slashR', 12, 0.2, 0.07, 6.0, { color: PK, trail: 1, arc: -0.1 }),
    S('overhead', 19, 0.36, 0.14, 6.4, { color: PK, trail: 1, kb: 9, heavy: true, launch: 6, shock: 5, lunge: 2.6, arc: -0.2 }),
  ]),
  m1Mode: 'repeat', m1Range: 4.9,
};
