/** Applies every reworked kit to the character definitions (skills, passives, counter stances, meter tuning). */
import { CHARS } from './index';
import { ALL_KINDS, type CharDef, type PlayableKind } from '../defs';
import type { Fighter } from '../Fighter';
import { type Kit, counterFns, empMult, gnd } from './mv';
import { gon, killua, leorio, kurapika, hisoka, morel } from './kitsA';
import { chrollo, netero, kite, knov, knuckle, pitou } from './kitsB';
import { zeno, gotoh, franklin, kastro, gido } from './kitsC';
import { sfx } from '../audio';

const FACTORY: Record<PlayableKind, (old: CharDef) => Kit> = { gon, killua, leorio, kurapika, hisoka, morel, chrollo, netero, kite, knov, knuckle, pitou, zeno, gotoh, franklin, kastro, gido };

const PASSIVE: Partial<Record<PlayableKind, string>> = {
  gon: 'HUNT: every hit stacks Hunt on the target (max 5); at 5 stacks your next skill is a HUNT EXECUTION (+40%). Nen builds 3× slower: 60+ Nen powers up Jajanken (spends 20); a FULL meter unlocks Adult Gon (55 energy).',
};

let applied = false;
export function applyMovesets(): Partial<Record<PlayableKind, string[]>> {
  const notes: Partial<Record<PlayableKind, string[]>> = {};
  if (applied) return notes;
  applied = true;
  for (const k of ALL_KINDS) {
    const d = CHARS[k];
    const old: CharDef = { ...d, skills: [...d.skills], formSkills: d.formSkills ? [...d.formSkills] : undefined };
    const kit = FACTORY[k](old);
    d.skills = kit.skills;
    if (kit.form) d.formSkills = kit.form;
    if (kit.gain) { d.gainHit *= kit.gain; d.gainHurt *= kit.gain; }
    if (PASSIVE[k]) d.passive = { name: d.passive.name, desc: PASSIVE[k]! };
    notes[k] = kit.notes;

    const oD = d.onDealt;
    d.onDealt = (g, a, v, amt, o) => { oD?.(g, a, v, amt, o); kit.onDealt?.(g, a, v, amt, o); };
    const oU = d.update;
    d.update = (g, c, dt) => {
      oU?.(g, c, dt);
      kit.update?.(g, c, dt);
      if ((c.st.empT ?? 0) > 0) c.st.empT -= dt;
      if ((c.st.ctrT ?? 0) > 0) { c.st.ctrT -= dt; if (c.st.ctrT <= 0) c.st.ctrArmed = 0; }
    };
    const oB = d.dmgBonus;
    d.dmgBonus = (c: Fighter) => (oB ? oB(c) : 1) * empMult(c);
    const oE = d.evade;
    d.evade = (g, vic, att, amt, o) => {
      if (oE?.(g, vic, att, amt, o)) return true;
      if (vic.st.ctrArmed && (vic.st.ctrT ?? 0) > 0 && att !== vic && !o.dot) {
        vic.st.ctrArmed = 0; vic.invuln = Math.max(vic.invuln, 0.3);
        g.fx.ring(gnd(vic.pos), vic.st.ctrCol ?? 0xffffff, 0.5, 4, 0.35); sfx('zap');
        counterFns.get(vic)?.(att);
        return true;
      }
      return false;
    };
  }
  return notes;
}
