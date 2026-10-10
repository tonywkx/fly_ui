import { describe, expect, it } from 'vitest';
import { NORM } from '../scene/dish/table';
import type { Outcome } from '../state/trial';
import { betLine, headline, nowLine, usualLine } from './expText';

const peak = { jump: 0, back: 0, eat: 0, court: 0, gate: 0 };

const outcome = (o: Partial<Outcome> & Pick<Outcome, 'pair' | 'result'>): Outcome => ({
  ms: null,
  hz: 0,
  peak,
  norm: NORM[o.pair.stim].none,
  bet: null,
  first: true,
  unlocked: null,
  ...o,
});

describe('experiment card text (ru)', () => {
  it('the norm row: verb, latency and the deciding command', () => {
    expect(usualLine(NORM.swatter.none)).toMatch(/^взлетает через \d+ мс · TTMn \d+ Гц$/);
    expect(usualLine(NORM.none.none)).toBe('идёт дальше');
  });

  it('swatter × DNp01 off: hit, the norm command read from the peaks', () => {
    const o = outcome({
      pair: { stim: 'swatter', op: 'panic' },
      result: 'hit',
      peak: { ...peak, jump: 44.4 },
      bet: 'jump',
    });
    expect(headline(o)).toBe('Не успела взлететь');
    expect(nowLine(o)).toBe('не успела взлететь · TTMn 44 Гц');
    expect(betLine(o)).toBe('взлетит · вышло иначе');
  });

  it('same as the norm: the now row says so; a right bet', () => {
    const o = outcome({ pair: { stim: 'sugar', op: 'none' }, result: 'eat', ms: 61, hz: 259, bet: 'eat' });
    expect(headline(o)).toBe('Поела');
    expect(nowLine(o)).toBe('так же, как обычно · через 61 мс · MN9 259 Гц');
    expect(betLine(o)).toBe('поест · так и вышло');
  });

  it('the female flips the subject; no bet, no bet line', () => {
    const o = outcome({ pair: { stim: 'female', op: 'p1' }, result: 'walk' });
    expect(headline(o)).toBe('Не заметил');
    expect(nowLine(o)).toBe('не заметил · pIP10 0 Гц');
    expect(betLine(o)).toBeNull();
  });
});
