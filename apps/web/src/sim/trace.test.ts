import { createSim, LIF_DEFAULTS, mulberry32, netFromEdges } from '@fly/sim';
import { describe, expect, it } from 'vitest';
import { SpikeLog } from './feed';
import { probe, SPIKE_MV, scenarioNet, voltage } from './trace';

const { dt, vRest, vReset } = LIF_DEFAULTS;

/** 0 → 2 excitatory (sub-threshold), 1 → 2 strong enough to fire it, 3 → 2 inhibitory; 4 → 0 unrelated. */
const toy = () =>
  netFromEdges(5, [
    [0, 2, 10],
    [1, 2, 60],
    [3, 2, -10],
    [4, 0, 1],
  ]);

/** Runs the real sim with the given kicks, recording v[row] after every step and the spikes into a log. */
function reference(row: number, kicks: [step: number, id: number, mV: number][], steps: number) {
  const net = toy();
  const sim = createSim(net, {}, mulberry32(1));
  const v: number[] = [];
  for (let k = 0; k < steps; k++) {
    for (const [s, id, mV] of kicks) if (s === k) sim.inject(id, mV);
    sim.step();
    v.push(sim.v[row] as number);
  }
  const log = new SpikeLog();
  const { count, t, id } = sim.spikes;
  log.push(t.subarray(0, count), id.subarray(0, count), sim.t);
  return { net, v, log };
}

describe('voltage', () => {
  it('matches the sim step by step: PSPs, inhibition, own spike reset and refractory', () => {
    const kicks: [number, number, number][] = [
      [10, 0, 60], // 0 fires → EPSP on 2
      [150, 3, 60], // 3 fires → IPSP
      [300, 1, 60], // 1 fires → 2 fires
      [310, 0, 60],
    ];
    const steps = 1000;
    const { net, v, log } = reference(2, kicks, steps);
    expect(Array.from(log.rows.subarray(0, log.size))).toContain(2);
    const out = voltage(log, probe(net, 2), 0, steps * dt);
    expect(out.x.length).toBe(steps);
    for (let k = 0; k < steps; k++) {
      expect(out.x[k]).toBeCloseTo((k + 1) * dt, 6);
      const t = (k + 1) * dt;
      const fired = Array.from(log.times.subarray(0, log.size)).some(
        (s, i) => log.rows[i] === 2 && Math.abs(s - t) < dt / 2,
      );
      if (fired) expect(out.y[k]).toBe(SPIKE_MV);
      else expect(out.y[k]).toBeCloseTo(v[k] as number, 6);
    }
  });

  it('a window late in the run warms up from earlier history', () => {
    const { net, v, log } = reference(2, [[10, 0, 60]], 600);
    const out = voltage(log, probe(net, 2), 20, 40);
    expect(out.x[0]).toBeGreaterThanOrEqual(20);
    expect(out.x[out.x.length - 1]).toBeCloseTo(40, 6);
    const k = Math.round((out.x[0] as number) / dt) - 1;
    expect(out.y[0]).toBeCloseTo(v[k] as number, 6);
    expect(out.y[0]).toBeGreaterThan(vRest);
  });

  it('stays at rest without input spikes', () => {
    const { net, log } = reference(2, [[10, 4, 60]], 300);
    const out = voltage(log, probe(net, 2), 0, 30);
    expect(Array.from(out.y).every((y) => y === vRest)).toBe(true);
  });

  it('holds reset through the refractory period after its own spike', () => {
    const log = new SpikeLog();
    log.push([5], [2], 20);
    const out = voltage(log, probe(toy(), 2), 0, 20);
    const at = Math.round(5 / dt) - 1;
    expect(out.y[at]).toBe(SPIKE_MV);
    expect(out.y[at + 1]).toBe(vReset);
    expect(out.y[at + Math.round(LIF_DEFAULTS.refractory / dt)]).toBe(vReset);
  });

  it('reuses the output buffers', () => {
    const { net, log } = reference(2, [[10, 0, 60]], 300);
    const p = probe(net, 2);
    const a = voltage(log, p, 0, 20);
    const b = voltage(log, p, 10, 20);
    expect(b.y.buffer).toBe(a.y.buffer);
  });
});

describe('scenarioNet', () => {
  const csr = {
    offsets: Uint32Array.from([0, 1, 2, 2]),
    cols: Uint32Array.from([1, 2]),
    weight: Uint16Array.from([3, 5]),
  };
  const sign = Int8Array.from([1, -1, 1]);

  it('signs weights by the presynaptic transmitter and applies overrides that have edges', () => {
    const net = scenarioNet(csr, sign, ['DNp01', 'X', 'TTMn']);
    expect(net.w[0]).toBeCloseTo(3 * LIF_DEFAULTS.wSyn, 6);
    expect(net.w[1]).toBeCloseTo(-5 * LIF_DEFAULTS.wSyn, 6);
    const gf = scenarioNet(csr, sign, ['X', 'DNp01', 'TTMn']);
    expect(gf.w[1]).toBe(40);
  });

  it('skips overrides whose types are not in the scenario', () => {
    expect(() => scenarioNet(csr, sign, ['A', 'B', 'C'])).not.toThrow();
  });
});
