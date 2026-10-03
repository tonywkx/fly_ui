import { decodeSpikes, encodeSpikes, spikeTrainFrom } from '@fly/data';
import { describe, expect, it } from 'vitest';
import { bakedEvents, LOOKBACK_MS, NEVER, nextSimTime, SpikeLog } from './feed';

const fresh = (n: number) => new Float32Array(n).fill(NEVER);

describe('SpikeLog', () => {
  it('applies the events of (from, to] into lastSpike, in order', () => {
    const log = new SpikeLog(4);
    log.push([1, 2, 2.5, 7], [0, 1, 0, 2], 10);
    const out = fresh(3);
    expect(log.apply(0, 2.5, out)).toBe(true);
    expect([...out]).toEqual([2.5, 2, NEVER]);
    expect(log.apply(2.5, 5, out)).toBe(false);
    expect(log.apply(5, 10, out)).toBe(true);
    expect(out[2]).toBe(7);
    expect(log.until).toBe(10);
    expect(log.size).toBe(4);
  });

  it('keeps every event: the same span can be applied again', () => {
    const log = new SpikeLog();
    log.push([1, 2], [0, 1], 2);
    const a = fresh(2);
    const b = fresh(2);
    log.apply(0, 2, a);
    log.apply(0, 2, b);
    expect([...a]).toEqual([...b]);
  });

  it('seek rebuilds lastSpike at any time, backwards or forwards', () => {
    const log = new SpikeLog();
    log.push([1, 5, 400, 600], [0, 0, 1, 0], 700);
    const out = fresh(2);
    log.seek(650, out);
    expect([...out]).toEqual([600, 400]);
    log.seek(3, out);
    expect([...out]).toEqual([1, NEVER]);
    // spikes older than the look-back have faded: left at NEVER
    log.seek(5 + LOOKBACK_MS + 1, out);
    expect([...out]).toEqual([NEVER, NEVER]);
    log.seek(0, out);
    expect([...out]).toEqual([NEVER, NEVER]);
  });

  it('includes events exactly at the seek time', () => {
    const log = new SpikeLog();
    log.push([0, 0], [0, 1], 1);
    const out = fresh(2);
    log.seek(0, out);
    expect([...out]).toEqual([0, 0]);
  });

  it('span gives the index range of (from, to]', () => {
    const log = new SpikeLog();
    log.push([1, 2, 2, 3], [0, 1, 2, 3], 3);
    const [i0, i1] = log.span(1, 2);
    expect([...log.rows.subarray(i0, i1)]).toEqual([1, 2]);
    expect(log.span(-1, 0)).toEqual([0, 0]);
  });

  it('trim drops history before a time and keeps later pushes ordered', () => {
    const log = new SpikeLog(2);
    log.push([1, 2, 3], [0, 1, 2], 3);
    log.trim(2);
    expect(log.start).toBe(2);
    expect(log.size).toBe(2);
    log.push([4, 5, 6], [3, 4, 5], 6); // compacts and grows
    const [i0, i1] = log.span(-Infinity, 6);
    expect([...log.times.subarray(i0, i1)]).toEqual([2, 3, 4, 5, 6]);
    const out = fresh(6);
    log.seek(6, out);
    expect(out[0]).toBe(NEVER); // trimmed
    expect([...out.subarray(1)]).toEqual([2, 3, 4, 5, 6]);
  });

  it('reset drops events and the horizon', () => {
    const log = new SpikeLog();
    log.push([1], [0], 5);
    log.trim(1);
    log.reset();
    expect(log.size).toBe(0);
    expect(log.until).toBe(0);
    expect(log.start).toBe(0);
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
