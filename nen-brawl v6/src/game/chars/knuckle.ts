import * as THREE from 'three';
import type { CharDef, SkillDef } from '../defs';
import type { Game } from '../Game';
import type { Fighter } from '../Fighter';
import { sfx } from '../audio';
import { begin, grnd, m1, S } from './kit';
import { buildPotclean, disposeObj } from './props';

const KG = 0xffc94a;
const mascots = new WeakMap<Fighter, THREE.Group>();

function mascot(v: Fighter, on: boolean) {
  let m = mascots.get(v);
  if (on && !m) {
    m = buildPotclean();
    m.position.set(1.1, 3.9, 0);
    v.root.add(m);
    mascots.set(v, m);
  } else if (!on && m) {
    v.root.remove(m);
    disposeObj(m);
    mascots.delete(v);
    m = undefined;
  }
  return m;
}

/** Hakoware: lend aura to the victim. When the debt tops 100 they go bankrupt. */
export function lend(g: Game, c: Fighter, v: Fighter, amt: number) {
  if (v.dead || (v.st.zetsuT ?? 0) > 0) return;
  v.st.debt = Math.min(100, (v.st.debt ?? 0) + amt);
  mascot(v, true);
  if (v.st.debt >= 100) bankrupt(g, c, v);
}
function bankrupt(g: Game, c: Fighter, v: Fighter) {
  v.st.debt = 0;
  v.st.zetsuT = 6;
  v.energy = 0;
  mascot(v, false);
  g.popup(v, 'BANKRUPT! FORCED ZETSU', '#ffd96a', 26);
  g.fx.explosion(v.chestPos(), KG, 3.4, 0.5);
  g.fx.pillar(grnd(v.pos), KG, 2.4, 14, 0.7);
  g.fx.impact(v.chestPos(), KG, 2.4);
  g.flash('#ffd36a', 0.25);
  g.shake(0.4);
  g.applySlow(v, 3, 0.7);
  sfx('boom');
  void c;
}

/** Z – Loan Strike */
function loanStrike(g: Game, c: Fighter) {
  const A = begin(g, c, 'rock', 0.55, 0.5);
  sfx('charge');
  g.fx.gather(c.handPos(), KG, 2, 8);
  const t = A.target ?? g.target(c, 16);
  g.after(0.16, c, () => {
    if (t && !t.dead) {
      const d = new THREE.Vector3(t.pos.x - c.pos.x, 0, t.pos.z - c.pos.z);
      const L = d.length();
      d.normalize();
      c.faceNow(Math.atan2(d.x, d.z));
      g.dashF(c, d, Math.max(0, Math.min(L - 2, 9)), 0.12);
      g.fx.speedLines(c.chestPos(), d, KG, 8, 5, 0.25);
    }
  });
  g.after(0.3, c, () => {
    const f = c.forward();
    const hits = g.hitArc(c, 5.2, 0.0, 22, { kb: 8, stun: 0.3, heavy: true, color: KG, skill: true });
    g.fx.slashX(c.chestPos().addScaledVector(f, 2), f, KG, 4.4, 0.3);
    g.fx.explosion(c.chestPos().addScaledVector(f, 2.6), KG, 2.2, 0.3);
    g.shake(0.4);
    sfx('heavy');
    hits.forEach((v) => {
      g.fx.impact(v.chestPos(), KG, 2, f);
      lend(g, c, v, 18);
    });
  });
}

/** X – Potclean Express */
function express(g: Game, c: Fighter) {
  const A = begin(g, c, 'castR', 0.45, 0.4);
  sfx('charge');
  g.fx.gather(c.handPos(), 0xffffff, 1.6, 8);
  g.after(0.2, c, () => {
    const a = g.aim(c);
    const t = a.target ?? g.target(c, 40);
    c.faceNow(a.yaw);
    g.shoot({
      owner: c, pos: c.handPos().addScaledVector(a.flat, 0.8), dir: a.dir.clone(), speed: 30, radius: 1.5, dmg: 9, life: 2.6, color: KG, size: 1.1, shape: 'wisp', noGround: true,
      homing: t ? { target: t, rate: 3.2 } : undefined, opts: { kb: 2, color: KG, skill: true },
      onHit: (v, p) => {
        g.fx.impact(p, 0xffffff, 1.4);
        g.applySlow(v, 2.2, 0.7);
        lend(g, c, v, 55);
        g.popup(v, "IT'S TIME. ADDING INTEREST", '#ffe08a', 18);
      },
    });
  });
  void A;
}

/** C – Collection Mode: cash in the debt for damage */
function collect(g: Game, c: Fighter) {
  begin(g, c, 'slamR', 0.7, 0.7);
  sfx('charge');
  g.fx.gather(c.handPos(), KG, 2.4, 10);
  g.after(0.36, c, () => {
    const f = c.forward();
    const p = grnd(c.pos).addScaledVector(f, 2.6);
    g.fx.shockwave(p, KG, 6, 0.5);
    g.fx.crack(p, KG, 4.5, 3);
    g.fx.debris(p, 10, 8);
    g.shake(0.45);
    sfx('boom');
    const owed = new Map<Fighter, number>();
    const hits = g.hitArc(c, 5.6, -0.1, 22, {
      kb: 9, launch: 6, heavy: true, color: KG, skill: true,
      mult: (v) => {
        const d = v.st.debt ?? 0;
        owed.set(v, d);
        return 1 + d * 0.015;
      },
    });
    for (const v of hits) {
      const d = owed.get(v) ?? 0;
      g.fx.impact(v.chestPos(), KG, 2.2);
      if (d > 5) {
        g.popup(v, `COLLECTED ${Math.round(d)}`, '#ffe08a', 22);
        v.energy = Math.max(0, v.energy - d * 0.5);
      }
      if (d >= 60) g.stunFighter(v, 1.0, true);
      v.st.debt = 0;
      mascot(v, false);
    }
  });
}

/** V – Bankruptcy: Ken, then a savage rush that forces the target to go bust */
function bankruptcy(g: Game, c: Fighter) {
  const A = g.aim(c);
  const t = A.target ?? g.target(c, 30);
  c.faceNow(A.yaw);
  c.lock = 2.6;
  c.invuln = Math.max(c.invuln, 1.2);
  c.setAnim('summon', 1.1);
  sfx('charge');
  g.popup(c, 'HAKOWARE: BANKRUPTCY', '#ffe08a', 26);
  g.flash('#ffd36a', 0.28);
  g.fx.beamColumn(grnd(c.pos), KG, 2.6, 16, 1.2);
  g.fx.shockwave(grnd(c.pos), KG, 9, 0.7);
  g.after(1.1, c, () => {
    if (!t || t.dead) return;
    const d = new THREE.Vector3(t.pos.x - c.pos.x, 0, t.pos.z - c.pos.z);
    const L = d.length();
    d.normalize();
    c.faceNow(Math.atan2(d.x, d.z));
    g.fx.afterimage(c.pos, c.yaw, KG);
    g.dashF(c, d, Math.max(0, Math.min(L - 2, 16)), 0.14);
    g.fx.speedLines(c.chestPos(), d, KG, 12, 7, 0.3);
  });
  for (let i = 0; i < 7; i++) {
    g.after(1.3 + i * 0.12, c, () => {
      if (!t || t.dead) return;
      c.faceNow(Math.atan2(t.pos.x - c.pos.x, t.pos.z - c.pos.z));
      c.setAnim(i % 2 ? 'hookL' : 'jabR', 0.12);
      const hits = g.hitArc(c, 5.4, -0.1, 7, { kb: 0.5, stun: 0.12, color: KG, noCrit: true, skill: true, pierce: false });
      hits.forEach((v) => {
        g.fx.impact(v.chestPos(), KG, 0.9);
        lend(g, c, v, 12);
      });
      g.fx.trailSeg(c.chestPos(), c.chestPos().addScaledVector(c.forward(), 3.5), i % 2 ? 0xffffff : KG, 0.3, 0.14);
      sfx('hit');
    });
  }
  g.after(1.3 + 7 * 0.12 + 0.1, c, () => {
    c.setAnim('upperR', 0.45);
    const f = c.forward();
    g.fx.slashX(c.chestPos().addScaledVector(f, 2), f, KG, 5, 0.34);
    const hits = g.hitArc(c, 6, -0.1, 28, { kb: 10, launch: 11, heavy: true, stun: 0.7, color: KG, skill: true });
    g.shake(0.6);
    sfx('boom');
    hits.forEach((v) => {
      g.fx.impact(v.chestPos(), KG, 2.6);
      v.st.debt = 99;
      lend(g, c, v, 20);
    });
    g.setForm(c, 'guanyin', 8);
    c.dmgTaken = 0.75;
    c.buffDmg = 1.1;
  });
}

/** F – Ko Rush */
function rush(g: Game, c: Fighter) {
  const A = g.aim(c);
  c.faceNow(A.yaw);
  c.lock = 0.5;
  c.setAnim('flyKick', 0.4);
  sfx('dash');
  g.fx.afterimage(c.pos, c.yaw, KG);
  g.fx.speedLines(c.chestPos(), A.flat, KG, 10, 6, 0.3);
  g.dashF(c, A.flat, 15, 0.22);
  g.trail(c, 1, KG, 0.3, 0.8);
  g.after(0.14, c, () => {
    const f = c.forward();
    const hits = g.hitArc(c, 5, -0.1, 15, { kb: 9, stun: 0.3, heavy: true, color: KG, skill: true });
    hits.forEach((v) => {
      g.fx.impact(v.chestPos(), KG, 1.6, f);
      lend(g, c, v, 14);
    });
    if (hits.length) g.shake(0.3);
  });
}

const SKILLS: SkillDef[] = [
  { key: 'Z', name: 'Loan Strike', cost: 0, cd: 7, ai: [2, 16], desc: 'Lunge and land a heavy punch. Every blow "lends" the victim aura, building their Hakoware debt.', cast: (g, c) => loanStrike(g, c) },
  { key: 'X', name: 'Potclean Express', cost: 0, cd: 10, ai: [4, 30], desc: 'Launch Potclean (A.P.R.) after the enemy. It sticks on contact: big debt, plus a slow.', cast: (g, c) => express(g, c) },
  { key: 'C', name: 'Collection Mode', cost: 0, cd: 12, ai: [0, 7], desc: 'A thunderous slam that collects what you are owed: damage scales with the target\'s debt. High debt also stuns and drains their energy.', cast: (g, c) => collect(g, c) },
  {
    key: 'V', name: 'Hakoware: Bankruptcy', cost: 55, cd: 70, ai: [0, 20], can: (_g, c) => !c.form,
    desc: 'ULTIMATE (55 energy): Ken up, then a seven-hit rush into a launching uppercut that pushes the target to the brink of bankruptcy. You gain Ken afterwards (−25% damage taken).',
    cast: (g, c) => bankruptcy(g, c),
  },
  { key: 'F', name: 'Ko Rush', cost: 0, cd: 6, ai: [5, 22], desc: 'A blistering shoulder charge that tramples whoever stands in your way.', cast: (g, c) => rush(g, c) },
];

export const KNUCKLE: CharDef = {
  kind: 'knuckle', name: 'Knuckle', title: 'KNUCKLE BINE', typ: 'Conjuration · Hakoware debt collector', color: KG, css: '#ffd463', hp: 470, speed: 10.0,
  blurb: 'A hot-blooded brawler who lends you aura — with interest. Push the enemy into bankruptcy and they lose their Nen entirely.',
  meter: { name: 'KEN', color: '#ffd463', start: 0, max: 100 },
  passive: { name: 'Hakoware', desc: 'Every hit lends the enemy aura (Potclean debt, +interest over time). At 100 debt they go BANKRUPT: forced Zetsu — no skills, energy drained — for 6s. Their hits on you repay debt and heal you. Full Ken meter = −25% damage taken for 3s.' },
  gainHit: 0.8, gainHurt: 0.4,
  skills: SKILLS,
  update(g, c, dt) {
    c.st.intTick = (c.st.intTick ?? 0) - dt;
    const tickNow = c.st.intTick <= 0;
    if (tickNow) c.st.intTick = 3;
    if (c.form !== 'guanyin') c.dmgTaken = (c.st.kenT ?? 0) > 0 ? 0.75 : 1;
    if ((c.st.kenT ?? 0) > 0 && Math.random() < dt * 8) g.fx.aura(c.pos, KG, 1, 3.4 * c.scaleNow, 0.9);
    for (const e of g.enemies(c)) {
      const m = mascots.get(e);
      if (e.dead) {
        if (m) mascot(e, false);
        continue;
      }
      const d = e.st.debt ?? 0;
      if (d <= 0) {
        if (m) mascot(e, false);
        continue;
      }
      if (tickNow && d > 0) {
        e.st.debt = Math.min(99, d * 1.1 + 2);
        g.popup(e, `INTEREST ${Math.round(e.st.debt)}`, '#ffe08a', 15);
      }
      if (m) {
        const t = performance.now() / 1000;
        const k = 0.35 + (e.st.debt / 100) * 0.9;
        m.scale.setScalar(k / e.rig.baseScale);
        m.position.y = (3.9 + Math.sin(t * 4) * 0.15) ;
        (m.userData.wingL as THREE.Object3D).rotation.z = Math.sin(t * 22) * 0.5;
        (m.userData.wingR as THREE.Object3D).rotation.z = -Math.sin(t * 22) * 0.5;
      }
    }
  },
  onDealt(g, att, vic, amt) {
    lend(g, att, vic, amt * 0.9);
    if (att.meter >= 99) {
      att.meter = 0;
      att.st.kenT = 3;
      g.popup(att, 'KEN', '#ffe08a', 22);
      g.fx.pillar(att.pos, KG, 1.6, 9, 0.5);
    }
  },
  onHurt(g, vic, att, amt) {
    const d = att.st.debt ?? 0;
    if (d > 0) {
      att.st.debt = Math.max(0, d - amt * 0.8);
      g.heal(vic, amt * 0.3);
      g.fx.burst(vic.chestPos(), KG, 6, 5, 0.3);
    }
  },
  m1: m1(0.9, 0.8, [
    S('jabR', 10, 0.3, 0.11, 4.2, { color: KG, trail: 1, lunge: 1.8 }),
    S('hookL', 10, 0.3, 0.12, 4.2, { color: KG, trail: 2, arc: 0.0, kb: 2.5, recoil: true }),
    S('bodyR', 11, 0.3, 0.12, 4.3, { color: KG, trail: 1, kb: 2 }),
    S('upperL', 12, 0.32, 0.13, 4.3, { color: KG, trail: 2, launch: 7, hop: 6 }),
    S('slamR', 20, 0.5, 0.26, 4.8, { color: KG, trail: 1, arc: -0.1, kb: 10, heavy: true, shock: 5, lunge: 2.6 }),
  ]),
  m1Air: m1(0.8, 0.8, [
    S('jabR', 10, 0.3, 0.11, 4.0, { color: KG, trail: 1 }),
    S('jabL', 10, 0.3, 0.11, 4.0, { color: KG, trail: 2 }),
    S('kickR', 11, 0.3, 0.13, 4.2, { color: KG, trail: 3, kb: 2.5 }),
    S('spinKick', 11, 0.34, 0.16, 4.5, { color: KG, trail: 3, arc: -0.3, kb: 4, side: true }),
    S('slamR', 17, 0.48, 0.22, 4.5, { color: KG, arc: 0.0, kb: 2, slam: true, heavy: true, shock: 5 }),
  ]),
  m1Mode: 'repeat', m1Range: 4.4,
};
