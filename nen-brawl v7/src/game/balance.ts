import { CHARS } from './chars';
import { applyMovesets } from './chars/movesets';
import type { PlayableKind } from './defs';
import type { Fighter } from './Fighter';

/**
 * Nen Brawl balance pass.
 *
 * Every hunter's moveset was rebuilt around a meta Blox Fruits fruit / sword (2022 → 2026 patches) while keeping the
 * Hunter x Hunter ability fantasy. Kits are written against a shared budget (damage per second of cooldown, AoE size,
 * mobility distance, stun length) and then nudged here so tanks hit a little harder and glass-cannons a little softer.
 */
export interface Rework { notes: string[] }
export const REWORKS: Partial<Record<PlayableKind, Rework>> = {};

interface Tune { hp?: number; dmg?: number; spd?: number }
const TUNE: Partial<Record<PlayableKind, Tune>> = {
  gon: { dmg: 1.0 }, killua: { hp: 20, dmg: 0.97 }, leorio: { dmg: 1.03, spd: 0.3 }, kurapika: { hp: 10, dmg: 1.0 }, hisoka: { hp: 10, dmg: 1.0 },
  morel: { dmg: 1.05, spd: 0.4 }, chrollo: { dmg: 1.0 }, netero: { dmg: 1.0 }, kite: { hp: 15, dmg: 1.0 }, knov: { hp: 20, dmg: 1.0 },
  knuckle: { dmg: 1.05, spd: 0.4 }, pitou: { hp: 30, dmg: 0.98 }, zeno: { hp: 25, dmg: 0.97 }, gotoh: { hp: 30, dmg: 1.0 }, franklin: { dmg: 1.06, spd: 0.6 },
  kastro: { hp: 10, dmg: 1.0 }, gido: { hp: 15, dmg: 1.0 },
};

let applied = false;
export function applyBalance() {
  if (applied) return;
  applied = true;
  const notes = applyMovesets();
  for (const k of Object.keys(CHARS) as PlayableKind[]) {
    const d = CHARS[k];
    if (!d) continue;
    REWORKS[k] = { notes: notes[k] ?? [] };
    const t = TUNE[k] ?? {};
    if (t.hp) d.hp += t.hp;
    if (t.spd) d.speed += t.spd;
    const ob0 = d.dmgBonus;
    const dm = t.dmg ?? 1;
    d.dmgBonus = (c: Fighter) => (ob0 ? ob0(c) : 1) * dm;
  }
  // global power-up: every hunter has more health, hits harder, is a touch faster and recovers skills quicker
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
