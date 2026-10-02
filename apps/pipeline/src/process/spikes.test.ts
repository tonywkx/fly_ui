import type { NeuronRecord } from '@fly/data';
import { netFromEdges } from '@fly/sim';
import { describe, expect, test } from 'vitest';
import { runScenario, scenarioRows, typeRates } from './spikes';

const rec = (bodyId: number, type: string): NeuronRecord => ({
  bodyId,
  type,
  class: null,
  superclass: null,
  nt: null,
  ntConf: null,
  sign: 1,
  region: null,
  somaSide: null,
  maleSpecific: false,
});

// chain S → A → X → C, each hop strong enough to fire the next; X is outside the scenario
const full = [rec(10, 'S'), rec(11, 'A'), rec(12, 'X'), rec(13, 'C')];
const scenario = [full[0], full[1], full[3]] as NeuronRecord[];
const net = netFromEdges(4, [
  [0, 1, 60],
  [1, 2, 60],
  [2, 3, 60],
]);
const rows = scenarioRows(full, scenario);
const cfg = { stimTypes: ['S'], hz: 150, durationMs: 50, seed: 1, binMs: 1 };

describe('scenarioRows', () => {
  test('maps full rows to scenario rows by bodyId, −1 outside', () => {
    expect(Array.from(scenarioRows(full, scenario))).toEqual([0, 1, -1, 2]);
  });
});

describe('runScenario', () => {
  test('stimulates the type, records scenario spikes, counts outside spikes in total', () => {
    const { train, stats } = runScenario(net, full, rows, cfg);
    expect(Array.from(train.stim)).toEqual([0]);
    expect(train.n).toBe(3);
    expect(new Set(train.ids)).toEqual(new Set([0, 1, 2]));
    const total = train.total.reduce((a, b) => a + b, 0);
    expect(stats.spikes).toBe(total);
    expect(total).toBeGreaterThan(train.ids.length); // X's spikes are only in total
    expect(stats.peakActive).toBeGreaterThan(0);
  });

  test('is deterministic per seed', () => {
    const a = runScenario(net, full, rows, cfg).train;
    const b = runScenario(net, full, rows, cfg).train;
    const c = runScenario(net, full, rows, { ...cfg, seed: 2 }).train;
    expect(Array.from(b.ids)).toEqual(Array.from(a.ids));
    expect(Array.from(b.sub)).toEqual(Array.from(a.sub));
    expect(Array.from(c.sub)).not.toEqual(Array.from(a.sub));
  });

  test('silenced types (also outside the scenario) block the chain', () => {
    const { train } = runScenario(net, full, rows, { ...cfg, silence: ['X'] });
    expect(new Set(train.ids)).toEqual(new Set([0, 1]));
  });

  test('throws when no scenario neuron has a stimulus type', () => {
    expect(() => runScenario(net, full, rows, { ...cfg, stimTypes: ['X'] })).toThrow(/no neurons/);
  });
});

describe('typeRates', () => {
  test('mean rate per type in Hz', () => {
    const { train } = runScenario(net, full, rows, cfg);
    const r = typeRates(train, scenario, ['S', 'C', 'missing']);
    expect(r.get('S')).toBeGreaterThan(50);
    expect(r.get('C')).toBeGreaterThan(0);
    expect(r.has('missing')).toBe(false);
  });
});
