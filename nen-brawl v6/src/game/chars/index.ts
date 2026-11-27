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
import { ZENO } from './zeno';
import { GOTOH } from './gotoh';
import { FRANKLIN } from './franklin';
import { KASTRO } from './kastro';
import { GIDO } from './gido';

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
  zeno: ZENO,
  gotoh: GOTOH,
  franklin: FRANKLIN,
  kastro: KASTRO,
  gido: GIDO,
};
