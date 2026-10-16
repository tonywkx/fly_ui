import { describe, expect, it } from 'vitest';
import { NORM } from '../scene/dish/table';
import type { Outcome } from '../state/trial';
import {
  betLine,
  cellPath,
  foundLine,
  headline,
  nowLine,
  opChip,
  picksText,
  scaleRow,
  usualLine,
} from './expText';

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

  it('a discovery tile: what came out of the first run, with its numbers', () => {
    const e = { bet: null, ms: null, hz: 0 };
    expect(foundLine({ ...e, result: 'hit', hz: 44.4 }, { stim: 'swatter', op: 'panic' })).toBe(
      'не успела взлететь · TTMn 44 Гц',
    );
    expect(foundLine({ ...e, result: 'eat', ms: 61, hz: 259 }, { stim: 'sugar', op: 'none' })).toBe(
      'поела через 61 мс · MN9 259 Гц',
    );
    expect(foundLine({ ...e, result: 'walk' }, { stim: 'female', op: 'p1' })).toBe('не заметил · pIP10 0 Гц');
    expect(foundLine({ ...e, result: 'walk' }, { stim: 'none', op: 'none' })).toBe('ничего не сделала');
  });

  it('the cells of a discovery: the stimulus path, the operated cell marked or added', () => {
    expect(cellPath({ stim: 'shadow', op: 'panic' })).toEqual([
      { cell: 'LC4' },
      { cell: 'DNp01', mode: 'off' },
      { cell: 'TTMn' },
    ]);
    expect(cellPath({ stim: 'sugar', op: 'none' })).toEqual([{ cell: 'LB3' }, { cell: 'MN9' }]);
    expect(cellPath({ stim: 'sugar', op: 'moon' })).toEqual([
      { cell: 'LB3' },
      { cell: 'MN9' },
      { cell: 'MDN', mode: 'on', extra: true },
    ]);
    expect(cellPath({ stim: 'none', op: 'moon' })).toEqual([{ cell: 'MDN', mode: 'on', extra: true }]);
  });

  it('the scale line sits under the row with the number: сейчас first, else обычно', () => {
    const same = outcome({ pair: { stim: 'sugar', op: 'none' }, result: 'eat', ms: 61, hz: 259 });
    expect(scaleRow(same)).toEqual({ row: 'now', ms: 61 });
    const hit = outcome({ pair: { stim: 'swatter', op: 'panic' }, result: 'hit' });
    expect(scaleRow(hit)).toEqual({ row: 'usual', ms: 24 });
    // a decision of its own: its latency, even off the norm
    expect(scaleRow(outcome({ pair: { stim: 'bitter', op: 'moon' }, result: 'back', ms: 2 }))).toEqual({
      row: 'now',
      ms: 2,
    });
    expect(scaleRow(outcome({ pair: { stim: 'none', op: 'moon' }, result: 'back' }))).toBeNull();
  });

  it('brain picks read as their non-zero parts', () => {
    expect(picksText({ off: 2, on: 0 })).toBe('выкл. 2');
    expect(picksText({ off: 0, on: 1 })).toBe('вкл. 1');
    expect(picksText({ off: 3, on: 1 })).toBe('выкл. 3 · вкл. 1');
  });

  it('the slot chip: a glyph and the object with its switch', () => {
    expect(opChip('none', null)).toEqual({ glyph: '○', text: 'Ничего, обычная муха' });
    expect(opChip('panic', null)).toEqual({ glyph: '⊘', text: 'нейрон бегства · выкл.' });
    expect(opChip('moon', null)).toEqual({ glyph: '●', text: 'нейрон заднего хода · вкл.' });
    expect(opChip('brain', { off: 2, on: 0 })).toEqual({ glyph: '⊘', text: 'клетки из мозга · выкл. 2' });
    expect(opChip('brain', { off: 0, on: 1 })).toEqual({ glyph: '●', text: 'клетки из мозга · вкл. 1' });
    expect(opChip('brain', null)).toEqual({ glyph: '○', text: 'Ничего, обычная муха' });
  });
});
