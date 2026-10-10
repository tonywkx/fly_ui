import { type Action, mulberry32, type Stimulus } from '@fly/sim';
import { type Brain, NORM, type Norm } from './table';

/** The card's stimulus slot (banana stays in the palette only: it never decides, TERRARIUM §Norm table). */
export const CARD_STIMULI = [
  'sugar',
  'bitter',
  'female',
  'shadow',
  'swatter',
  'none',
] as const satisfies readonly Stimulus[];
export type CardStimulus = (typeof CARD_STIMULI)[number];

const BRAINS = ['none', 'panic', 'moon', 'sugar', 'p1'] as const satisfies readonly Brain[];

/** What a run comes to: the first decision, or the swatter landing ('walk' = nothing decided). */
export type Result = Action | 'hit';

/** One experiment: what we give the fly × what we change in her brain. */
export interface Pair {
  stim: CardStimulus;
  op: Brain;
}

export interface Discovery extends Pair {
  id: string;
  /** The Phase 8 puzzle (its index in `fly_ui.levels`) this discovery replaces. */
  level?: number;
}

export const pairId = (p: Pair): string => `${p.stim}:${p.op}`;

/** `stim[:op]` → a pair; null for anything off the card. */
export function parsePair(s: string): Pair | null {
  const [stim, op = 'none'] = s.split(':');
  const st = CARD_STIMULI.find((x) => x === stim);
  const o = BRAINS.find((x) => x === op);
  return st && o ? { stim: st, op: o } : null;
}

const d = (stim: CardStimulus, op: Brain, level?: number): Discovery => ({
  id: pairId({ stim, op }),
  stim,
  op,
  ...(level === undefined ? {} : { level }),
});

/** docs/TERRARIUM.md §Discoveries: 1–4 the norm, 5–8 the puzzles, 9–12 reach / override / specificity. */
export const DISCOVERIES: readonly Discovery[] = [
  d('sugar', 'none'),
  d('bitter', 'none'),
  d('shadow', 'none'),
  d('female', 'none'),
  d('swatter', 'panic', 0),
  d('sugar', 'sugar', 1),
  d('female', 'p1', 2),
  d('none', 'moon', 3),
  d('shadow', 'panic'),
  d('sugar', 'moon'),
  d('female', 'moon'),
  d('bitter', 'sugar'),
];

export const discovery = (p: Pair): Discovery | null => DISCOVERIES.find((x) => x.id === pairId(p)) ?? null;

export const normResult = (n: Norm): Result => (n.hit ? 'hit' : n.action);
export const normOf = (p: Pair): Result => normResult(NORM[p.stim][p.op]);

/** Plausible wrong bets per stimulus, in order of preference. */
const DISTRACT: Record<CardStimulus, readonly Result[]> = {
  sugar: ['walk', 'back'],
  bitter: ['eat', 'walk'],
  female: ['walk', 'back'],
  shadow: ['back', 'walk'],
  swatter: ['back', 'walk'],
  none: ['jump', 'back'],
};

/** The three bet chips: the normal fly, the operated one (from `NORM`), then distractors. */
export function chips(p: Pair): Result[] {
  const all = [normOf({ stim: p.stim, op: 'none' }), normOf(p), ...DISTRACT[p.stim]];
  return [...new Set(all)].slice(0, 3);
}

/** Seeded Fisher–Yates (chip order per visit). */
export function shuffle<T>(xs: readonly T[], seed: number): T[] {
  const r = mulberry32(seed);
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
