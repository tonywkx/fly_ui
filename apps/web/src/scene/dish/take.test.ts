import type { WorldEvent } from '@fly/sim';
import { describe, expect, it } from 'vitest';
import type { DecisionEvent } from './loop';
import { TAIL, Take, TIMEOUT } from './take';

const dec = (action: DecisionEvent['action'], t: number, ms: number | null = 20): DecisionEvent => ({
  action,
  t,
  ms,
  side: null,
});
const peak = { jump: 230, back: 140, eat: 260, court: 130, gate: 0 };
const hit = { kind: 'hit' } as WorldEvent;

describe('Take', () => {
  it('ends the decision + TAIL after it', () => {
    const k = new Take(100);
    k.feed([dec('jump', 135, 35)], []);
    expect(k.done(135 + TAIL - 1)).toBe(false);
    expect(k.done(135 + TAIL)).toBe(true);
    expect(k.result(peak)).toMatchObject({ result: 'jump', ms: 35, hz: 230 });
  });

  it('knows its first decision and a hit', () => {
    const k = new Take(0);
    k.feed([dec('back', 230, null)], [hit]);
    expect(k.decision?.action).toBe('back');
    expect(k.struck).toBe(true);
  });

  it('keeps a copy of every command peak (the card reads the norm command)', () => {
    const k = new Take(0);
    const p = { ...peak };
    const r = k.result(p);
    p.jump = 0;
    expect(r.peak.jump).toBe(230);
  });

  it('keeps the first decision only', () => {
    const k = new Take(0);
    k.feed([dec('eat', 60, 61)], []);
    k.feed([dec('back', 80)], []);
    expect(k.result(peak)).toMatchObject({ result: 'eat', ms: 61, hz: 260 });
  });

  it('no decision: walk at the timeout', () => {
    const k = new Take(50);
    k.feed([], []);
    expect(k.done(50 + TIMEOUT - 1)).toBe(false);
    expect(k.done(50 + TIMEOUT)).toBe(true);
    expect(k.result(peak)).toMatchObject({ result: 'walk', ms: null, hz: 0 });
  });

  it('a hit wins over the decision', () => {
    const k = new Take(0);
    k.feed([], [hit]);
    k.feed([dec('back', 400, null)], []);
    expect(k.result(peak)).toMatchObject({ result: 'hit', ms: null, hz: 140 });
  });

  it('ignores decisions before the take started', () => {
    const k = new Take(100);
    k.feed([dec('back', 90)], []);
    expect(k.result(peak).result).toBe('walk');
  });
});
