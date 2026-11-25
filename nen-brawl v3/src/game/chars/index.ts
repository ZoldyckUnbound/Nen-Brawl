import type { CharDef, PlayableKind } from '../defs';
import { GON } from './gon';
import { KILLUA } from './killua';
import { LEORIO } from './leorio';
import { KURAPIKA } from './kurapika';
import { HISOKA } from './hisoka';
import { MOREL } from './morel';
import { CHROLLO } from './chrollo';
import { NETERO } from './netero';
import { KITE } from './kite';
import { KNOV } from './knov';
import { KNUCKLE } from './knuckle';
import { PITOU } from './pitou';

export const CHARS: Record<PlayableKind, CharDef> = {
  gon: GON,
  killua: KILLUA,
  leorio: LEORIO,
  kurapika: KURAPIKA,
  hisoka: HISOKA,
  morel: MOREL,
  chrollo: CHROLLO,
  netero: NETERO,
  kite: KITE,
  knov: KNOV,
  knuckle: KNUCKLE,
  pitou: PITOU,
};
