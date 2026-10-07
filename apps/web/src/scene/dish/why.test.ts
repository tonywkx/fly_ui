import { describe, expect, it } from 'vitest';
import type { DecisionEvent, Spikes } from './loop';
import { explain, OP_OF, type PathRow } from './why';

/** A log over plain arrays (span = (from, to]). */
function log(ev: [t: number, row: number][]): Pick<Spikes, 'times' | 'rows' | 'span'> {
  const times = Float32Array.from(ev.map((e) => e[0]));
  const rows = Uint32Array.from(ev.map((e) => e[1]));
  const after = (x: number) =>
    times.findIndex((t) => t > x) === -1 ? times.length : times.findIndex((t) => t > x);
  return { times, rows, span: (a, b) => [after(a), after(b)] };
}

/** Rows: 0–1 DNp01, 2–4 TTMn. */
function row(type: string, cells: number[]): PathRow {
  const has = new Uint8Array(8);
  for (const c of cells) has[c] = 1;
  return { type, cells: cells.length, has };
}
const ROWS = [row('DNp01', [0, 1]), row('TTMn', [2, 3, 4])];

const jump = (ms: number | null): DecisionEvent => ({ action: 'jump', t: 100, ms, side: 'L' });

describe('why', () => {
  it('times each hop from the sense onset and counts the cells that fired', () => {
    const h = explain(
      jump(20),
      log([
        [70, 0], // before the onset: not this decision
        [85, 1],
        [86, 1],
        [88, 2],
        [90, 3],
        [101, 4], // after the decision
      ]),
      ROWS,
      12,
    );
    expect(h.map((x) => x.type)).toEqual(['LC4', 'DNp01', 'TTMn']);
    expect(h[0]).toMatchObject({ cells: 12, fired: null, ms: 0 });
    expect(h[1]).toMatchObject({ cells: 2, fired: 1, ms: 5 });
    expect(h[2]).toMatchObject({ cells: 3, fired: 2, ms: 8 });
  });

  it('leaves a silent hop without a time', () => {
    const h = explain(jump(20), log([[90, 3]]), ROWS, 12);
    expect(h[1]).toMatchObject({ fired: 0, ms: null });
    expect(h[2]).toMatchObject({ fired: 1, ms: 10 });
  });

  it('names only the command when it was forced', () => {
    const h = explain(jump(null), log([[95, 2]]), ROWS, 12);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ type: 'TTMn', fired: 1, ms: null });
  });

  it('maps every decision to the operation that tests it', () => {
    expect(OP_OF).toEqual({ jump: 'panic', eat: 'sugar', back: 'moon', court: 'p1' });
  });
});
