import { type Decision, OPERATIONS } from '@fly/sim';
import { type Key, t, tOr } from '../i18n';
import {
  type CardStimulus,
  decides,
  normResult,
  type Pair,
  type Result,
  readCell,
} from '../scene/dish/discoveries';
import { NORM, type Norm } from '../scene/dish/table';
import type { Op } from '../scene/dish/verdict';
import type { Entry, Outcome, Picks, Slot } from '../state/trial';

/** The command cell each decision is read from (bridge `COMMANDS`). */
const CELL: Record<Decision, string> = { jump: 'TTMn', back: 'MDN', eat: 'MN9', court: 'pIP10' };

/** Mono term per operation (as on the old cards). */
export const OP_CELL: Record<Op, string> = { panic: 'DNp01', moon: 'MDN', sugar: 'LB3', p1: 'P1' };

/** Each stimulus's strongest path in short (sense → command), for the discovery tiles. */
const PATH: Record<CardStimulus, readonly string[]> = {
  sugar: ['LB3', 'MN9'],
  bitter: ['LB1', 'MDN'],
  shadow: ['LC4', 'DNp01', 'TTMn'],
  swatter: ['LC4', 'DNp01', 'TTMn'],
  female: ['LC10a', 'P1', 'pIP10'],
  none: [],
};

/** Brain picks as their non-zero parts: «выкл. 2 · вкл. 1» (the chip, «← К мухе · …»). */
export function picksText(p: Picks): string {
  const part = (n: number, k: Key) => (n > 0 ? [`${t(k)} ${n}`] : []);
  return [...part(p.off, 'exp.op.offShort'), ...part(p.on, 'exp.op.onShort')].join(' · ');
}

/** The surgeon's glyphs (SURGEON-SHAPE §Brief 3): nothing, switched off, switched on. */
export type OpGlyph = '○' | '⊘' | '●';

export const low = (s: string) => s.charAt(0).toLocaleLowerCase() + s.slice(1);
/** An op switches its cells on (MDN), the rest switch them off. */
export const opIsOn = (op: Op) => OPERATIONS[op].mode === 'on';
/** «нейрон бегства»: the op's cells, in a sentence. */
export const opName = (op: Op) => low(t(`op.${op}.name` as Key));

/** The «Что меняем» slot's value: «⊘ нейрон бегства · выкл.», «⊘ клетки из мозга · выкл. 2». */
export function opChip(s: Slot, picks: Picks | null): { glyph: OpGlyph; text: string } {
  if (s === 'brain' && picks)
    return {
      glyph: picks.off > 0 ? '⊘' : '●',
      text: low(t('op.pick.kept', { cells: picksText(picks) })),
    };
  if (s === 'brain' || s === 'none') return { glyph: '○', text: t('exp.op.none') };
  const on = opIsOn(s);
  return {
    glyph: on ? '●' : '⊘',
    text: t('op.chip', {
      name: opName(s),
      mode: t(on ? 'exp.op.onShort' : 'exp.op.offShort'),
    }),
  };
}

/** The courting male is the subject for the female stimulus. */
export const isHe = (stim: CardStimulus) => stim === 'female';

const cap = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

/** «взлетает через 8 мс · TTMn 227 Гц»: the head, its latency, the command's rate, whichever there are. */
function line(head: string, ms: number | null, cell: Decision | null, hz: number, sep = ' '): string {
  const when = ms === null ? head : `${head}${sep}${t('exp.in', { ms })}`;
  return cell ? `${when} · ${t('exp.hz', { cell: CELL[cell], hz: Math.round(hz) })}` : when;
}

/** «обычно»: what the normal fly does with this stimulus. */
export function usualLine(n: Norm): string {
  return line(t(`exp.is.${normResult(n)}` as Key), n.ms, decides(n.action) ? n.action : null, n.hz);
}

/** The result in the past tense, lowercase («попятился» for the male). */
function did(r: Result, stim: CardStimulus): string {
  const k = `exp.did.${r}`;
  return isHe(stim) ? tOr(`${k}.he`, t(k as Key)) : t(k as Key);
}

/** The result card's heading: what she did now. */
export const headline = (o: Outcome): string => cap(did(o.result, o.pair.stim));

/**
 * «сейчас»: what she did this run, or «так же, как обычно»; the numbers come from the deciding
 * command, or the norm's one when nothing decided (swatter × DNp01 off reads TTMn).
 */
export function nowLine(o: Outcome): string {
  const own = decides(o.result);
  const cell = readCell(o.result, o.norm);
  const hz = own ? o.hz : cell ? o.peak[cell] : 0;
  return o.result === normResult(o.norm)
    ? line(t('exp.same'), o.ms, cell, hz, ' · ')
    : line(did(o.result, o.pair.stim), own ? o.ms : null, cell, hz);
}

/** The latency «сейчас» shows: the run's own, when it matched the norm or decided something. */
const nowMs = (o: Outcome): number | null =>
  o.result === normResult(o.norm) || decides(o.result) ? o.ms : null;

/** Where the scale line goes (SURGEON-SHAPE §Scale): under «сейчас» if it has a number, else «обычно». */
export function scaleRow(o: Outcome): { row: 'now' | 'usual'; ms: number } | null {
  const now = nowMs(o);
  if (now !== null) return { row: 'now', ms: now };
  return o.norm.ms === null ? null : { row: 'usual', ms: o.norm.ms };
}

/** «прогноз»: the pair's bet and whether it came true; null with no bet. */
export function betLine(o: Outcome): string | null {
  if (!o.bet) return null;
  const act = t(`exp.act.${o.bet}` as Key);
  return t(o.bet === o.result ? 'exp.bet.hit' : 'exp.bet.miss', { act });
}

/** A discovery tile: what the pair's first run came to, with its numbers (as the «сейчас» row). */
export function foundLine(e: Entry, p: Pair): string {
  const cell = readCell(e.result, NORM[p.stim].none);
  return line(did(e.result, p.stim), decides(e.result) ? e.ms : null, cell, e.hz);
}

export interface PathCell {
  cell: string;
  /** The operated cell: switched off or on. */
  mode?: 'off' | 'on';
  /** Off the stimulus's path (MDN switched on). */
  extra?: true;
}

/** Which cells: the stimulus's path with the operated cell marked, or added after it. */
export function cellPath(p: Pair): PathCell[] {
  const op = p.op === 'none' ? null : { cell: OP_CELL[p.op], mode: OPERATIONS[p.op].mode };
  const out: PathCell[] = PATH[p.stim].map((cell) =>
    op?.cell === cell ? { cell, mode: op.mode } : { cell },
  );
  if (op && !PATH[p.stim].includes(op.cell)) out.push({ ...op, extra: true });
  return out;
}
