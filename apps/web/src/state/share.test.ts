import { describe, expect, it } from 'vitest';
import { decodeExperiment, encodeExperiment, type SharedExperiment, shareSearch } from './share';

const gf: SharedExperiment = { stimulated: [], silenced: [10001], stim: { hz: 150, gain: 1 } };

describe('experiment codec', () => {
  it('round-trips stimuli, silencing and drive', () => {
    const e: SharedExperiment = {
      stimulated: [2 ** 50 + 3, 5, 12345678901],
      silenced: [10001, 10002],
      stim: { hz: 230, gain: 1.35 },
    };
    expect(decodeExperiment(encodeExperiment(e))).toEqual({
      stimulated: [5, 12345678901, 2 ** 50 + 3],
      silenced: [10001, 10002],
      stim: { hz: 230, gain: 1.35 },
    });
  });

  it('round-trips an empty experiment', () => {
    const e: SharedExperiment = { stimulated: [], silenced: [], stim: { hz: 150, gain: 1 } };
    expect(decodeExperiment(encodeExperiment(e))).toEqual(e);
  });

  it('keeps bodyIds above 2^32 exact', () => {
    const big = 2 ** 40 + 7;
    const e = { ...gf, stimulated: [big, big + 1] };
    expect(decodeExperiment(encodeExperiment(e))?.stimulated).toEqual([big, big + 1]);
  });

  it('sorts and dedupes ids, so equal experiments give equal codes', () => {
    const a = encodeExperiment({ ...gf, stimulated: [3, 1, 2, 2] });
    const b = encodeExperiment({ ...gf, stimulated: [1, 2, 3] });
    expect(a).toBe(b);
    expect(decodeExperiment(a)?.stimulated).toEqual([1, 2, 3]);
  });

  it('is url-safe and compact', () => {
    const ids = Array.from({ length: 10 }, (_, i) => 10_000 + i * 37);
    const code = encodeExperiment({ ...gf, stimulated: ids.slice(0, 5), silenced: ids.slice(5) });
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(code.length).toBeLessThanOrEqual(40);
    expect(encodeExperiment(gf).length).toBeLessThanOrEqual(12);
  });

  it('rounds the drive to slider precision and clamps it to the slider range', () => {
    const code = encodeExperiment({ ...gf, stim: { hz: 1000.4, gain: 0.123 } });
    expect(decodeExperiment(code)?.stim).toEqual({ hz: 400, gain: 0.25 });
  });

  it('rejects garbage, truncated input, trailing bytes and unknown versions', () => {
    const code = encodeExperiment({ ...gf, stimulated: [7, 9] });
    for (const bad of ['', '!!', 'a', code.slice(0, -2), `${code}AA`, 'Ag', 'AJYBZAA'])
      expect(decodeExperiment(bad), bad).toBeNull();
  });
});

describe('shareSearch', () => {
  it('lists only what is set, in a stable order', () => {
    expect(shareSearch({ scenario: 'escape' })).toBe('?scenario=escape');
    expect(shareSearch({ scenario: 'escape', x: 'AZYBZAEB0U4', probes: [10001, 7], color: 'region' })).toBe(
      '?scenario=escape&x=AZYBZAEB0U4&probes=10001,7&color=region',
    );
  });
});
