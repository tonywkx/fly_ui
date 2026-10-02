import { describe, expect, test } from 'vitest';
import { decodeChunk, encodeChunk } from './container';
import { decodeSpikes, encodeSpikes, type SpikeTrain, spikeTrainFrom } from './spikes';

const opts = { n: 3, dt: 0.1, durationMs: 2, binMs: 1, seed: 7, stim: [0] };
const events = (t: number[], id: number[]) => ({
  count: t.length,
  t: Float32Array.from(t),
  id: Uint32Array.from(id),
});
// sim ids 0..4 → scenario rows -, 0, 2, -, 1 (-1 = outside the scenario)
const rowOf = Int32Array.from([-1, 0, 2, -1, 1]);

describe('spikeTrainFrom', () => {
  test('bins by step, maps rows, sorts by (sub, row), counts everything in total', () => {
    const s = spikeTrainFrom(events([0.3, 0.3, 0.1, 1.5, 0.3, 2.0], [2, 1, 4, 3, 0, 4]), rowOf, opts);
    // steps: 3,3,1,15,3,20 → bins 0,0,0,1,0,2 (21 steps → 3 bins of 10)
    expect(Array.from(s.offsets)).toEqual([0, 3, 3, 4]);
    expect(Array.from(s.sub)).toEqual([1, 3, 3, 0]);
    expect(Array.from(s.ids)).toEqual([1, 0, 2, 1]);
    expect(Array.from(s.total)).toEqual([4, 1, 1]);
    expect(s.ids).toBeInstanceOf(Uint16Array);
    expect(Array.from(s.stim)).toEqual([0]);
  });

  test('ignores events past the duration and only counts valid count', () => {
    const e = events([0.5, 9, 0.2], [1, 1, 1]);
    e.count = 2;
    const s = spikeTrainFrom(e, rowOf, opts);
    expect(Array.from(s.total)).toEqual([1, 0, 0]);
    expect(s.ids.length).toBe(1);
  });

  test('uses u32 ids for more than 65536 rows', () => {
    const n = 70_000;
    const map = Int32Array.from([69_999]);
    const s = spikeTrainFrom(events([0.1], [0]), map, { ...opts, n });
    expect(s.ids).toBeInstanceOf(Uint32Array);
    expect(decodeSpikes(encodeSpikes(s)).ids[0]).toBe(69_999);
  });
});

describe('spikes chunk', () => {
  const train = (): SpikeTrain => spikeTrainFrom(events([0.3, 0.1, 1.5, 2.0], [2, 4, 1, 4]), rowOf, opts);

  test('roundtrips', () => {
    const a = train();
    const b = decodeSpikes(encodeSpikes(a));
    expect(b.n).toBe(3);
    expect(b.seed).toBe(7);
    expect(b.dt).toBeCloseTo(0.1, 6);
    expect(b.durationMs).toBe(2);
    expect(b.binMs).toBe(1);
    for (const k of ['offsets', 'ids', 'sub', 'total', 'stim'] as const)
      expect(Array.from(b[k])).toEqual(Array.from(a[k]));
  });

  test('roundtrips an empty train', () => {
    const s = spikeTrainFrom(events([], []), rowOf, { ...opts, stim: [] });
    const b = decodeSpikes(encodeSpikes(s));
    expect(Array.from(b.offsets)).toEqual([0, 0, 0, 0]);
    expect(b.ids.length).toBe(0);
    expect(b.stim.length).toBe(0);
  });

  test('rejects invalid trains', () => {
    const bad = (f: (s: SpikeTrain) => void) => {
      const s = train();
      f(s);
      return () => encodeSpikes(s);
    };
    expect(bad((s) => (s.ids[0] = 3))).toThrow(/row/);
    expect(bad((s) => (s.sub[0] = 10))).toThrow(/sub/);
    expect(bad((s) => (s.offsets[1] = 5))).toThrow(/offsets/);
    expect(bad((s) => (s.stim = Uint32Array.from([3])))).toThrow(/stim/);
    expect(bad((s) => (s.total = new Uint32Array(1)))).toThrow(/bins/);
  });

  test('rejects another chunk kind', () => {
    expect(() => decodeSpikes(encodeChunk('graph', [new Uint32Array(1)]))).toThrow(/spikes/);
  });

  test('stores ids, sub and stim as typed sections', () => {
    const { kind, sections } = decodeChunk(encodeSpikes(train()));
    expect(kind).toBe('spikes');
    expect(sections.map((s) => s.constructor.name)).toEqual([
      'Float32Array',
      'Uint32Array',
      'Uint32Array',
      'Uint16Array',
      'Uint8Array',
      'Uint32Array',
      'Uint32Array',
    ]);
  });
});
