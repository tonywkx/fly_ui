import { describe, expect, it } from 'vitest';
import { blink, blinkRatio, scaleLine } from './scale';

describe('latency → blink', () => {
  it('the ratio is a lower bound against a 100 ms blink', () => {
    expect(blinkRatio(8)).toBe(12);
    expect(blinkRatio(22)).toBe(4);
    expect(blinkRatio(35)).toBe(2);
    expect(blinkRatio(50)).toBe(2);
  });

  it('bands: faster ≤ 50 ms, about a blink up to 400 ms, nothing past it', () => {
    expect(blink(50, 'ru')).toBe('в 2 раза быстрее моргания');
    expect(blink(51, 'ru')).toBe('примерно как моргание');
    expect(blink(400, 'ru')).toBe('примерно как моргание');
    expect(blink(401, 'ru')).toBeNull();
    expect(blink(null, 'ru')).toBeNull();
    expect(blink(0, 'ru')).toBeNull();
  });

  it('ru plurals: «раза» for 2–4 and 22–24, «раз» otherwise', () => {
    expect(blink(25, 'ru')).toBe('в 4 раза быстрее моргания');
    expect(blink(8, 'ru')).toBe('в 12 раз быстрее моргания');
    expect(blink(4.7, 'ru')).toBe('в 21 раз быстрее моргания');
    expect(blink(4.5, 'ru')).toBe('в 22 раза быстрее моргания');
    expect(blink(4, 'ru')).toBe('в 25 раз быстрее моргания');
  });

  it('en', () => {
    expect(blink(8, 'en')).toBe('12× faster than a blink');
    expect(blink(61, 'en')).toBe('about a blink');
  });

  it('the line: number, then the comparison; none past 400 ms', () => {
    expect(scaleLine(8, 'ru')).toBe('8\u00a0мс — в 12 раз быстрее моргания');
    expect(scaleLine(61, 'en')).toBe('61\u00a0ms — about a blink');
    expect(scaleLine(500, 'en')).toBeNull();
  });
});
