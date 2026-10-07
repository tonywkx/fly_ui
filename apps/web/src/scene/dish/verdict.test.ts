import type { Action, Rates, Senses, WorldEvent } from '@fly/sim';
import { describe, expect, it } from 'vitest';
import { HOLD_MS, TAIL_MS, Verdicts } from './verdict';

const calm: Senses = { sugar: 0, bitter: 0, loom: { L: 0, R: 0 }, female: { L: 0, R: 0 } };
const zero: Rates = { jump: 0, back: 0, eat: 0, court: 0, gate: 0 };

/** Ticks 1 ms each over [from, to), with senses / rates / action per t; returns ops changed per t. */
function run(
  v: Verdicts,
  from: number,
  to: number,
  f: (t: number) => { s?: Partial<Senses>; r?: Partial<Rates>; a?: Action; ev?: WorldEvent[] },
) {
  const changed: [number, string][] = [];
  for (let t = from; t < to; t++) {
    const { s, r, a, ev } = f(t);
    for (const op of v.tick(t, { ...calm, ...s }, { ...zero, ...r }, a ?? 'walk', ev)) changed.push([t, op]);
  }
  return changed;
}

describe('Verdicts', () => {
  it('a loom with a jump publishes «did» with the latency and peak after the tail', () => {
    const v = new Verdicts();
    const ch = run(v, 0, 200, (t) => ({
      s: t >= 10 && t < 40 ? { loom: { L: 1, R: 1 } } : {},
      r: { jump: t >= 10 && t < 60 ? (t - 10) * 5 : 0 },
      a: t >= 18 && t < 50 ? 'jump' : 'walk',
    }));
    expect(ch).toEqual([[39 + TAIL_MS, 'panic']]);
    expect(v.now.panic).toEqual({ line: 'did', hz: 245, ms: 8, hit: false });
  });

  it('a loom with no jump is a verdict and records the hit', () => {
    const v = new Verdicts();
    run(v, 0, 200, (t) => ({
      s: t < 30 ? { loom: { L: 1, R: 0.75 } } : {},
      r: { jump: 44 },
      ev: t === 30 ? [{ kind: 'hit', t, x: 0, y: 0 }] : [],
    }));
    expect(v.now.panic).toEqual({ line: 'verdict', hz: 44, ms: null, hit: true });
  });

  it('an ongoing encounter publishes at HOLD_MS and again when the line flips', () => {
    const v = new Verdicts();
    const ch = run(v, 0, 400, (t) => ({ s: { sugar: 1 }, r: { eat: 200 }, a: t >= 300 ? 'eat' : 'walk' }));
    expect(ch).toEqual([
      [HOLD_MS, 'sugar'],
      [300, 'sugar'],
    ]);
    expect(v.now.sugar).toEqual({ line: 'did', hz: 200, ms: 300, hit: false });
  });

  it('moon: backing with bitter is «did», with no cause it is the verdict', () => {
    const v = new Verdicts();
    run(v, 0, 100, (t) => ({ s: t < 20 ? { bitter: 1 } : {}, r: { back: 90 }, a: t < 30 ? 'back' : 'walk' }));
    expect(v.now.moon).toMatchObject({ line: 'did', hz: 90 });
    run(v, 100, 400, () => ({ r: { back: 137 }, a: 'back' }));
    expect(v.now.moon).toMatchObject({ line: 'verdict', hz: 137, ms: 0 });
  });

  it('female in view without courtship → p1 verdict; reset clears', () => {
    const v = new Verdicts();
    run(v, 0, 300, () => ({ s: { female: { L: 1, R: 0.8 } }, r: { court: 63, gate: 0 } }));
    expect(v.now.p1).toEqual({ line: 'verdict', hz: 63, ms: null, hit: false });
    v.reset();
    expect(v.now.p1).toBeNull();
    expect(run(v, 300, 310, () => ({}))).toEqual([]);
  });
});
