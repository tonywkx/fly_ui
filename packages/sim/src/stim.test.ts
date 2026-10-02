import { describe, expect, it } from 'vitest';
import { LIF_DEFAULTS } from './index';
import { createSim, type Sim } from './lif';
import { netFromEdges } from './net';
import { mulberry32 } from './rng';

const { poissonRate, refractory, dt } = LIF_DEFAULTS;

const spikesOf = (sim: Sim, id: number) => {
  let c = 0;
  for (let k = 0; k < sim.spikes.count; k++) if (sim.spikes.id[k] === id) c++;
  return c;
};

/** 0 → 1 → 2, each hop strong enough to fire the next neuron. */
const chain = () =>
  netFromEdges(3, [
    [0, 1, 60],
    [1, 2, 60],
  ]);

describe('poisson stimulus', () => {
  it('drives an isolated neuron at the dead-time-corrected rate', () => {
    const sim = createSim(netFromEdges(1, []), {}, mulberry32(1));
    sim.stimulate(0);
    sim.run(10_000);
    const expected = poissonRate / (1 + (poissonRate * refractory) / 1000); // ≈112.8 Hz
    expect(sim.spikes.count / 10).toBeGreaterThan(expected * 0.95);
    expect(sim.spikes.count / 10).toBeLessThan(expected * 1.05);
  });

  it('fires in the same step as the kick', () => {
    const sim = createSim(netFromEdges(1, []), {}, mulberry32(3));
    sim.stimulate(0, 1e5); // p ≥ 1: kick every step
    sim.step();
    expect(sim.spikes.count).toBe(1);
    expect(sim.spikes.t[0]).toBeCloseTo(dt, 6);
  });

  it('stops when the rate is set to 0', () => {
    const sim = createSim(netFromEdges(1, []), {}, mulberry32(1));
    sim.stimulate(0);
    sim.run(500);
    sim.stimulate(0, 0);
    const before = sim.spikes.count;
    expect(before).toBeGreaterThan(0);
    sim.run(500);
    expect(sim.spikes.count).toBe(before);
  });
});

describe('silencing', () => {
  it('blocks propagation through a silenced neuron and recovers', () => {
    const sim = createSim(chain(), {}, mulberry32(5));
    sim.stimulate(0);
    sim.silence(1);
    sim.run(1000);
    expect(spikesOf(sim, 0)).toBeGreaterThan(50);
    expect(spikesOf(sim, 1)).toBe(0);
    expect(spikesOf(sim, 2)).toBe(0);
    expect(sim.v[1]).toBe(LIF_DEFAULTS.vRest);
    sim.silence(1, false);
    sim.run(1000);
    expect(spikesOf(sim, 2)).toBeGreaterThan(50);
  });

  it('silences a stimulated neuron', () => {
    const sim = createSim(chain(), {}, mulberry32(5));
    sim.stimulate(0);
    sim.silence(0);
    sim.run(1000);
    expect(sim.spikes.count).toBe(0);
  });
});

describe('determinism', () => {
  const runWith = (seed: number) => {
    const sim = createSim(chain(), {}, mulberry32(seed));
    sim.stimulate(0);
    sim.stimulate(2, 40);
    sim.run(2000);
    const { count, t, id } = sim.spikes;
    return { t: t.slice(0, count), id: id.slice(0, count) };
  };

  it('same seed → identical spike trains, other seed → different', () => {
    const a = runWith(11);
    expect(runWith(11)).toEqual(a);
    expect(runWith(12).t).not.toEqual(a.t);
  });
});

describe('clearSpikes', () => {
  it('empties the log without changing the dynamics', () => {
    const run = (clear: boolean) => {
      const sim = createSim(chain(), {}, mulberry32(3));
      sim.stimulate(0);
      const log: [number, number][] = [];
      const take = () => {
        for (let k = 0; k < sim.spikes.count; k++)
          log.push([sim.spikes.t[k] as number, sim.spikes.id[k] as number]);
      };
      for (let ms = 0; ms < 200; ms += 10) {
        sim.run(10);
        if (!clear) continue;
        take();
        sim.clearSpikes();
        expect(sim.spikes.count).toBe(0);
      }
      if (!clear) take();
      return log;
    };
    const a = run(false);
    expect(a.length).toBeGreaterThan(20);
    expect(run(true)).toEqual(a);
  });
});
