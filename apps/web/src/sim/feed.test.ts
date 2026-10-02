import { decodeSpikes, encodeSpikes, spikeTrainFrom } from '@fly/data';
import { describe, expect, it } from 'vitest';
import { bakedEvents, NEVER, nextSimTime, SpikeFeed } from './feed';

const fresh = (n: number) => new Float32Array(n).fill(NEVER);

describe('SpikeFeed', () => {
  it('drains events up to a time into lastSpike, in order', () => {
    const feed = new SpikeFeed(4);
    feed.push([1, 2, 2.5, 7], [0, 1, 0, 2], 10);
    const out = fresh(3);
    expect(feed.drain(2.5, out)).toBe(true);
    expect([...out]).toEqual([2.5, 2, NEVER]);
    expect(feed.pending).toBe(1);
    expect(feed.drain(5, out)).toBe(false);
    expect(feed.drain(10, out)).toBe(true);
    expect(out[2]).toBe(7);
    expect(feed.pending).toBe(0);
    expect(feed.until).toBe(10);
  });

  it('wraps and grows past its capacity without losing order', () => {
    const feed = new SpikeFeed(2);
    const out = fresh(8);
    feed.push([1, 2], [0, 1], 2);
    feed.drain(1, out); // head moves: next push wraps
    feed.push([3, 4, 5, 6], [2, 3, 4, 5], 6);
    expect(feed.pending).toBe(5);
    feed.drain(6, out);
    expect([...out.subarray(0, 6)]).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('reset drops pending events and the horizon', () => {
    const feed = new SpikeFeed();
    feed.push([1], [0], 5);
    feed.reset();
    expect(feed.pending).toBe(0);
    expect(feed.until).toBe(0);
  });
});

describe('bakedEvents', () => {
  it('turns a binned train back into time-ordered (t, row) events', () => {
    // dt 0.1, 1 ms bins: steps 3, 15, 15, 27 → t 0.3, 1.5, 1.5, 2.7
    const train = decodeSpikes(
      encodeSpikes(
        spikeTrainFrom(
          { count: 4, t: [0.3, 1.5, 1.5, 2.7], id: [5, 2, 1, 5] },
          Int32Array.from([-1, 0, 1, -1, -1, 2]),
          { n: 3, seed: 1, dt: 0.1, durationMs: 3, binMs: 1, stim: [] },
        ),
      ),
    );
    const ev = bakedEvents(train);
    expect([...ev.row]).toEqual([2, 0, 1, 2]);
    expect([...ev.t].map((t) => +t.toFixed(4))).toEqual([0.3, 1.5, 1.5, 2.7]);
    expect(ev.until).toBe(3);
  });
});

describe('nextSimTime', () => {
  it('advances at the playback rate, never past the data horizon', () => {
    expect(nextSimTime(10, 16, 40, 100)).toBeCloseTo(10.64);
    expect(nextSimTime(99.9, 16, 40, 100)).toBe(100);
  });

  it('clamps long frame gaps (hidden tab) to one step', () => {
    expect(nextSimTime(0, 5000, 40, 1e9)).toBeCloseTo(4); // 100 ms real max
  });
});
