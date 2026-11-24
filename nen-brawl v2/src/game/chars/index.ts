import type { CharDef, PlayableKind } from '../defs';
import { GON } from './gon';
import { KILLUA } from './killua';
import { LEORIO } from './leorio';
import { KURAPIKA } from './kurapika';
import { HISOKA } from './hisoka';
import { MOREL } from './morel';
import { CHROLLO } from './chrollo';

export const CHARS: Record<PlayableKind, CharDef> = {
  gon: GON,
  killua: KILLUA,
  leorio: LEORIO,
  kurapika: KURAPIKA,
  hisoka: HISOKA,
  morel: MOREL,
  chrollo: CHROLLO,
};
