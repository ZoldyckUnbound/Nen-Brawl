import * as THREE from 'three';
import type { CharDef, SkillDef } from '../defs';
import type { Game } from '../Game';
import type { Fighter } from '../Fighter';
import { sfx } from '../audio';
import { begin, grnd, m1, S, rnd, rot } from './kit';

const GL = 0xffc83a;

function showCoins(c: Fighter, on: boolean) {
  for (const k of ['coinsL', 'coinsR']) if (c.rig.props[k]) c.rig.props[k].visible = on;
}
const rifle = (c: Fighter, n = 1) => {
  c.st.rifle = Math.min(5, (c.st.rifle ?? 0) + n);
  c.st.rifleT = 3.2;
};

/** one coin, flicked from the thumb faster than a bullet */
function coin(g: Game, c: Fighter, dir: THREE.Vector3, spread = 0, dmg = 3.3, speed = 90, left = false, big = false) {
  const flat = new THREE.Vector3(dir.x, 0, dir.z).normalize();
  const o = (left ? c.handLPos() : c.handPos()).addScaledVector(flat, 0.5);
  g.shoot({
    owner: c, pos: o, dir: spread ? rot(dir, rnd(-spread, spread)) : dir.clone(), speed, radius: big ? 1.15 : 0.8, dmg, life: big ? 0.7 : 0.55, color: GL, size: big ? 0.9 : 0.4, shape: 'bullet',
    pierce: big, opts: big ? { color: GL, kb: 5, stun: 0.3, heavy: true, skill: true } : { color: GL, kb: 0.4, skill: true, noCrit: true },
    onHit: (_v, p) => { rifle(c, big ? 2 : 1); g.fx.hitSpark(p, GL, big ? 1.2 : 0.6); },
  });
  g.fx.sparks(o, GL, 2, 5);
}

/** Z — Coin Gatling: hold to load more coins */
function gatling(g: Game, c: Fighter, ch: number) {
  begin(g, c, 'castFwd', 0.5 + ch * 0.4, 0.55 + ch * 0.45);
  showCoins(c, true);
  sfx('chain');
  const n = 8 + Math.floor(ch * 12);
  for (let i = 0; i < n; i++) {
    g.after(0.08 + i * 0.035, c, () => {
      const a = g.aim(c);
      c.faceNow(a.yaw);
      coin(g, c, a.dir, 0.06, 3.3, 90, i % 2 === 1);
      if (i % 2 === 0) sfx('card');
    });
  }
  g.after(0.12 + n * 0.035 + 0.1, c, () => showCoins(c, false));
}

/** X — Rifled Shot: one spinning coin that tears straight through everything */
function rifled(g: Game, c: Fighter) {
  begin(g, c, 'throwR', 0.35, 0.4);
  showCoins(c, true);
  sfx('zap');
  g.after(0.12, c, () => {
    const a = g.aim(c);
    c.faceNow(a.yaw);
    coin(g, c, a.dir, 0, 23, 105, false, true);
    g.fx.speedLines(c.chestPos().addScaledVector(a.flat, 3), a.dir, GL, 8, 7, 0.3);
    sfx('heavy');
    showCoins(c, false);
  });
}

/** C — Which Hand?: a fast counter-stance. Any hit is flipped back as a volley. */
function guard(g: Game, c: Fighter) {
  c.lock = 0.2;
  c.setAnim('crouch', 0.3);
  c.st.parryT = 0.9;
  sfx('card');
  g.popup(c, 'WHICH HAND?', '#ffd23a', 20);
  g.fx.orbit(() => c.chestPos(), 8, 1.8, GL, 0.9, 0.3, 0, 8);
  g.fx.ring(grnd(c.pos), GL, 0.5, 3, 0.4);
}

/** V — Full-Auto Gatling: both hands, forty coins */
function barrage(g: Game, c: Fighter) {
  c.lock = 2.2;
  c.castId++;
  c.setAnim('castFwd', 0.4);
  showCoins(c, true);
  sfx('charge');
  g.popup(c, 'COIN GATLING: FULL AUTO', '#ffd23a', 24);
  g.flash('#ffc83a', 0.2);
  g.fx.gather(c.chestPos(), GL, 2.4, 10);
  const n = 40;
  for (let i = 0; i < n; i++) {
    g.after(0.35 + i * 0.045, c, () => {
      const a = g.aim(c);
      c.faceNow(a.yaw);
      if (i % 12 === 0) c.setAnim('castFwd', 0.5);
      coin(g, c, a.dir, 0.05, 3.0, 95, i % 2 === 1);
      if (i % 3 === 0) sfx('card');
      if (i % 8 === 0) g.shake(0.06);
    });
  }
  g.after(0.4 + n * 0.045, c, () => showCoins(c, false));
}

/** F — Coin Step: flick off a coin and slide away while shooting */
function step(g: Game, c: Fighter) {
  const A = g.aim(c);
  const t = A.target ?? g.target(c, 30);
  c.lock = 0.3;
  c.invuln = Math.max(c.invuln, 0.3);
  sfx('dash');
  let d = new THREE.Vector3(c.moveInput.x, 0, c.moveInput.y);
  if (d.lengthSq() < 0.05) d = t ? new THREE.Vector3(c.pos.x - t.pos.x, 0, c.pos.z - t.pos.z) : A.flat.clone().multiplyScalar(-1);
  d.normalize();
  g.fx.afterimage(c.pos, c.yaw, GL);
  g.dashF(c, d, 12, 0.2);
  g.trail(c, 3, GL, 0.3, 0.4);
  showCoins(c, true);
  for (let i = 0; i < 4; i++) {
    g.after(0.04 + i * 0.07, c, () => {
      const a = g.aim(c);
      c.faceNow(a.yaw);
      coin(g, c, a.dir, 0.03, 3.6, 90, i % 2 === 1);
    });
  }
  g.after(0.4, c, () => showCoins(c, false));
}

const SKILLS: SkillDef[] = [
  { key: 'Z', name: 'Coin Gatling', cost: 0, cd: 4, charge: 0.8, chargeAnim: 'charge', ai: [4, 30], desc: 'Flick a stream of Nen-charged coins from both thumbs, faster than bullets. HOLD to load up to 20.', cast: (g, c, ch) => gatling(g, c, ch) },
  { key: 'X', name: 'Rifled Shot', cost: 0, cd: 7, ai: [5, 34], desc: 'A single spinning coin that pierces everything in its path — even gum. Hard knockback.', cast: (g, c) => rifled(g, c) },
  { key: 'C', name: 'Which Hand?', cost: 0, cd: 9, ai: [2, 14], desc: 'Counter stance (0.9s). The first hit is dodged and answered with a stunning volley of coins.', cast: (g, c) => guard(g, c) },
  { key: 'V', name: 'Full-Auto Gatling', cost: 50, cd: 55, ai: [4, 28], desc: 'ULTIMATE (50 energy): root yourself and unload forty coins from both hands at the cursor.', cast: (g, c) => barrage(g, c) },
  { key: 'F', name: 'Coin Step', cost: 0, cd: 4, ai: [0, 12], desc: 'Slide away in a flash (invulnerable) while firing four coins at the enemy.', cast: (g, c) => step(g, c) },
];

export const GOTOH: CharDef = {
  kind: 'gotoh', name: 'Gotoh', title: 'GOTOH', typ: 'Enhancement · Zoldyck Butler', color: GL, css: '#ffc83a', hp: 395, speed: 10.8,
  blurb: 'The Zoldycks\' head butler. A gunslinger without a gun: coins flicked from the thumbs travel faster than bullets. Keeps range, stacks rifling, punishes anyone who closes in.',
  meter: { name: 'RIFLING', color: '#ffc83a', start: 0, max: 100 },
  passive: { name: 'Rifling', desc: 'Every coin that lands adds a stack of spin (max 5): +4% damage per stack. Stacks fade after 3s without a hit. His basic attacks also flick a coin.' },
  gainHit: 0, gainHurt: 0,
  skills: SKILLS,
  dmgBonus: (c) => 1 + 0.04 * (c.st.rifle ?? 0),
  update(_g, c) {
    if ((c.st.rifleT ?? 0) <= 0) c.st.rifle = 0;
    c.meter = (c.st.rifle ?? 0) * 20;
  },
  evade(g, vic, att) {
    if ((vic.st.parryT ?? 0) <= 0 || att === vic) return false;
    vic.st.parryT = 0;
    vic.invuln = Math.max(vic.invuln, 0.35);
    g.popup(vic, 'COUNTER FLIP!', '#ffd23a', 24);
    g.fx.hitSpark(vic.chestPos(), GL, 2.4);
    g.fx.ring(grnd(vic.pos), GL, 0.5, 4, 0.35);
    sfx('zap');
    g.stunFighter(att, 0.45);
    showCoins(vic, true);
    for (let i = 0; i < 8; i++) {
      g.later(0.05 + i * 0.045, () => {
        if (vic.dead || att.dead) return;
        const d = att.chestPos().sub(vic.chestPos()).normalize();
        vic.faceNow(Math.atan2(d.x, d.z));
        coin(g, vic, d, 0.03, 3.6, 95, i % 2 === 1);
      });
    }
    g.later(0.5, () => showCoins(vic, false));
    return true;
  },
  onM1(g, c) {
    const a = g.aim(c);
    coin(g, c, a.dir, 0.02, 3.2, 92, c.combo % 2 === 0);
  },
  m1: m1(0.55, 0.8, [
    S('jabR', 5, 0.2, 0.07, 4.4, { color: GL, trail: 1, lunge: 1.2 }),
    S('jabL', 5, 0.2, 0.07, 4.4, { color: GL, trail: 2, lunge: 1.2 }),
    S('jabR', 5, 0.2, 0.07, 4.4, { color: GL, trail: 1, lunge: 1.2 }),
    S('hookL', 6, 0.24, 0.09, 4.4, { color: GL, trail: 2, kb: 1.5 }),
    S('palmR', 12, 0.36, 0.13, 5.0, { color: GL, trail: 1, kb: 7, heavy: true, launch: 3 }),
  ]),
  m1Air: m1(0.55, 0.8, [
    S('jabR', 5, 0.2, 0.07, 4.2, { color: GL, trail: 1 }),
    S('jabL', 5, 0.2, 0.07, 4.2, { color: GL, trail: 2 }),
    S('kickR', 7, 0.26, 0.1, 4.3, { color: GL, trail: 3, kb: 2 }),
    S('spinKick', 8, 0.3, 0.13, 4.4, { color: GL, trail: 3, arc: -0.3, kb: 3, side: true }),
    S('slamR', 13, 0.42, 0.18, 4.2, { color: GL, arc: 0.0, kb: 2, slam: true, heavy: true, shock: 4 }),
  ]),
  m1Mode: 'repeat', m1Range: 4.4,
};
