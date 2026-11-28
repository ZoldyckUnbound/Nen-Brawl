/** Keyframed pose library. Angles in radians. Channels not listed in a key fall back to the base locomotion pose. */
export interface Pose {
  bx?: number; by?: number; bz?: number; py?: number; pz?: number; hx?: number; hy?: number; ry?: number;
  aLx?: number; aLz?: number; aRx?: number; aRz?: number; eL?: number; eR?: number;
  lL?: number; lR?: number; kL?: number; kR?: number;
}
export type Key = [number, Pose];

export const CHANNELS = ['bx', 'by', 'bz', 'py', 'pz', 'hx', 'hy', 'ry', 'aLx', 'aLz', 'aRx', 'aRz', 'eL', 'eR', 'lL', 'lR', 'kL', 'kR'] as const;
export type Chan = (typeof CHANNELS)[number];

const SWAP: Record<string, [Chan, number]> = {
  aLx: ['aRx', 1], aRx: ['aLx', 1], aLz: ['aRz', -1], aRz: ['aLz', -1],
  eL: ['eR', 1], eR: ['eL', 1], lL: ['lR', 1], lR: ['lL', 1], kL: ['kR', 1], kR: ['kL', 1],
  by: ['by', -1], bz: ['bz', -1], hy: ['hy', -1], ry: ['ry', -1], bx: ['bx', 1], py: ['py', 1], pz: ['pz', 1], hx: ['hx', 1],
};
function mirror(keys: Key[]): Key[] {
  return keys.map(([t, p]) => {
    const o: Pose = {};
    for (const k of Object.keys(p)) {
      const [nk, s] = SWAP[k];
      (o as Record<string, number>)[nk] = (p as Record<string, number>)[k] * s;
    }
    return [t, o] as Key;
  });
}

const R: Record<string, Key[]> = {
  jab: [
    [0, { aRx: 0.3, eR: -2.3, by: 0.4, aLx: -0.9, eL: -1.7, pz: -0.05 }],
    [0.32, { aRx: -1.57, eR: 0, aRz: 0.08, by: -0.6, aLx: -0.5, eL: -2, pz: 0.28, bx: 0.1, lL: -0.5, lR: 0.4 }],
    [0.65, { aRx: -1.5, eR: -0.1, by: -0.5, pz: 0.22, bx: 0.08 }],
    [1, { aRx: -0.3, eR: -0.5, by: 0 }],
  ],
  hook: [
    [0, { aRz: 1.1, aRx: -0.4, eR: -1.3, by: 0.8, bz: 0.1, pz: -0.05 }],
    [0.4, { aRz: 1.5, aRx: -0.2, eR: -1.5, by: -1.0, pz: 0.2, bz: -0.08, lL: -0.4, lR: 0.4 }],
    [0.7, { aRz: 1.3, aRx: -0.2, eR: -1.4, by: -0.9, pz: 0.15 }],
    [1, { aRz: 0.2, eR: -0.4, by: 0 }],
  ],
  body: [
    [0, { py: -0.35, bx: 0.3, aRx: 0.4, eR: -1.8, by: 0.4, kL: 0.6, kR: 0.6, lL: -0.4, lR: -0.4 }],
    [0.38, { py: -0.45, bx: 0.5, aRx: -1.15, eR: -0.1, by: -0.6, pz: 0.32, aLx: -0.5, eL: -2, kL: 0.8, kR: 0.8, lL: -0.7, lR: -0.2 }],
    [1, { py: 0, bx: 0, aRx: -0.3, eR: -0.4 }],
  ],
  upper: [
    [0, { py: -0.4, bx: 0.28, aRx: 0.6, eR: -0.9, by: 0.5, kL: 0.8, kR: 0.8, lL: -0.5, lR: -0.5, aLx: -0.9, eL: -1.8 }],
    [0.36, { py: 0.18, bx: -0.12, aRx: -2.7, eR: -0.2, by: -0.55, aLx: -0.4, eL: -2, kL: 0.1, kR: 0.1, lL: -0.1, lR: 0.1, pz: 0.15 }],
    [0.7, { py: 0.12, bx: -0.15, aRx: -2.9, eR: -0.1, by: -0.4 }],
    [1, { py: 0, bx: 0, aRx: -0.3, eR: -0.4 }],
  ],
  elbow: [
    [0, { aRx: -0.8, eR: -2.8, by: 0.8, aLx: -0.7, eL: -1.8 }],
    [0.4, { aRx: -1.25, eR: -2.9, by: -1.0, pz: 0.25, bx: 0.12, aLx: 0.3, eL: -0.6 }],
    [1, { aRx: -0.3, eR: -0.5, by: 0 }],
  ],
  palm: [
    [0, { aRx: 0.3, eR: -2.4, by: 0.45, aLx: -1, eL: -1.5 }],
    [0.3, { aRx: -1.75, eR: -0.05, aRz: 0.15, by: -0.55, pz: 0.32, bx: 0.15, aLx: 0.2, eL: -0.8, lL: -0.6, lR: 0.5 }],
    [0.7, { aRx: -1.7, eR: -0.1, by: -0.5, pz: 0.25 }],
    [1, { aRx: -0.3, eR: -0.5, by: 0 }],
  ],
  slam: [
    [0, { aRx: -3.0, eR: -0.4, bx: -0.3, py: 0.08, aLx: -0.6, eL: -1.2 }],
    [0.42, { aRx: -0.5, eR: 0, bx: 0.7, py: -0.4, pz: 0.35, aLx: 0.5 }],
    [1, { aRx: -0.4, eR: -0.3, bx: 0.1, py: -0.1 }],
  ],
  knee: [
    [0, { lR: -0.3, kR: 0.7, bx: 0.1, aLx: -0.9, eL: -1.5, aRx: -0.9, eR: -1.5 }],
    [0.4, { lR: -1.9, kR: 1.9, bx: -0.1, py: 0.1, aLx: -1.2, aRx: -1.2, pz: 0.15 }],
    [1, { lR: 0, kR: 0, bx: 0 }],
  ],
  kick: [
    [0, { lR: -1.0, kR: 2.2, bx: -0.12, aLx: -0.6, eL: -1.5, aRx: 0.5, eR: -0.7 }],
    [0.4, { lR: -1.65, kR: 0.05, bx: -0.35, pz: 0.12, aLx: -0.6, aRx: 0.7, lL: 0.2 }],
    [0.75, { lR: -1.6, kR: 0.1, bx: -0.3 }],
    [1, { lR: 0, kR: 0, bx: 0 }],
  ],
  round: [
    [0, { ry: 0.5, lR: -0.8, kR: 1.8, bz: 0.1, aLz: -1.0, aRz: 1.0, aLx: -0.3, aRx: -0.3 }],
    [0.45, { ry: -0.9, lR: -1.6, kR: 0.15, bz: -0.3, aLz: -1.4, aRz: 1.4, aLx: -0.2, aRx: -0.2, pz: 0.1 }],
    [1, { ry: 0, lR: 0, kR: 0, bz: 0 }],
  ],
  spin: [
    [0, { ry: 0, lL: -1.3, kL: 0.3, aLz: -1.4, aRz: 1.4, aLx: -0.2, aRx: -0.2, lR: 0.3, bz: 0.05 }],
    [1, { ry: 6.2832, lL: -1.3, kL: 0.3, aLz: -1.4, aRz: 1.4, aLx: -0.2, aRx: -0.2, lR: 0.3 }],
  ],
  flykick: [
    [0, { bx: 1.0, lR: -1.1, kR: 0.1, lL: 0.7, kL: 1.3, aLx: -1.0, aRx: 0.7, eL: -0.6, eR: -0.4 }],
    [1, { bx: 1.15, lR: -1.2, kR: 0, lL: 0.8, kL: 1.4, aLx: -1.2, aRx: 0.9 }],
  ],
  dive: [
    [0, { bx: 0.8, lR: -0.8, kR: 1.5, lL: 0.1, aLx: -2.6, aRx: -2.6 }],
    [0.3, { bx: 1.35, lR: -0.3, kR: 0, lL: 0.4, kL: 0.5, aLx: -2.8, aRx: -2.8 }],
    [1, { bx: 1.45, lR: -0.2, kR: 0, lL: 0.5, kL: 0.5, aLx: -2.8, aRx: -2.8 }],
  ],
  castFwd: [
    [0, { aLx: -0.5, eL: -1.9, aRx: -0.5, eR: -1.9, bx: -0.05, py: -0.1 }],
    [0.3, { aLx: -1.55, aRx: -1.55, eL: 0, eR: 0, bx: 0.12, pz: 0.12, aLz: -0.1, aRz: 0.1 }],
    [0.75, { aLx: -1.55, aRx: -1.55, eL: 0, eR: 0, bx: 0.1, pz: 0.1 }],
    [1, { aLx: -0.3, aRx: -0.3 }],
  ],
  castR: [
    [0, { aRx: 0.2, eR: -2.2, by: 0.5, aLx: -0.4, eL: -1.0 }],
    [0.32, { aRx: -1.55, eR: 0, by: -0.5, aLx: 0.5, eL: -0.6, pz: 0.14 }],
    [0.8, { aRx: -1.55, eR: 0, by: -0.45, aLx: 0.5, pz: 0.1 }],
    [1, { aRx: -0.3, by: 0 }],
  ],
  castUp: [
    [0, { aRx: -0.3, eR: -0.4 }],
    [0.3, { aRx: -2.85, eR: 0, aRz: 0.2, bx: -0.18, hx: -0.3, aLx: -0.3 }],
    [0.85, { aRx: -2.9, eR: 0, aRz: 0.2, bx: -0.2, hx: -0.35 }],
    [1, { aRx: -0.3 }],
  ],
  throw: [
    [0, { aRx: -2.5, eR: -1.4, by: 0.8, bx: -0.2, aLx: -1.1, eL: -0.2 }],
    [0.4, { aRx: -1.3, eR: -0.1, by: -0.7, bx: 0.22, pz: 0.2, aLx: 0.2 }],
    [1, { aRx: -0.4, eR: -0.4, by: 0 }],
  ],
  fling: [
    [0, { aRz: 1.4, aRx: -0.3, eR: -0.5, by: 0.9, aLx: -0.8, eL: -1 }],
    [0.4, { aRz: 1.3, aRx: -1.4, eR: 0, by: -0.9, pz: 0.15 }],
    [1, { aRz: 0.2, aRx: -0.4, by: 0 }],
  ],
  slash: [
    [0, { aRx: -2.75, eR: -0.5, aRz: 0.4, by: 0.55, bx: -0.18, aLx: -1.2, eL: -1 }],
    [0.4, { aRx: -0.5, eR: 0, aRz: -0.2, by: -0.8, bx: 0.35, pz: 0.25, aLx: -0.3, lL: -0.6, lR: 0.5 }],
    [1, { aRx: -0.3, by: 0, bx: 0 }],
  ],
  slashSide: [
    [0, { aRx: -1.45, aRz: 1.45, eR: -0.2, by: 1.0, aLx: -0.5, eL: -1.5 }],
    [0.4, { aRx: -1.45, aRz: -0.7, eR: 0, by: -1.1, pz: 0.2, lL: -0.5, lR: 0.4 }],
    [0.8, { aRx: -1.4, aRz: -0.8, by: -1.0 }],
    [1, { aRx: -0.3, aRz: 0.1, by: 0 }],
  ],
  overhead: [
    [0, { aLx: -3.0, aRx: -3.0, eL: -0.2, eR: -0.2, bx: -0.35, py: 0.1, lL: -0.2, lR: 0.2 }],
    [0.5, { aLx: -3.05, aRx: -3.05, bx: -0.4, py: 0.12 }],
    [0.68, { aLx: -1.0, aRx: -1.0, eL: 0, eR: 0, bx: 0.7, py: -0.4, pz: 0.3, kL: 0.6, kR: 0.6, lL: -0.6, lR: -0.6 }],
    [1, { aLx: -0.5, aRx: -0.5, bx: 0.15, py: -0.1 }],
  ],
  rock: [
    [0, { aRx: 0.9, eR: -2.0, by: 1.0, bx: 0.15, py: -0.28, kL: 0.7, lL: -0.45, lR: 0.35, aLx: -1.3, eL: -1.4 }],
    [0.45, { aRx: 1.0, eR: -2.1, by: 1.1, bx: 0.2, py: -0.3, kL: 0.7, lL: -0.5, lR: 0.4, aLx: -1.3, eL: -1.4 }],
    [0.62, { aRx: -1.57, eR: 0, by: -0.9, bx: 0.3, pz: 0.5, py: -0.3, lL: -0.9, kL: 0.2, lR: 0.5, aLx: 0.6, eL: -0.4 }],
    [1, { aRx: -1.3, eR: -0.2, by: -0.7, bx: 0.2, pz: 0.3, py: -0.15 }],
  ],
  grab: [
    [0, { aLx: -1.2, aRx: -1.2, eL: -0.5, eR: -0.5, aLz: -0.3, aRz: 0.3, bx: 0.2, py: -0.15 }],
    [0.5, { aLx: -1.5, aRx: -1.5, eL: -0.9, eR: -0.9, aLz: 0.2, aRz: -0.2, bx: 0.25, py: -0.2 }],
    [1, { aLx: -1.5, aRx: -1.5, eL: -0.9, eR: -0.9, bx: 0.25 }],
  ],
  leap: [
    [0, { py: -0.5, bx: 0.45, kL: 1.3, kR: 1.3, lL: -0.9, lR: -0.9, aLx: 0.6, aRx: 0.6, eL: -0.3, eR: -0.3 }],
    [0.4, { py: 0.15, bx: 0.15, lL: -0.2, lR: -0.2, kL: 0.2, kR: 0.2, aLx: -2.7, aRx: -2.7 }],
    [1, { py: 0, bx: 0.2, lL: -0.5, lR: 0.3, kL: 0.5, kR: 0.9, aLx: -1.4, aRx: -1.4 }],
  ],
  summon: [
    [0, { aLx: -0.3, aRx: -0.3 }],
    [0.4, { aLz: -2.3, aRz: 2.3, aLx: -0.3, aRx: -0.3, eL: -0.3, eR: -0.3, hx: -0.35, py: 0.08, bx: -0.12 }],
    [1, { aLz: -2.2, aRz: 2.2, aLx: -0.3, aRx: -0.3, hx: -0.3, bx: -0.1 }],
  ],
  point: [
    [0, { aRx: -0.4, eR: -0.8 }],
    [0.3, { aRx: -1.57, eR: 0, by: -0.4, aLx: 0.3, eL: -0.5 }],
    [1, { aRx: -1.57, eR: 0, by: -0.4, aLx: 0.3 }],
  ],
  crouch: [
    [0, { py: -0.5, bx: 0.4, kL: 1.4, kR: 1.4, lL: -0.9, lR: -0.9, aLx: 0.4, aRx: 0.4 }],
    [1, { py: -0.5, bx: 0.4, kL: 1.4, kR: 1.4, lL: -0.9, lR: -0.9, aLx: 0.4, aRx: 0.4 }],
  ],
  bow: [
    [0, {}],
    [0.5, { bx: 0.5, hx: 0.3, aLx: -0.5, aRx: -0.5, eL: -1.4, eR: -1.4 }],
    [1, {}],
  ],
  pray: [
    [0, { aLx: -1.0, aRx: -1.0, eL: -2.0, eR: -2.0, aLz: 0.55, aRz: -0.55, bx: 0.18, hx: 0.28, py: -0.08 }],
    [1, { aLx: -1.0, aRx: -1.0, eL: -2.0, eR: -2.0, aLz: 0.55, aRz: -0.55, bx: 0.18, hx: 0.28, py: -0.08 }],
  ],
  victory: [
    [0, { aLx: -3.0, aRx: -3.0 }],
    [1, { aLx: -3.0, aRx: -3.0 }],
  ],
};

export const ANIMS: Record<string, Key[]> = {};
for (const k of Object.keys(R)) ANIMS[k] = R[k];
// right/left pairs
for (const k of ['jab', 'hook', 'body', 'upper', 'elbow', 'palm', 'slam', 'knee', 'kick', 'round', 'throw', 'fling', 'slash']) {
  ANIMS[k + 'R'] = R[k];
  ANIMS[k + 'L'] = mirror(R[k]);
}
ANIMS['spinKick'] = R.spin;
ANIMS['flyKick'] = R.flykick;
ANIMS['diveKick'] = R.dive;
ANIMS['slashSideL'] = mirror(R.slashSide);

export const ANIM_CHANNELS: Record<string, Chan[]> = {};
for (const k of Object.keys(ANIMS)) {
  const s = new Set<Chan>();
  for (const [, p] of ANIMS[k]) for (const c of Object.keys(p)) s.add(c as Chan);
  ANIM_CHANNELS[k] = [...s];
}
export const SPIN_ANIMS = new Set(['spin', 'spinKick']);

/** static poses used while a skill is being charged */
export const CHARGE_POSES: Record<string, Pose> = {
  charge: { aLx: -1.2, aRx: -1.2, eL: -1.5, eR: -1.5, aLz: -0.3, aRz: 0.3, bx: 0.2, py: -0.2, kL: 0.5, kR: 0.5, lL: -0.4, lR: -0.2 },
  chargeFist: { aRx: 1.0, eR: -2.1, by: 1.1, bx: 0.2, py: -0.3, kL: 0.7, lL: -0.5, lR: 0.4, aLx: -1.3, eL: -1.4 },
  chargePalm: { aRx: -1.3, eR: -1.5, aRz: 0.2, by: 0.5, aLx: -0.4, eL: -1.5, bx: 0.1, py: -0.15, kL: 0.4, lL: -0.35 },
  chargeBlade: { aRx: -1.9, eR: -0.6, aRz: 0.5, by: 0.6, aLx: -1.0, eL: -1.2, bx: -0.1, py: -0.2, kL: 0.5, lL: -0.35 },
  chargeUp: { aRx: -2.85, eR: 0, aRz: 0.2, bx: -0.2, hx: -0.35, aLx: -0.3 },
  chargeCast: { aLx: -1.55, aRx: -1.55, eL: -0.3, eR: -0.3, aLz: -0.4, aRz: 0.4, bx: 0.1, py: -0.1 },
};
