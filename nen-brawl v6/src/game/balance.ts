import { CHARS } from './chars';
import type { PlayableKind, DmgOpts } from './defs';
import type { Fighter } from './Fighter';
import type { Game } from './Game';

/**
 * Blox-Fruits-style rebalance. Nothing is nerfed – the weaker hunters get stronger so each of them
 * can stand next to the "meta fruits" (Dough / Leopard / Buddha / Portal): more health, more damage,
 * snappier cooldowns and a signature "awakening" perk.
 *
 *  od     – Overdrive: every N landed hits the hunter surges (+damage, +speed) for a few seconds
 *  aegis  – Aegis: casting a skill grants a small shield (internal cooldown)
 *  siphon – Siphon: heals a % of the damage dealt (Blox "vampire / ghoul" style sustain)
 */
export interface Rework {
  hp?: number;
  speed?: number;
  dmg?: number;
  cd?: number;
  cost?: number;
  od?: { every: number; t: number; dmg: number; spd: number; name: string };
  aegis?: { amt: number; cd: number };
  siphon?: number;
  notes: string[];
}

export const REWORKS: Partial<Record<PlayableKind, Rework>> = {
  gotoh: { hp: 55, speed: 0.4, dmg: 1.22, cd: 0.85, od: { every: 8, t: 3.5, dmg: 0.3, spd: 0.1, name: 'Rifling Overdrive' }, aegis: { amt: 35, cd: 7 }, siphon: 0.04,
    notes: ['+55 HP, +0.4 speed, +22% damage, skills 15% faster', 'Rifling Overdrive: every 8 hits = 3.5s of +30% damage & speed', 'Casting a skill grants a 35 shield (7s)'] },
  gido: { hp: 60, speed: 0.3, dmg: 1.2, cd: 0.88, od: { every: 7, t: 4, dmg: 0.28, spd: 0.12, name: 'Heavens Fury' }, siphon: 0.05,
    notes: ['+60 HP, +0.3 speed, +20% damage, skills 12% faster', 'Heavens Fury: every 7 hits = 4s of +28% damage & +12% speed', '5% siphon – heals from the damage dealt'] },
  kastro: { hp: 45, dmg: 1.18, cd: 0.88, od: { every: 6, t: 4, dmg: 0.25, spd: 0.08, name: 'Double Edge' }, aegis: { amt: 30, cd: 6 },
    notes: ['+45 HP, +18% damage, skills 12% faster', 'Double Edge: every 6 hits = 4s of +25% damage', 'Casting a skill grants a 30 shield (6s)'] },
  knov: { hp: 70, speed: 0.2, dmg: 1.25, cd: 0.82, aegis: { amt: 45, cd: 6 }, siphon: 0.03,
    notes: ['+70 HP, +25% damage, skills 18% faster – a real portal-meta kit', 'Casting a skill grants a 45 shield (6s)', '3% siphon'] },
  kite: { hp: 55, dmg: 1.2, cd: 0.86, od: { every: 8, t: 4, dmg: 0.28, spd: 0.1, name: 'Hot Streak' }, siphon: 0.04,
    notes: ['+55 HP, +20% damage, skills 14% faster', 'Hot Streak: every 8 hits = 4s of +28% damage & speed', '4% siphon'] },
  morel: { speed: 0.6, dmg: 1.25, cd: 0.85, aegis: { amt: 40, cd: 7 }, siphon: 0.06,
    notes: ['+0.6 speed, +25% damage, skills 15% faster', 'Smoke saps life: 6% siphon', 'Casting a skill grants a 40 shield (7s)'] },
  kurapika: { hp: 50, dmg: 1.15, cd: 0.88, od: { every: 9, t: 4, dmg: 0.25, spd: 0.1, name: 'Chain Frenzy' }, aegis: { amt: 30, cd: 7 },
    notes: ['+50 HP, +15% damage, skills 12% faster', 'Chain Frenzy: every 9 hits = 4s of +25% damage', 'Casting a skill grants a 30 shield (7s)'] },
  pitou: { hp: 70, dmg: 1.12, cd: 0.9, aegis: { amt: 40, cd: 7 }, siphon: 0.05,
    notes: ['+70 HP, +12% damage, skills 10% faster', '5% siphon on top of Doctor Blythe', 'Casting a skill grants a 40 shield (7s)'] },
  franklin: { speed: 0.9, dmg: 1.12, cd: 0.9, od: { every: 10, t: 4, dmg: 0.25, spd: 0.15, name: 'Unflinching Rage' },
    notes: ['+0.9 speed (no longer slow), +12% damage, skills 10% faster', 'Unflinching Rage: every 10 hits = 4s of +25% damage & +15% speed'] },
  leorio: { hp: 30, speed: 0.5, dmg: 1.15, cd: 0.9, siphon: 0.05,
    notes: ['+30 HP, +0.5 speed, +15% damage, skills 10% faster', "Medic's siphon: heals 5% of damage dealt"] },
  chrollo: { dmg: 1.08, cd: 0.94, aegis: { amt: 25, cd: 8 }, notes: ['+8% damage, skills 6% faster', 'Casting a skill grants a 25 shield (8s)'] },
};

let applied = false;

export function applyBalance() {
  if (applied) return;
  applied = true;
  for (const k of Object.keys(REWORKS) as PlayableKind[]) {
    const r = REWORKS[k]!;
    const d = CHARS[k];
    if (!d) continue;
    if (r.hp) d.hp += r.hp;
    if (r.speed) d.speed += r.speed;
    for (const list of [d.skills, d.formSkills ?? []]) {
      for (const s of list) {
        if (r.cd) s.cd = Math.round(s.cd * r.cd * 10) / 10;
        if (r.cost && s.cost) s.cost = Math.round(s.cost * r.cost);
      }
    }
    const oldBonus = d.dmgBonus;
    const dm = r.dmg ?? 1;
    d.dmgBonus = (c: Fighter) => (oldBonus ? oldBonus(c) : 1) * dm * ((c.st.odT ?? 0) > 0 && r.od ? 1 + r.od.dmg : 1);

    const oldDealt = d.onDealt;
    d.onDealt = (g: Game, att: Fighter, vic: Fighter, amt: number, o: DmgOpts) => {
      oldDealt?.(g, att, vic, amt, o);
      if (o.dot || att === vic) return;
      if (r.od) {
        att.st.odN = (att.st.odN ?? 0) + 1;
        if (att.st.odN >= r.od.every) {
          att.st.odN = 0;
          att.st.odT = r.od.t;
          if (att.isPlayer) g.popup(att, r.od.name.toUpperCase() + '!', '#ffe066', 22);
        }
      }
      if (r.siphon) g.heal(att, amt * r.siphon, true);
    };

    const oldUpdate = d.update;
    d.update = (g: Game, c: Fighter, dt: number) => {
      oldUpdate?.(g, c, dt);
      if (r.od) {
        if ((c.st.odT ?? 0) > 0) {
          if (!c.st.odSp) { c.speedMult *= 1 + r.od.spd; c.st.odSp = 1; }
          c.st.auraT = Math.max(c.st.auraT ?? 0, 0.25);
        } else if (c.st.odSp) {
          const m = c.speedMult / (1 + r.od.spd);
          c.speedMult = m < 1 && c.speedMult >= 1 ? 1 : m;
          c.st.odSp = 0;
        }
      }
      if (r.aegis && c.lastSkill && c.lastSkill.t !== (c.st.aegSeen ?? -1)) {
        c.st.aegSeen = c.lastSkill.t;
        if ((c.st.aegCdT ?? 0) <= 0) {
          c.st.aegCdT = r.aegis.cd;
          g.addShield(c, r.aegis.amt);
        }
      }
    };
  }
  // global power-up: every hunter is a lot stronger (more health, harder hitting, a touch faster, quicker skills)
  for (const k of Object.keys(CHARS) as PlayableKind[]) {
    const d = CHARS[k];
    if (!d || (d as unknown as { _pw?: boolean })._pw) continue;
    (d as unknown as { _pw?: boolean })._pw = true;
    d.hp = Math.round(d.hp * 1.45);
    d.speed += 0.6;
    const ob = d.dmgBonus;
    d.dmgBonus = (c: Fighter) => (ob ? ob(c) : 1) * 1.25;
    for (const list of [d.skills, d.formSkills ?? []]) for (const sk of list) sk.cd = Math.round(sk.cd * 0.92 * 10) / 10;
  }
}
