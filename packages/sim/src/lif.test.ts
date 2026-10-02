import { describe, expect, it } from 'vitest';
import { LIF_DEFAULTS } from './index';
import { createSim, type Sim } from './lif';
import { netFromEdges } from './net';

const { vRest, tauMembrane: tm, tauSyn: ts, delay, refractory, dt } = LIF_DEFAULTS;

/** PSP of a single g kick w at t=0 (u = v - vRest), analytic solution of the LIF ODE pair. */
const psp = (w: number, t: number) => ((w * ts) / (tm - ts)) * (Math.exp(-t / tm) - Math.exp(-t / ts));

const spikesOf = (sim: Sim, id: number) => {
  const out: number[] = [];
  for (let k = 0; k < sim.spikes.count; k++) if (sim.spikes.id[k] === id) out.push(sim.spikes.t[k] as number);
  return out;
};

describe('lif', () => {
  it('stays at rest without input', () => {
    const sim = createSim(netFromEdges(3, [[0, 1, 100]]));
    sim.run(100);
    expect(sim.spikes.count).toBe(0);
    expect([...sim.v]).toEqual([vRest, vRest, vRest]);
    expect(sim.t).toBeCloseTo(100, 9);
  });

  it('integrates a subthreshold kick exactly (analytic PSP)', () => {
    const sim = createSim(netFromEdges(1, []));
    sim.inject(0, 40);
    let peak = 0;
    for (let k = 1; k <= 400; k++) {
      sim.step();
      const u = (sim.v[0] as number) - vRest;
      expect(u).toBeCloseTo(psp(40, k * dt), 3);
      peak = Math.max(peak, u);
    }
    expect(peak).toBeCloseTo(40 * 0.1575, 2);
    expect(sim.spikes.count).toBe(0);
  });

  it('spikes only above threshold', () => {
    const below = createSim(netFromEdges(1, []));
    below.inject(0, 40); // peak ≈ 6.3 mV < 7
    below.run(50);
    expect(below.spikes.count).toBe(0);

    const above = createSim(netFromEdges(1, []));
    above.inject(0, 50); // peak ≈ 7.9 mV > 7
    above.run(50);
    expect(above.spikes.count).toBe(1);
    expect(above.v[0]).toBeLessThan(LIF_DEFAULTS.vThreshold);
  });

  it('propagates along a 3-chain with the synaptic delay', () => {
    const sim = createSim(
      netFromEdges(3, [
        [0, 1, 60],
        [1, 2, 60],
      ]),
    );
    sim.inject(0, 60);
    sim.run(50);
    const [a, b, c] = [spikesOf(sim, 0), spikesOf(sim, 1), spikesOf(sim, 2)];
    expect([a.length, b.length, c.length]).toEqual([1, 1, 1]);
    const [ta, tb, tc] = [a[0] as number, b[0] as number, c[0] as number];
    expect(tb - ta).toBeGreaterThan(delay);
    // same kick → same rise time: hop latency = delay + rise from the kick
    expect(tb - ta).toBeCloseTo(delay + ta, 4);
    expect(tc - tb).toBeCloseTo(tb - ta, 4);
    expect(sim.lastSpike[2]).toBeCloseTo(tc, 6);
  });

  it('cancels excitation with simultaneous inhibition', () => {
    const edges: [number, number, number][] = [
      [0, 2, 60],
      [1, 2, -60],
    ];
    const exc = createSim(netFromEdges(3, edges));
    exc.inject(0, 60);
    exc.run(50);
    expect(spikesOf(exc, 2)).toHaveLength(1);

    const both = createSim(netFromEdges(3, edges));
    both.inject(0, 60);
    both.inject(1, 60);
    both.run(50);
    expect(spikesOf(both, 0)).toHaveLength(1);
    expect(spikesOf(both, 1)).toHaveLength(1);
    expect(spikesOf(both, 2)).toHaveLength(0);
    expect(both.v[2]).toBeCloseTo(vRest, 6);
  });

  it('respects the refractory period under strong drive', () => {
    const sim = createSim(netFromEdges(1, []));
    for (let k = 0; k < 1000; k++) {
      sim.inject(0, 50);
      sim.step();
    }
    const t = spikesOf(sim, 0);
    expect(t.length).toBeGreaterThan(10);
    for (let k = 1; k < t.length; k++)
      expect((t[k] as number) - (t[k - 1] as number)).toBeGreaterThanOrEqual(refractory - 1e-4);
  });

  it('drops quiet neurons from the active set and snaps them to rest', () => {
    const sim = createSim(netFromEdges(2, [[0, 1, 10]]));
    sim.inject(0, 40);
    sim.inject(1, 10);
    expect(sim.activeCount).toBe(2);
    sim.run(500);
    expect(sim.activeCount).toBe(0);
    expect([...sim.v]).toEqual([vRest, vRest]);
    expect([...sim.g]).toEqual([0, 0]);
  });

  it('is deterministic', () => {
    const edges: [number, number, number][] = [];
    let s = 1;
    const rnd = () => {
      s = (Math.imul(s, 1103515245) + 12345) >>> 0;
      return s / 2 ** 32;
    };
    for (let e = 0; e < 400; e++)
      edges.push([Math.floor(rnd() * 50), Math.floor(rnd() * 50), (rnd() - 0.3) * 60]);
    const go = () => {
      const sim = createSim(netFromEdges(50, edges));
      for (let i = 0; i < 10; i++) sim.inject(i, 80);
      sim.run(200);
      return sim;
    };
    const a = go();
    const b = go();
    expect(a.spikes.count).toBeGreaterThan(10);
    expect(b.spikes.count).toBe(a.spikes.count);
    expect([...b.spikes.t.subarray(0, b.spikes.count)]).toEqual([...a.spikes.t.subarray(0, a.spikes.count)]);
    expect([...b.spikes.id.subarray(0, b.spikes.count)]).toEqual([
      ...a.spikes.id.subarray(0, a.spikes.count),
    ]);
  });
});
