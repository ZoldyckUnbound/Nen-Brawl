import * as THREE from 'three';
import type { CharDef, SkillDef } from '../defs';
import type { Game } from '../Game';
import type { Fighter } from '../Fighter';
import { sfx } from '../audio';
import { begin, grnd, m1, S, rnd, rot } from './kit';

const PU = 0xb878ff;

function bullet(g: Game, c: Fighter, dir: THREE.Vector3, dmg: number, speed = 82, size = 0.55, left = false, life = 0.6) {
  const flat = new THREE.Vector3(dir.x, 0, dir.z).normalize();
  const o = (left ? c.handLPos() : c.handPos()).addScaledVector(flat, 0.6);
  g.shoot({
    owner: c, pos: o, dir: dir.clone().normalize(), speed, radius: 0.9, dmg, life, color: PU, size, shape: 'bullet',
    opts: { color: PU, kb: 0.8, skill: true, noCrit: true }, onHit: (_v, p) => g.fx.hitSpark(p, PU, 0.9),
  });
  g.fx.sparks(o, PU, 2, 5);
}

/** Z — Finger Pop: a fan of nen bullets. Hold for more. */
function pop(g: Game, c: Fighter, ch: number) {
  begin(g, c, 'castFwd', 0.4, 0.45);
  sfx('zap');
  g.after(0.12, c, () => {
    const a = g.aim(c);
    c.faceNow(a.yaw);
    const n = 5 + Math.floor(ch * 6);
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : (i / (n - 1) - 0.5) * 0.5;
      bullet(g, c, rot(a.dir, off), 6, 85, 0.6, i % 2 === 1);
    }
    g.fx.flashAt(c.handPos(), PU, 1.4, 0.15);
    sfx('card');
  });
}

/** X — Ten Guns: every finger a barrel — three expanding rings of bullets */
function tenGuns(g: Game, c: Fighter) {
  c.lock = 1.0;
  c.castId++;
  c.setAnim('castFwd', 0.4);
  sfx('charge');
  g.popup(c, 'DOUBLE MACHINE GUN', '#c89aff', 22);
  g.fx.gather(c.chestPos(), PU, 2.0, 8);
  for (let v = 0; v < 3; v++) {
    g.after(0.25 + v * 0.22, c, () => {
      c.setAnim(v % 2 ? 'castR' : 'castFwd', 0.25);
      const n = 12;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + v * 0.26;
        const d = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
        bullet(g, c, d, 5.6, 62, 0.55, i % 2 === 1, 0.5);
      }
      g.fx.shockwave(grnd(c.pos), PU, 5, 0.35);
      sfx('heavy');
      g.shake(0.2);
    });
  }
}

/** C — Hammer Fall: a huge leap-and-slam */
function slam(g: Game, c: Fighter) {
  const A = begin(g, c, 'leap', 0.5, 0.3);
  sfx('dash');
  const t = A.target ?? g.target(c, 18);
  const d = t ? new THREE.Vector3(t.pos.x - c.pos.x, 0, t.pos.z - c.pos.z) : A.flat.clone().multiplyScalar(9);
  const L = Math.min(13, d.length());
  d.normalize();
  c.vy = 20;
  c.onGround = false;
  c.coyote = 0;
  g.dashF(c, d, L, 0.42);
  c.invuln = Math.max(c.invuln, 0.2);
  g.after(0.4, c, () => {
    c.setAnim('slamR', 0.4);
    c.vy = -46;
    c.floatT = 0;
    c.onLand = {
      t: 1.5,
      fn: () => {
        const p = grnd(c.pos);
        g.fx.shockwave(p, PU, 8, 0.5);
        g.fx.crack(p, PU, 6, 3);
        g.fx.debris(p, 16, 9);
        g.fx.explosion(p.clone().setY(1), PU, 3.4, 0.4);
        g.shake(0.6);
        sfx('boom');
        const hits = g.hitSphere(p, 6.6, c, 27, { kb: 9, stun: 0.6, heavy: true, color: PU, skill: true });
        hits.forEach((v) => g.fx.impact(v.chestPos(), PU, 2));
      },
    };
  });
}

/** V — Severed Fingers: tear off the fingertips for far stronger bullets, then sweep the room */
function sever(g: Game, c: Fighter) {
  const A = g.aim(c);
  const t = A.target ?? g.target(c, 40);
  const yaw0 = t ? Math.atan2(t.pos.x - c.pos.x, t.pos.z - c.pos.z) : A.yaw;
  c.faceNow(yaw0);
  c.lock = 2.7;
  c.castId++;
  c.setAnim('castFwd', 0.4);
  sfx('charge');
  g.popup(c, 'FINGERS SEVERED!', '#e0b0ff', 26);
  g.flash('#b878ff', 0.3);
  g.fx.burst(c.handPos(), 0xc01a1a, 10, 6, 0.4);
  g.fx.burst(c.handLPos(), 0xc01a1a, 10, 6, 0.4);
  g.selfDamage(c, Math.round(c.maxHp * 0.05)); // the commitment that powers the bullets
  g.fx.gather(c.chestPos(), PU, 2.6, 10);
  const n = 40;
  const arc = 1.0;
  for (let i = 0; i < n; i++) {
    g.after(0.5 + i * 0.05, c, () => {
      const k = i / (n - 1);
      const yaw = yaw0 + (k - 0.5) * arc * (i % 2 ? 1 : 1);
      c.faceNow(yaw);
      if (i % 10 === 0) c.setAnim('castFwd', 0.5);
      bullet(g, c, new THREE.Vector3(Math.sin(yaw), (A.dir.y > -0.3 ? A.dir.y * 0.4 : 0), Math.cos(yaw)), 4.8, 95, 0.9, i % 2 === 1, 0.7);
      if (i % 3 === 0) sfx('card');
      if (i % 6 === 0) { sfx('heavy'); g.shake(0.1); }
    });
  }
}

/** F — Bulldoze: shoulder through everything with super-armor */
function bulldoze(g: Game, c: Fighter) {
  const A = begin(g, c, 'flyKick', 0.4, 0.4);
  sfx('dash');
  c.stunImmune = Math.max(c.stunImmune, 0.6);
  g.dashF(c, A.flat, 15, 0.26);
  g.trail(c, 3, PU, 0.4, 0.8);
  g.trail(c, 1, PU, 0.4, 0.6);
  g.fx.speedLines(c.chestPos(), A.flat, PU, 10, 6, 0.3);
  for (let k = 0; k < 4; k++) g.after(0.03 + k * 0.06, c, () => g.hitArc(c, 4.4, -0.3, 5, { kb: 6, stun: 0.12, color: PU, skill: true, noCrit: true }));
  g.after(0.3, c, () => {
    const hits = g.hitArc(c, 5, -0.2, 11, { kb: 9, stun: 0.45, heavy: true, color: PU, skill: true });
    g.fx.shockwave(grnd(c.pos), PU, 4.5, 0.35);
    sfx('heavy');
    hits.forEach((v) => g.fx.impact(v.chestPos(), PU, 1.6));
  });
}

const SKILLS: SkillDef[] = [
  { key: 'Z', name: 'Finger Pop', cost: 0, cd: 4, charge: 0.7, chargeAnim: 'chargePalm', ai: [3, 26], desc: 'Shoot a fan of Nen bullets from your fingertips. HOLD for up to 11 bullets.', cast: (g, c, ch) => pop(g, c, ch) },
  { key: 'X', name: 'Double Machine Gun', cost: 0, cd: 9, ai: [0, 12], desc: 'Every finger is a barrel: three expanding rings of bullets spray in all directions around you.', cast: (g, c) => tenGuns(g, c) },
  { key: 'C', name: 'Hammer Fall', cost: 0, cd: 8, ai: [4, 16], desc: 'Leap at the enemy and crash down: massive shockwave, long stun.', cast: (g, c) => slam(g, c) },
  { key: 'V', name: 'Severed Fingers', cost: 50, cd: 60, ai: [3, 26], desc: 'ULTIMATE (50 energy, costs 5% HP): tear off your fingertips — the commitment fuels a heavy 40-bullet sweep across the enemy.', cast: (g, c) => sever(g, c) },
  { key: 'F', name: 'Bulldoze', cost: 0, cd: 6, ai: [5, 18], desc: 'Barrel forward with super-armor, shoving everyone aside and ending in a heavy shoulder.', cast: (g, c) => bulldoze(g, c) },
];

export const FRANKLIN: CharDef = {
  kind: 'franklin', name: 'Franklin', title: 'FRANKLIN', typ: 'Emission · Phantom Troupe #7', color: PU, css: '#b878ff', hp: 485, speed: 9.7,
  blurb: 'The hulking Troupe member who treats his hands as machine guns. The slowest and toughest fighter — spray, stomp and shrug off hits.',
  meter: { name: 'RESOLVE', color: '#b878ff', start: 0, max: 100 },
  passive: { name: 'Unflinching', desc: 'Taking damage builds Resolve. At full you become unflinching for 5s: take 25% less damage and cannot be stunned. Heavy frame: reduced knockback.' },
  gainHit: 0.2, gainHurt: 0.7,
  skills: SKILLS,
  onSpawn(_g, c) {
    c.st.heavyKB = 1;
  },
  update(g, c, dt) {
    if (c.meter >= 99 && (c.st.resolveT ?? 0) <= 0) {
      c.meter = 0;
      c.st.resolveT = 5;
      g.popup(c, 'UNFLINCHING', '#d8b0ff', 22);
      g.fx.pillar(grnd(c.pos), PU, 1.8, 10, 0.5);
    }
    if ((c.st.resolveT ?? 0) > 0) {
      c.dmgTaken = 0.75;
      c.stunImmune = Math.max(c.stunImmune, 0.12);
      if (Math.random() < dt * 10) g.fx.aura(c.pos, PU, 1, 3.6, 1.0);
    } else if (c.dmgTaken === 0.75) c.dmgTaken = 1;
  },
  m1: m1(0.65, 0.85, [
    S('hookR', 10, 0.33, 0.13, 4.2, { color: PU, trail: 1, kb: 2 }),
    S('hookL', 10, 0.33, 0.13, 4.2, { color: PU, trail: 2, kb: 2 }),
    S('bodyR', 11, 0.34, 0.13, 4.0, { color: PU, trail: 1, kb: 2.5 }),
    S('upperL', 12, 0.36, 0.14, 4.0, { color: PU, trail: 2, launch: 6, kb: 1, hop: 4 }),
    S('slamR', 21, 0.5, 0.2, 4.7, { color: PU, trail: 1, arc: -0.1, kb: 9, heavy: true, shock: 3.6, lunge: 2.4 }),
  ]),
  m1Air: m1(0.65, 0.85, [
    S('hookR', 9, 0.3, 0.12, 4.0, { color: PU, trail: 1 }),
    S('hookL', 9, 0.3, 0.12, 4.0, { color: PU, trail: 2 }),
    S('kickR', 10, 0.3, 0.12, 4.2, { color: PU, trail: 3, kb: 2 }),
    S('spinKick', 11, 0.34, 0.15, 4.4, { color: PU, trail: 3, arc: -0.3, kb: 3.5, side: true }),
    S('slamL', 16, 0.45, 0.2, 4.3, { color: PU, arc: 0.0, kb: 2, slam: true, heavy: true, shock: 4.6 }),
  ]),
  m1Mode: 'repeat', m1Range: 4.2,
};
void rnd;
