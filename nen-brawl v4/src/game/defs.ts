import type { Game } from './Game';
import type { Fighter, Form } from './Fighter';

export type PlayableKind = 'gon' | 'killua' | 'leorio' | 'kurapika' | 'hisoka' | 'morel' | 'chrollo' | 'netero' | 'kite' | 'knov' | 'knuckle' | 'pitou' | 'zeno' | 'gotoh' | 'franklin' | 'kastro' | 'gido';
export type Kind = PlayableKind | 'bandit';
export const ALL_KINDS: PlayableKind[] = ['gon', 'killua', 'leorio', 'kurapika', 'hisoka', 'morel', 'chrollo', 'netero', 'kite', 'knov', 'knuckle', 'pitou', 'zeno', 'gotoh', 'franklin', 'kastro', 'gido'];

export interface SkillDef {
  key: string;
  name: string;
  desc: string;
  cost: number;
  cd: number;
  /** max hold time in seconds (enables tap / hold behaviour) */
  charge?: number;
  chargeAnim?: string;
  /** [min,max] distance where the AI considers using this skill */
  ai: [number, number];
  can?: (g: Game, c: Fighter) => boolean;
  /** ch = 0 for a tap, otherwise 0..1 charge fraction. May return a cooldown override. */
  cast: (g: Game, c: Fighter, ch: number) => number | void;
}

export interface M1Step {
  anim: string;
  dmg: number;
  /** seconds until the next hit may start */
  dur: number;
  /** seconds from start until the hit lands */
  hit: number;
  range: number;
  /** cosine of the half angle of the hit arc (lower = wider) */
  arc?: number;
  kb?: number;
  stun?: number;
  launch?: number;
  slam?: boolean;
  lunge?: number;
  color?: number;
  heavy?: boolean;
  /** 1 = right hand trail, 2 = left hand trail, 3 = foot trail */
  trail?: 1 | 2 | 3;
  /** ground shockwave radius at impact point */
  shock?: number;
  /** hop and slam: hits on landing in this radius */
  dive?: number;
  behind?: boolean;
  side?: boolean;
  hits?: number;
  hop?: number;
  breakGuard?: boolean;
  recoil?: boolean;
}

export interface M1Def {
  steps: M1Step[];
  /** cooldown after the final hit of the combo */
  recovery: number;
  /** how long you have to continue the chain */
  window: number;
}

export interface CharDef {
  kind: PlayableKind;
  name: string;
  title: string;
  typ: string;
  blurb: string;
  color: number;
  css: string;
  hp: number;
  speed: number;
  meter: { name: string; color: string; start: number; max: number };
  passive: { name: string; desc: string };
  gainHit: number;
  gainHurt: number;
  chargeDrain?: number;
  skills: SkillDef[];
  formSkills?: SkillDef[];
  m1: M1Def;
  m1Air: M1Def;
  m1Form?: M1Def;
  m1Mode: 'repeat' | 'charge' | 'click';
  m1Range: number;
  atkSpeedForm?: number;
  dmgBonus?: (c: Fighter) => number;
  update?: (g: Game, c: Fighter, dt: number) => void;
  onDealt?: (g: Game, att: Fighter, vic: Fighter, amt: number, o: DmgOpts) => void;
  onHurt?: (g: Game, vic: Fighter, att: Fighter, amt: number, o: DmgOpts) => void;
  onDash?: (g: Game, c: Fighter) => void;
  /** return true to completely avoid an incoming hit */
  evade?: (g: Game, vic: Fighter, att: Fighter, amt: number, o: DmgOpts) => boolean;
  onSpawn?: (g: Game, c: Fighter) => void;
  onFormEnd?: (g: Game, c: Fighter, was: Form) => void;
  /** called when an M1 step lands (for visuals / extra hits) */
  onM1?: (g: Game, c: Fighter, s: M1Step) => void;
}

export interface DmgOpts {
  kb?: number;
  stun?: number;
  color?: number;
  heavy?: boolean;
  noCrit?: boolean;
  noMeter?: boolean;
  melee?: boolean;
  launch?: number;
  slam?: boolean;
  side?: boolean;
  breakGuard?: boolean;
  bleed?: number;
  bleedDps?: number;
  root?: number;
  slow?: number;
  slowMul?: number;
  exclude?: Fighter[];
  mult?: (v: Fighter) => number;
  onHit?: (v: Fighter) => void;
  dirx?: number;
  dirz?: number;
  skill?: boolean;
  recoil?: boolean;
  dot?: boolean;
  pierce?: boolean;
}

/** global cooldown tempo: skills come back faster (Blox-Fruits-style) – ultimates a little slower than basics */
export const cdScale = (i: number) => (i === 3 ? 0.85 : 0.72);
