import { type Decision, PATHS } from '@fly/sim';
import type { DecisionEvent, Spikes } from './loop';
import type { Op } from './verdict';

/** A forced decision has no sense onset: its command's cells are counted over this many sim ms. */
const FORCED_MS = 50;

/** The operation that tests each decision («why?» card → its surgeon card). */
export const OP_OF: Record<Decision, Op> = { jump: 'panic', eat: 'sugar', back: 'moon', court: 'p1' };

/** Watched log rows of one path cell type. */
export interface PathRow {
  type: string;
  cells: number;
  has: Uint8Array;
}

/** One hop of the explained decision: cells that fired, first spike after the sense onset (ms). */
export interface WhyHop {
  type: string;
  region: string;
  cells: number;
  /** null for the sensory hop (driven, not watched). */
  fired: number | null;
  /** Sense onset → the hop's first spike; 0 for the sense, null when silent or forced. */
  ms: number | null;
}

/**
 * The «why?» card's chain for a decision, from the live log: each hop of `PATHS[action]` with the
 * time its first cell fired after the sense came on (window [onset, decision]) and how many fired.
 * A forced decision (no sense) keeps only the command.
 */
export function explain(
  d: DecisionEvent,
  log: Pick<Spikes, 'times' | 'rows' | 'span'>,
  rows: readonly PathRow[],
  senseCells: number,
): WhyHop[] {
  const hops = PATHS[d.action].hops;
  const forced = d.ms === null;
  const t0 = forced ? d.t - FORCED_MS : d.t - (d.ms as number);
  const [i0, i1] = log.span(t0 - 1e-3, d.t);
  return (forced ? hops.slice(-1) : hops).map((h, k) => {
    if (!forced && k === 0) return { ...h, cells: senseCells, fired: null, ms: 0 };
    const r = rows.find((x) => x.type === h.type);
    if (!r) return { ...h, cells: 0, fired: 0, ms: null };
    const seen = new Set<number>();
    let first: number | null = null;
    for (let i = i0; i < i1; i++) {
      const row = log.rows[i] as number;
      if (!r.has[row]) continue;
      seen.add(row);
      first ??= (log.times[i] as number) - t0;
    }
    return { ...h, cells: r.cells, fired: seen.size, ms: forced ? null : first };
  });
}
