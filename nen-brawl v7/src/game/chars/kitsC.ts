/** Reworked kits – part C: Zeno, Gotoh, Franklin, Kastro, Gido */
import * as THREE from 'three';
import type { CharDef } from '../defs';
import type { Fighter } from '../Fighter';
import type { Game } from '../Game';
import { sfx } from '../audio';
import { type Kit, skill, prep, cut, blast, rush, shot, fan, tele, mark, spot, gnd, rotY, rnd, clamp, V3, behind, WHITE } from './mv';
import { gy } from '../terrain';

// ============================================================ ZENO  –  Dragon (rework): lance, ride, dive
export const zeno = (old: CharDef): Kit => {
  const col = old.color;
  void old;
  const lance = (g: Game, c: Fighter, len: number, w: number, dmg: number) => {
    const A = g.aim(c); c.faceNow(A.yaw);
    const o = c.chestPos().addScaledVector(A.flat, 0.9);
    g.fx.beam(o, o.clone().addScaledVector(A.dir, len), col, w * 0.5, 0.25); g.fx.vring(o.clone().addScaledVector(A.dir, 2), A.dir, WHITE, 0.4, w * 2, 0.25); sfx('slash');
    return g.hitBeam(c, o, A.dir, len, w, dmg, { color: col, skill: true, kb: 9, heavy: true, bleed: 2 });
  };
  return {
    notes: ['Inspired by the reworked Dragon (lance beams, flight dives, map-wide downfall)', 'Dragon Dive hovers and rains dragon fragments across a 14m area', 'One Day, One Kill is a pure assassin teleport – the Shadow archetype'],
    skills: [
      skill('Z', 'Dragon Lance', 0, 6, [4, 26], 'Spear a fang of aura 22m down a lane: heavy damage and knockback. Pierces.', (g, c) => { prep(g, c, 'castFwd', 0.12, 0.4, col); g.after(0.12, c, () => lance(g, c, 22, 1.8, 34)); }),
      skill('X', 'Dragon Head', 0, 9, [3, 20], 'Ride a dragon of aura 16m straight through the enemy and detonate at the end of the run (6m).', (g, c) => { const A = prep(g, c, 'flykick', 0.12, 0.6, col); g.after(0.12, c, () => { const h = rush(g, c, A.flat, 16, 0.25, col, 22, { kb: 4 }, 5, 3.4); void h; }); g.after(0.4, c, () => blast(g, c, gnd(c.pos), 6, 22, col, { kb: 8, launch: 6, heavy: true })); }),
      skill('C', 'One Day, One Kill', 0, 9, [0, 28], 'Vanish and reappear behind the target with a lethal stab that leaves them bleeding.', (g, c) => {
        const A = g.aim(c), t = A.target ?? g.target(c, 28);
        if (!t) { g.popup(c, 'no target', '#aaa', 14); c.lock = 0.1; return; }
        c.lock = 0.5; g.fx.burst(c.chestPos(), col, 16, 8, 0.3); sfx('dash');
        tele(g, c, behind(t, 2.0)); c.faceNow(Math.atan2(t.pos.x - c.pos.x, t.pos.z - c.pos.z)); c.setAnim('jabR', 0.3);
        g.after(0.12, c, () => cut(g, c, { range: 5, half: -0.3, dmg: 44, col, bleed: 4, kb: 3, heavy: true, x: true }));
      }),
      skill('V', 'Dragon Dive', 50, 55, [0, 34], 'ULTIMATE (50 energy): hover and rain dozens of dragon fragments over a 14m area, each one detonating on impact.', (g, c) => {
        prep(g, c, 'castUp', 0.3, 2.6, col);
        const at = spot(g, c, 30);
        c.vy = 14; c.floatT = 1.8; g.fx.telegraph(gnd(at), 14, col, 0.9); g.flash('#bff4ff', 0.25);
        for (let i = 0; i < 28; i++) g.after(0.7 + i * 0.07, c, () => { const a = rnd(0, 6.28), d = Math.sqrt(Math.random()) * 13; const p = V3(at.x + Math.cos(a) * d, gy(at.x, at.z), at.z + Math.sin(a) * d); g.fx.bolt(V3(p.x, p.y + 30, p.z), p.clone().setY(p.y + 1), col, 0.12, 0.4, 2, 1.5); blast(g, c, p, 3.6, 9, col, { kb: 3 }, i % 3 === 0); });
        g.after(2.8, c, () => { c.floatT = 0; });
      }),
      skill('F', 'Dragon Soar', 0, 5, [6, 28], 'Leap on a streaking dragon up to 20m; landing shakes the ground (6m).', (g, c) => {
        const A = g.aim(c); c.faceNow(A.yaw); c.setAnim('leap', 0.5); c.lock = 0.1;
        g.after(0.06, c, () => { c.vy = 16; c.onGround = false; c.invuln = Math.max(c.invuln, 0.2); c.forced = { vx: A.flat.x * 21, vz: A.flat.z * 21, t: 1.4, T: 1.4, ease: false, land: true }; g.trail(c, 3, col, 0.8, 0.5); sfx('dash'); c.onLand = { t: 3, fn: () => { blast(g, c, gnd(c.pos), 6, 15, col, { kb: 5, stun: 0.4, heavy: true }); g.shake(0.3); c.forced = null; c.lock = 0; } }; });
      }),
    ],
  };
};

// ============================================================ GOTOH  –  Soul Guitar / Kitsune projectile gunner with Rifling stacks
export const gotoh = (old: CharDef): Kit => {
  const col = old.color;
  const coin = (g: Game, c: Fighter, dir: THREE.Vector3, dmg: number, o: object = {}, size = 0.7) => shot(g, c, { pos: c.handPos(), dir, speed: 100, r: 0.7, dmg, life: 0.6, col, size, shape: 'bullet', opts: { kb: 0.6, ...o }, onHit: () => { c.st.rifle = Math.min(5, (c.st.rifle ?? 0) + 1); c.st.rifleT = 3; } });
  return {
    notes: ['Inspired by Soul Guitar and Kitsune fox-fire: rapid projectile pressure that stacks', 'Rifling: every landed coin adds a stack (max 5, +4% damage each) – Rifled Shot cashes in the stacks', 'Which Hand? is a Counter stance – answered with a stunning volley'],
    skills: [
      skill('Z', 'Coin Gatling', 0, 4, [4, 30], 'Flick a stream of Nen-charged coins from both thumbs. HOLD to load up to 20.', (g, c, ch) => {
        const n = 6 + Math.round(ch * 14);
        prep(g, c, 'charge', 0.08, 0.2 + n * 0.045, col);
        for (let i = 0; i < n; i++) g.after(0.1 + i * 0.045, c, () => { const A = g.aim(c); c.faceNow(A.yaw); coin(g, c, rotY(A.dir, rnd(-0.04, 0.04)).add(V3(0, rnd(-0.02, 0.02), 0)), 4.6); sfx('zap'); });
      }, { charge: 0.8, chargeAnim: 'charge' }),
      skill('X', 'Rifled Shot', 0, 7, [5, 36], 'A single spinning coin that pierces everything – even guards. Damage grows with your Rifling stacks and it hits hard.', (g, c) => {
        prep(g, c, 'point', 0.2, 0.5, col);
        g.after(0.2, c, () => { const A = g.aim(c); c.faceNow(A.yaw); const s = c.st.rifle ?? 0; sfx('boom'); g.shake(0.2); shot(g, c, { pos: c.handPos(), dir: A.dir, speed: 130, r: 1.0, dmg: 34 + s * 5, life: 0.7, col, size: 1.5, shape: 'bullet', pierce: true, opts: { kb: 11, stun: 0.35, heavy: true, breakGuard: true, pierce: s >= 5 }, onHit: () => { c.st.rifle = Math.min(5, (c.st.rifle ?? 0) + 1); c.st.rifleT = 3; } }); });
      }),
      skill('C', 'Which Hand?', 0, 9, [2, 14], 'Counter stance (0.9s). The first hit is dodged and answered with a stunning volley of coins.', (g, c, ch) => old.skills[2].cast(g, c, ch)),
      skill('V', 'Full-Auto Gatling', 50, 55, [4, 30], 'ULTIMATE (50 energy): root yourself and unload forty coins from both hands, tracking the cursor.', (g, c) => {
        prep(g, c, 'charge', 0.2, 2.5, col); c.root_ = Math.max(c.root_, 2.2); g.flash('#ffe08a', 0.2);
        for (let i = 0; i < 40; i++) g.after(0.25 + i * 0.05, c, () => { const A = g.aim(c); c.faceNow(A.yaw); coin(g, c, rotY(A.dir, rnd(-0.05, 0.05)).add(V3(0, rnd(-0.03, 0.03), 0)), 6.4, { kb: 0.5 }); if (i % 4 === 0) sfx('zap'); });
      }),
      skill('F', 'Coin Step', 0, 4, [0, 14], 'Slide 9m away in a flash (brief invulnerability) while firing four coins at the enemy.', (g, c) => {
        const A = g.aim(c); c.faceNow(A.yaw);
        const d = c.moveInput.lengthSq() > 0.05 ? V3(c.moveInput.x, 0, c.moveInput.y).normalize() : A.flat.clone().negate();
        g.dashF(c, d, 9, 0.16); c.invuln = Math.max(c.invuln, 0.3); sfx('dash'); g.fx.afterimage(c.pos, c.yaw, col);
        for (let i = 0; i < 4; i++) g.after(0.04 + i * 0.07, c, () => { const A2 = g.aim(c); coin(g, c, A2.dir, 6); });
      }),
    ],
  };
};

// ============================================================ FRANKLIN  –  Mammoth / T-Rex heavy gunner
export const franklin = (old: CharDef): Kit => {
  const col = old.color;
  void old;
  const bullet = (g: Game, c: Fighter, dir: THREE.Vector3, dmg: number, from?: THREE.Vector3) => shot(g, c, { pos: from ?? c.handPos(), dir, speed: 80, r: 0.8, dmg, life: 0.7, col, size: 0.8, shape: 'bullet', opts: { kb: 1 } });
  return {
    notes: ['Inspired by Mammoth and T-Rex: slow, heavy, armoured frame with huge area control', 'Bulldoze grants super-armour; Hammer Fall is a T-Rex style ground slam', 'Severed Fingers costs 5% HP for the biggest sustained bullet storm'],
    skills: [
      skill('Z', 'Finger Pop', 0, 4, [3, 28], 'Shoot a fan of Nen bullets from your fingertips. HOLD for up to 11 bullets.', (g, c, ch) => { const n = 3 + Math.round(ch * 8); prep(g, c, 'point', 0.1, 0.35, col); g.after(0.1, c, () => { sfx('zap'); fan(g, c, n, 0.12 + n * 0.05, { speed: 82, r: 0.8, dmg: 6.5, life: 0.7, col, size: 0.8, shape: 'bullet', opts: { kb: 0.8 } }); }); }, { charge: 0.7, chargeAnim: 'chargePalm' }),
      skill('X', 'Double Machine Gun', 0, 9, [0, 14], 'Every finger is a barrel: three expanding rings of bullets spray in all directions around you.', (g, c) => { prep(g, c, 'summon', 0.1, 1.0, col); for (let w = 0; w < 3; w++) g.after(0.15 + w * 0.28, c, () => { sfx('zap'); for (let i = 0; i < 14; i++) { const a = (i / 14) * 6.28 + w * 0.2; bullet(g, c, V3(Math.cos(a), rnd(-0.03, 0.03), Math.sin(a)), 6, c.chestPos()); } }); }),
      skill('C', 'Hammer Fall', 0, 8, [4, 18], 'Leap at the enemy and crash down: a massive shockwave (8m) and a long stun.', (g, c) => {
        const A = g.aim(c); c.faceNow(A.yaw); c.setAnim('leap', 0.5); c.lock = 0.1;
        const L = clamp(A.dist, 5, 18);
        g.after(0.08, c, () => { c.vy = 18; c.onGround = false; c.invuln = Math.max(c.invuln, 0.2); c.forced = { vx: A.flat.x * L * 1.1, vz: A.flat.z * L * 1.1, t: 1.5, T: 1.5, ease: false, land: true }; sfx('dash'); c.onLand = { t: 3, fn: () => { c.setAnim('slamR', 0.3); const p = gnd(c.pos); g.fx.crack(p, col, 7, 3); g.shake(0.8); sfx('boom'); blast(g, c, p, 8, 44, col, { kb: 10, stun: 1.0, heavy: true }); c.forced = null; c.lock = 0; } }; });
      }),
      skill('V', 'Severed Fingers', 50, 60, [3, 28], 'ULTIMATE (50 energy, costs 5% HP): tear off your fingertips – the commitment fuels a 40-bullet sweep across the enemy.', (g, c) => {
        prep(g, c, 'summon', 0.3, 2.4, col); g.selfDamage(c, c.maxHp * 0.05); g.flash('#c8a0ff', 0.3);
        for (let i = 0; i < 40; i++) g.after(0.4 + i * 0.04, c, () => { const A = g.aim(c); c.faceNow(A.yaw); const sweep = (i / 39 - 0.5) * 0.9; bullet(g, c, rotY(A.dir, sweep), 6.4); if (i % 5 === 0) sfx('zap'); });
      }),
      skill('F', 'Bulldoze', 0, 6, [5, 18], 'Barrel forward 12m with super-armour, shoving everyone aside and ending in a heavy shoulder.', (g, c) => { const A = prep(g, c, 'flykick', 0.08, 0.5, col); c.stunImmune = Math.max(c.stunImmune, 0.7); g.after(0.08, c, () => rush(g, c, A.flat, 12, 0.3, col, 14, { kb: 6 }, 5, 3.4, false)); g.after(0.42, c, () => cut(g, c, { range: 5, half: 0, dmg: 18, col, kb: 9, stun: 0.5, heavy: true })); }),
    ],
  };
};

// ============================================================ KASTRO  –  Tiger / Soul Guitar shadow double
export const kastro = (old: CharDef): Kit => {
  const col = old.color;
  return {
    notes: ['Inspired by Tiger (claw rushes) and Ghost clones: a fast brawler backed by his Double', 'Double pincer: you strike from the front while the double strikes from behind', 'Gyo Counter reads the aura – a classic Counter stance'],
    skills: [
      skill('Z', 'Tiger Bite Fist', 0, 5, [3, 14], 'Close in and rake twice with Nen-hardened claws. The second rake knocks back; both bleed.', (g, c) => {
        prep(g, c, 'jabR', 0.1, 0.65, col);
        g.after(0.1, c, () => { const A = g.aim(c); c.faceNow(A.yaw); const t = A.target; g.dashF(c, A.flat, t ? clamp(Math.hypot(t.pos.x - c.pos.x, t.pos.z - c.pos.z) - 2.2, 0, 8) : 3, 0.1); });
        g.after(0.24, c, () => { c.setAnim('slashR', 0.2); cut(g, c, { range: 5, half: 0, dmg: 14, col, bleed: 3, kb: 1 }); });
        g.after(0.44, c, () => { c.setAnim('slashSide', 0.2); cut(g, c, { range: 5.2, half: 0, dmg: 24, col, bleed: 3, kb: 9, heavy: true, x: true }); });
      }),
      skill('X', 'Double', 0, 8, [4, 26], 'Project your double behind the enemy. After a beat it strikes from behind while you hit from the front.', (g, c) => {
        const A = prep(g, c, 'castFwd', 0.12, 0.8, col);
        const t = A.target ?? g.target(c, 26);
        if (!t) return;
        const bp = behind(t, 2.4); bp.y = gy(bp.x, bp.z);
        g.fx.afterimage(bp, Math.atan2(t.pos.x - bp.x, t.pos.z - bp.z), col, 0.9, 0.8);
        g.after(0.5, c, () => { g.fx.slashX(t.chestPos(), V3(t.pos.x - bp.x, 0, t.pos.z - bp.z).normalize(), col, 4, 0.3); g.damage(c, t, 26, { color: col, skill: true, kb: 3, heavy: true, dirx: t.pos.x - bp.x, dirz: t.pos.z - bp.z, bleed: 3 }); sfx('slash'); });
        g.after(0.62, c, () => { const d = Math.hypot(t.pos.x - c.pos.x, t.pos.z - c.pos.z); if (d > 3) g.dashF(c, V3((t.pos.x - c.pos.x) / d, 0, (t.pos.z - c.pos.z) / d), Math.min(9, d - 2.2), 0.1); c.faceNow(Math.atan2(t.pos.x - c.pos.x, t.pos.z - c.pos.z)); });
        g.after(0.76, c, () => { c.setAnim('slashR', 0.2); cut(g, c, { range: 5, half: -0.1, dmg: 22, col, kb: 7, stun: 0.4, heavy: true }); });
      }),
      skill('C', 'Gyo Counter', 0, 9, [2, 12], 'Read the aura (1.1s). The first hit is dodged and answered with a launching counter.', (g, c, ch) => old.skills[2].cast(g, c, ch)),
      skill('V', 'True Tiger Bite Fist', 50, 55, [3, 30], 'ULTIMATE (50 energy): rush in, pin the target and bite from both sides at once with your double. Five rakes, then a crushing finisher.', (g, c) => {
        const A = prep(g, c, 'jabR', 0.1, 2.2, col);
        const t = A.target ?? g.target(c, 30);
        if (!t) return;
        g.flash('#ffb060', 0.25);
        g.after(0.1, c, () => { const d = Math.hypot(t.pos.x - c.pos.x, t.pos.z - c.pos.z); g.dashF(c, V3((t.pos.x - c.pos.x) / d, 0, (t.pos.z - c.pos.z) / d), Math.max(0, d - 2.2), 0.14); g.stunFighter(t, 1.6, true); t.root_ = 2; });
        for (let i = 0; i < 5; i++) g.after(0.4 + i * 0.2, c, () => { if (t.dead) return; c.faceNow(Math.atan2(t.pos.x - c.pos.x, t.pos.z - c.pos.z)); c.setAnim(i % 2 ? 'slashSide' : 'slashR', 0.15); const bp = behind(t, 2); g.fx.afterimage(V3(bp.x, gy(bp.x, bp.z), bp.z), Math.atan2(t.pos.x - bp.x, t.pos.z - bp.z), col, 0.4, 0.7); cut(g, c, { range: 5, half: -0.5, dmg: 13, col, bleed: 2, kb: 0.4 }); g.damage(c, t, 9, { color: col, skill: true, noCrit: true, dirx: t.pos.x - bp.x, dirz: t.pos.z - bp.z }); });
        g.after(1.5, c, () => { c.setAnim('slamR', 0.35); g.shake(0.7); sfx('boom'); cut(g, c, { range: 6, half: -0.5, dmg: 40, col, kb: 14, launch: 9, heavy: true, x: true }); });
      }),
      skill('F', 'Phantom Step', 0, 4, [0, 20], 'Dash 10m away; your double lingers behind and slashes where you stood.', (g, c) => {
        const A = g.aim(c); c.faceNow(A.yaw);
        const d = c.moveInput.lengthSq() > 0.05 ? V3(c.moveInput.x, 0, c.moveInput.y).normalize() : A.flat.clone().negate();
        const at = gnd(c.pos);
        g.fx.afterimage(at, c.yaw, col, 0.8, 0.8); g.dashF(c, d, 10, 0.16); c.invuln = Math.max(c.invuln, 0.22); c.combo = 0; sfx('dash');
        g.later(0.5, () => { g.fx.slashX(at.clone().setY(at.y + 1.5), A.flat, col, 5, 0.3); blast(g, c, at, 4.5, 22, col, { kb: 6, bleed: 2, heavy: true }, false); });
      }),
    ],
  };
};

// ============================================================ GIDO  –  Pole V2 / Spikey Trident spinner with Tops
export const gido = (old: CharDef): Kit => {
  const col = old.color;
  void old;
  const top = (g: Game, c: Fighter, dir: THREE.Vector3, dmg: number, hom?: Fighter | null, life = 1.0) => shot(g, c, { pos: c.chestPos().add(V3(rnd(-0.5, 0.5), 0.4, rnd(-0.5, 0.5))), dir, speed: hom ? 26 : 52, r: 0.9, dmg, life, col, size: 0.9, shape: 'orb', homing: hom ? { target: hom, rate: 2.2 } : undefined, opts: { kb: 1.2 } });
  const spin = (g: Game, c: Fighter, t: number, dps: number) => {
    c.stunImmune = Math.max(c.stunImmune, t);
    c.speedMult = 1.28; g.later(t, () => { if (c.speedMult === 1.28) c.speedMult = 1; });
    for (let i = 0; i < Math.round(t / 0.35); i++) g.after(i * 0.35, c, () => { g.fx.ring(gnd(c.pos), col, 1, 6.5, 0.3); g.hitSphere(c.chestPos(), 6.5, c, dps, { color: col, skill: true, kb: 3.5, heavy: false }); c.faceNow(c.yaw + 1.6); c.setAnim('spin', 0.3); sfx('slash'); });
  };
  return {
    notes: ['Inspired by Pole V2 and Spikey Trident: spinning, wide hitboxes and constant pressure', 'Tornado Top gives stun immunity and cuts everything near you', 'Battle Waltz sends a ring of homing tops after the target'],
    skills: [
      skill('Z', 'Battle Waltz', 0, 9, [4, 30], 'Hurl a ring of eight tops that hunts the enemy for 3.6s, battering anything near them from every side.', (g, c) => { prep(g, c, 'summon', 0.15, 0.5, col); g.after(0.15, c, () => { const A = g.aim(c); for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; top(g, c, V3(Math.cos(a), 0.05, Math.sin(a)), 8, A.target ?? g.target(c, 40), 3.6); } sfx('swing'); }); }),
      skill('X', 'Shotgun Blues', 0, 5, [3, 20], 'Fire a spread of seven spinning tops. Devastating up close.', (g, c) => { prep(g, c, 'castFwd', 0.1, 0.35, col); g.after(0.1, c, () => { sfx('boom'); fan(g, c, 7, 0.55, { speed: 55, r: 0.9, dmg: 9, life: 0.55, col, size: 0.9, shape: 'orb', opts: { kb: 1.5 } }); }); }),
      skill('C', 'Tornado Top', 0, 9, [0, 8], 'Spin on your peg leg for 2.8s: +28% speed, immune to stun, and everything near you is repelled and cut.', (g, c) => { prep(g, c, 'spin', 0.05, 0.3, col); spin(g, c, 2.8, 7); }),
      skill('V', 'Grand Waltz', 50, 55, [3, 30], 'ULTIMATE (50 energy): Tornado Top while twenty-six homing tops pour out at the enemy.', (g, c) => { prep(g, c, 'spin', 0.1, 0.4, col); spin(g, c, 3.2, 9); const A = g.aim(c); const t = A.target ?? g.target(c, 40); for (let i = 0; i < 26; i++) g.after(0.2 + i * 0.1, c, () => { const a = rnd(0, 6.28); top(g, c, V3(Math.cos(a), 0.1, Math.sin(a)), 8, t, 2.2); }); }),
      skill('F', 'Peg Hop', 0, 5, [5, 26], 'Vault up to 18m on your peg leg and drill into the ground on landing (5.5m).', (g, c) => {
        const A = g.aim(c); c.faceNow(A.yaw); c.setAnim('leap', 0.5); c.lock = 0.1;
        g.after(0.06, c, () => { c.vy = 17; c.onGround = false; c.invuln = Math.max(c.invuln, 0.2); c.forced = { vx: A.flat.x * 19, vz: A.flat.z * 19, t: 1.4, T: 1.4, ease: false, land: true }; sfx('dash'); c.onLand = { t: 3, fn: () => { blast(g, c, gnd(c.pos), 5.5, 20, col, { kb: 6, stun: 0.5, heavy: true }); g.shake(0.35); c.forced = null; c.lock = 0; } }; });
      }),
    ],
  };
};

export const _c = { mark };
