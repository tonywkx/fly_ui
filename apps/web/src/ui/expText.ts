import type { Action, Decision } from '@fly/sim';
import { type Key, t, tOr } from '../i18n';
import { type CardStimulus, normResult, type Result } from '../scene/dish/discoveries';
import type { Norm } from '../scene/dish/table';
import type { Outcome } from '../state/trial';

/** The command cell each decision is read from (bridge `COMMANDS`). */
const CELL: Record<Decision, string> = { jump: 'TTMn', back: 'MDN', eat: 'MN9', court: 'pIP10' };

const decides = (a: Action | Result): a is Decision => a in CELL;

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
  const own = decides(o.result) ? o.result : null;
  const cell = own ?? (decides(o.norm.action) ? o.norm.action : null);
  const hz = own ? o.hz : cell ? o.peak[cell] : 0;
  return o.result === normResult(o.norm)
    ? line(t('exp.same'), o.ms, cell, hz, ' · ')
    : line(did(o.result, o.pair.stim), own ? o.ms : null, cell, hz);
}

/** «прогноз»: the pair's bet and whether it came true; null with no bet. */
export function betLine(o: Outcome): string | null {
  if (!o.bet) return null;
  const act = t(`exp.act.${o.bet}` as Key);
  return t(o.bet === o.result ? 'exp.bet.hit' : 'exp.bet.miss', { act });
}
