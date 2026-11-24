import * as THREE from 'three';
import type { Game } from './Game';
import type { Fighter } from './Fighter';
import { sfx } from './audio';

export interface SkillDef {
  key: string;
  name: string;
  desc: string;
  cost: number;
  cd: number;
  /** [min,max] distance where the AI considers using this skill */
  ai: [number, number];
  cast: (g: Game, c: Fighter) => void;
}

const CY = 0x8fe3ff;
const YEL = 0xfff27a;
const OR = 0xffa733;
const GRN = 0x8dff6a;
const GOLD = 0xffd23f;

const Y = new THREE.Vector3(0, 1, 0);

export const KILLUA_SKILLS: SkillDef[] = [
  {
    key: 'Z',
    name: 'Lightning Palm',
    desc: 'Discharge a bolt of Nen lightning from your palm. Stuns.',
    cost: 15,
    cd: 4,
    ai: [4, 28],
    cast(g, c) {
      g.faceAim(c);
      c.lock = 0.5;
      c.setAnim('cast', 0.5);
      sfx('charge');
      g.fxBurst(c.handPos(), CY, 10, 6, 0.25);
      g.after(0.25, c, () => {
        const d = g.faceAim(c);
        const p = c.chestPos().addScaledVector(d, 1.4);
        sfx('zap');
        g.shoot({
          owner: c, pos: p, dir: d, speed: 36, radius: 1.2, dmg: 24, life: 1.0,
          color: CY, size: 0.7, shape: 'orb', opts: { stun: 0.45, kb: 5, color: CY },
        });
        g.shake(0.15);
      });
    },
  },
  {
    key: 'X',
    name: 'Rhythm Echo',
    desc: 'Vanish in afterimages, reappear behind the enemy and unleash a 3-hit combo.',
    cost: 20,
    cd: 7,
    ai: [4, 24],
    cast(g, c) {
      g.faceAim(c);
      c.lock = 1.0;
      c.invuln = Math.max(c.invuln, 0.3);
      c.setAnim('cast', 0.3);
      sfx('dash');
      g.fxAfterimage(c.pos, c.yaw, CY);
      g.after(0.18, c, () => {
        const t = g.target(c);
        g.fxAfterimage(c.pos, c.yaw, CY);
        g.fxBurst(c.chestPos(), CY, 14, 8, 0.3);
        if (t) {
          const dx = t.pos.x - c.pos.x;
          const dz = t.pos.z - c.pos.z;
          const l = Math.hypot(dx, dz) || 1;
          c.pos.x = t.pos.x + (dx / l) * 2.1;
          c.pos.z = t.pos.z + (dz / l) * 2.1;
        } else {
          c.pos.addScaledVector(c.forward(), 10);
        }
        g.clampPos(c.pos);
        g.faceAim(c);
        c.invuln = Math.max(c.invuln, 0.12);
        g.fxBurst(c.chestPos(), YEL, 14, 8, 0.3);
        sfx('zap');
      });
      const dmg = [10, 10, 18];
      [0.36, 0.52, 0.68].forEach((tm, i) =>
        g.after(tm, c, () => {
          g.faceAim(c);
          c.setAnim(i === 2 ? 'spinkick' : i % 2 ? 'punchL' : 'punchR', 0.2);
          sfx('swing');
          const f = c.forward();
          const p = c.chestPos().addScaledVector(f, 2);
          g.fxBurst(p, YEL, 8, 6, 0.2);
          g.hitArc(c, 4.4, 0.0, dmg[i], { stun: i === 2 ? 0.5 : 0, kb: i === 2 ? 8 : 0.5, color: CY, heavy: i === 2 });
        })
      );
    },
  },
  {
    key: 'C',
    name: 'Yo-Yo Barrage',
    desc: 'Hurl three spinning Zoldyck yo-yos in a fan.',
    cost: 25,
    cd: 8,
    ai: [3, 18],
    cast(g, c) {
      g.faceAim(c);
      c.lock = 0.6;
      c.setAnim('throw', 0.5);
      sfx('swing');
      [-0.3, 0, 0.3].forEach((ang, i) =>
        g.after(0.2 + i * 0.1, c, () => {
          const d = g.faceAim(c).applyAxisAngle(Y, ang);
          const p = c.chestPos().addScaledVector(d, 1.2);
          sfx('swing');
          g.shoot({
            owner: c, pos: p, dir: d, speed: 30, radius: 0.9, dmg: 13, life: 0.85,
            color: 0xf2d36b, size: 0.45, shape: 'yoyo', opts: { kb: 2, color: 0xf2d36b },
          });
        })
      );
    },
  },
  {
    key: 'V',
    name: 'Whirlwind Kick',
    desc: 'Rocket forward in a lightning-charged spinning kick that hits all around you.',
    cost: 25,
    cd: 9,
    ai: [0, 9],
    cast(g, c) {
      const d = g.faceAim(c);
      c.lock = 0.95;
      c.floatT = 0.9;
      c.vy = 7;
      c.onGround = false;
      c.setAnim('spin', 0.9, 4);
      c.invuln = Math.max(c.invuln, 0.1);
      sfx('dash');
      g.dashF(c, d, 5.5, 0.8);
      for (let i = 0; i < 5; i++) {
        g.after(0.12 + i * 0.16, c, () => {
          const last = i === 4;
          g.fxRing(c.pos, CY, 1.5, 6.2, 0.28);
          g.fxBurst(c.chestPos(), YEL, 8, 7, 0.25);
          sfx('swing');
          g.hitCircle(c.pos, 5.4, c, last ? 14 : 8, { kb: last ? 10 : 0, stun: last ? 0.5 : 0, color: CY, heavy: last });
        });
      }
    },
  },
  {
    key: 'F',
    name: 'Godspeed: Narukami',
    desc: 'ULTIMATE: Become lightning. +50% speed, +30% damage for 6s and call down a thunderbolt.',
    cost: 50,
    cd: 18,
    ai: [0, 26],
    cast(g, c) {
      g.faceAim(c);
      c.lock = 0.55;
      c.invuln = Math.max(c.invuln, 0.55);
      c.setAnim('cast', 0.55);
      c.buffT = 6;
      c.buffColor = CY;
      c.speedMult = 1.5;
      c.buffDmg = 1.3;
      c.dashCd = 0;
      sfx('zap');
      g.fxPillar(c.pos, CY, 2.2, 14, 0.6);
      g.fxRing(c.pos, YEL, 1, 7, 0.5);
      g.shake(0.25);
      const t = g.target(c);
      const spot = t ? t.pos.clone() : c.pos.clone().addScaledVector(c.forward(), 7);
      spot.y = 0;
      g.fxTelegraph(spot, 6, CY, 0.85);
      g.after(0.85, c, () => {
        sfx('boom');
        g.flash('#bfeaff', 0.55);
        g.fxBolt(new THREE.Vector3(spot.x + 2, 45, spot.z), spot, 0xffffff, 0.35, 0.7);
        g.fxBolt(new THREE.Vector3(spot.x - 1, 45, spot.z + 1), spot, CY, 0.35, 0.5);
        g.fxPillar(spot, CY, 4, 40, 0.4);
        g.fxRing(spot, 0xffffff, 1, 8, 0.4);
        g.fxBurst(spot, YEL, 30, 14, 0.5);
        g.shake(0.7);
        g.hitCircle(spot, 6, c, 36, { stun: 0.7, kb: 8, color: CY, heavy: true });
      });
    },
  },
];

export const GON_SKILLS: SkillDef[] = [
  {
    key: 'Z',
    name: 'Jajanken: Rock',
    desc: 'Charge your fist, then dash in with a devastating Guu punch.',
    cost: 20,
    cd: 6,
    ai: [2, 10],
    cast(g, c) {
      const d0 = g.faceAim(c);
      c.lock = 1.0;
      c.setAnim('charge', 0.55);
      c.boostT = 0.95;
      c.boostColor = OR;
      sfx('charge');
      g.fxTelegraph(c.pos.clone().addScaledVector(d0, 4.5), 4, OR, 0.55);
      g.after(0.3, c, () => g.fxBurst(c.handPos(), OR, 12, 5, 0.3));
      g.after(0.55, c, () => {
        const d = g.faceAim(c);
        c.setAnim('punchR', 0.3);
        g.dashF(c, d, 3.4, 0.16);
        sfx('swing');
      });
      g.after(0.68, c, () => {
        g.faceAim(c);
        const f = c.forward();
        const p = c.pos.clone().addScaledVector(f, 3.5);
        g.fxRing(p, OR, 0.8, 5, 0.3);
        g.fxBurst(c.chestPos().addScaledVector(f, 2.2), OR, 18, 9, 0.4);
        g.shake(0.3);
        g.hitArc(c, 4.8, 0.2, 40, { stun: 0.7, kb: 11, color: OR, heavy: true });
      });
    },
  },
  {
    key: 'X',
    name: 'Jajanken: Paper',
    desc: 'Release a wide wave of Nen aura that pierces through enemies.',
    cost: 15,
    cd: 4,
    ai: [5, 26],
    cast(g, c) {
      g.faceAim(c);
      c.lock = 0.45;
      c.setAnim('cast', 0.45);
      sfx('charge');
      c.boostT = 0.45;
      c.boostColor = GRN;
      g.after(0.22, c, () => {
        const d = g.faceAim(c);
        const p = c.chestPos().addScaledVector(d, 1.5);
        sfx('boom');
        g.shoot({
          owner: c, pos: p, dir: d, speed: 27, radius: 1.7, dmg: 22, life: 1.1,
          color: GRN, size: 1.1, shape: 'wave', pierce: true, opts: { stun: 0.35, kb: 6, color: GRN },
        });
        g.shake(0.2);
      });
    },
  },
  {
    key: 'C',
    name: 'Jajanken: Scissors',
    desc: 'Dash forward with a rapid double cross-slash.',
    cost: 20,
    cd: 7,
    ai: [2, 11],
    cast(g, c) {
      g.faceAim(c);
      c.lock = 0.65;
      sfx('charge');
      [0.15, 0.36].forEach((tm, i) =>
        g.after(tm, c, () => {
          const d = g.faceAim(c);
          c.setAnim('slash', 0.25);
          g.dashF(c, d, 3.2, 0.14);
          sfx('swing');
          g.fxSlash(c.pos, c.yaw, i ? GRN : 0xffffff);
          g.after(0.07, c, () => {
            g.hitArc(c, 5.4, 0.1, i ? 18 : 14, { kb: i ? 6 : 1.5, stun: i ? 0.45 : 0, color: GRN, heavy: !!i });
          });
        })
      );
    },
  },
  {
    key: 'V',
    name: 'Fishing Rod',
    desc: "Cast Ging's fishing rod, yank the enemy to you and follow up with a punch.",
    cost: 20,
    cd: 9,
    ai: [6, 22],
    cast(g, c) {
      g.faceAim(c);
      c.lock = 0.6;
      c.setAnim('throw', 0.45);
      sfx('swing');
      g.after(0.2, c, () => {
        const d = g.faceAim(c);
        const p = c.chestPos().addScaledVector(d, 1.2);
        g.shoot({
          owner: c, pos: p, dir: d, speed: 46, radius: 1.0, dmg: 10, life: 0.55,
          color: 0xdddddd, size: 0.3, shape: 'hook',
          opts: {
            stun: 0.8,
            color: 0xdddddd,
            onHit: (v: Fighter) => {
              const dx = c.pos.x - v.pos.x;
              const dz = c.pos.z - v.pos.z;
              const dist = Math.hypot(dx, dz) || 1;
              const travel = Math.max(0, dist - 2.6);
              if (travel > 0.2) g.knock(v, dx / dist, dz / dist, travel, 0.3);
              g.fxTether(c, v, 0xeeeeee, 0.45);
              c.lock = Math.max(c.lock, 0.7);
              g.after(0.42, c, () => {
                if (v.dead) return;
                g.faceAim(c);
                c.setAnim('punchR', 0.25);
                sfx('swing');
                g.hitArc(c, 4.6, 0.0, 20, { stun: 0.5, kb: 6, color: OR, heavy: true });
              });
            },
          },
        });
      });
    },
  },
  {
    key: 'F',
    name: 'Giant Rock: Ultimate Jajanken',
    desc: 'ULTIMATE: Pour all your Nen into a colossal fist that crushes a huge area.',
    cost: 50,
    cd: 20,
    ai: [0, 12],
    cast(g, c) {
      const d = g.faceAim(c);
      const t = g.target(c);
      const dist = t ? Math.hypot(t.pos.x - c.pos.x, t.pos.z - c.pos.z) : 8;
      const center = c.pos.clone().addScaledVector(d, Math.min(dist, 9));
      g.clampPos(center);
      center.y = 0;
      c.lock = 1.75;
      c.setAnim('slam', 1.5);
      c.boostT = 1.6;
      c.boostColor = GOLD;
      sfx('charge');
      g.fxTelegraph(center, 7.5, GOLD, 1.2);
      [0.3, 0.6, 0.9].forEach((tm) => g.after(tm, c, () => g.fxBurst(c.chestPos(), GOLD, 14, 7, 0.4)));
      g.after(1.08, c, () => g.fxGiantFist(center, GOLD));
      g.after(1.2, c, () => {
        sfx('boom');
        g.flash('#ffe9a0', 0.5);
        g.fxRing(center, GOLD, 1, 10, 0.5);
        g.fxRing(center, 0xffffff, 1, 7, 0.35);
        g.fxBurst(center, GOLD, 40, 16, 0.6);
        g.shake(0.95);
        g.hitCircle(center, 7.5, c, 62, { stun: 1.0, kb: 14, color: GOLD, heavy: true });
      });
    },
  },
];

export const SKILLS = { killua: KILLUA_SKILLS, gon: GON_SKILLS } as const;
