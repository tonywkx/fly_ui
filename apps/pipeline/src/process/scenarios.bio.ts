import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { NeuronRecord } from '@fly/data';
import type { Net } from '@fly/sim';
import { beforeAll, describe, expect, test } from 'vitest';
import { loadGraphCache } from '../fetch/graph';
import { buildGraph, orderNeurons, toRecord } from './graph';
import { SCENARIO_RUNS } from './scenarios';
import { buildNet, type RunConfig, runScenario, scenarioRows, typeRates } from './spikes';

// Biology checks on the full CNS graph (pnpm test:bio). Needs data/cache/graph (pnpm graph); skipped without it.
const cache = fileURLToPath(new URL('../../../../data/cache/graph', import.meta.url));

let meta: NeuronRecord[];
let rows: Int32Array;
let net: Net;

/** Runs a scenario over the whole graph (every row recorded); per-type Hz plus whole-graph activity. */
function run(cfg: RunConfig, types: string[]) {
  const { train } = runScenario(net, meta, rows, cfg);
  const hz = typeRates(train, meta, types);
  const rate = (t: string) => hz.get(t) ?? Number.NaN;
  const tail = train.total.slice(-50).reduce((a, b) => a + b, 0);
  return { rate, tail, spiking: new Set(train.ids).size / meta.length };
}

describe.skipIf(!existsSync(cache))('scenario biology (full graph, Shiu LIF)', () => {
  beforeAll(async () => {
    const g = await loadGraphCache(cache);
    const full = buildGraph(orderNeurons(g.neurons.map(toRecord)), g.edges);
    meta = full.meta;
    rows = scenarioRows(meta, meta);
    net = buildNet(full);
  });

  const cfg = (id: string): RunConfig => {
    const r = SCENARIO_RUNS[id];
    if (!r) throw new Error(`no SCENARIO_RUNS.${id}`);
    return r;
  };

  test('looming → Giant Fiber fires and drives TTMn; GF silenced → TTMn loses its drive', () => {
    const intact = run(cfg('escape'), ['DNp01', 'TTMn', 'MN9']);
    expect(intact.rate('DNp01')).toBeGreaterThan(100);
    expect(intact.rate('TTMn')).toBeGreaterThan(100);
    expect(intact.rate('MN9')).toBeLessThan(5);
    const silenced = run({ ...cfg('escape'), silence: ['DNp01'] }, ['DNp01', 'TTMn']);
    expect(silenced.rate('DNp01')).toBe(0);
    expect(silenced.rate('TTMn')).toBeLessThan(0.3 * intact.rate('TTMn'));
  });

  test('sugar → MN9 (proboscis extension), no escape', () => {
    const r = run(cfg('sugar'), ['MN9', 'DNp01']);
    expect(r.rate('MN9')).toBeGreaterThan(50);
    expect(r.rate('DNp01')).toBeLessThan(5);
  });

  test('P1 (pC1) → pIP10 → wing MNs', () => {
    const r = run(cfg('song'), ['pIP10', 'hg1 MN', 'hg3 MN', 'DNp01']);
    expect(r.rate('pIP10')).toBeGreaterThan(20);
    expect(r.rate('hg1 MN')).toBeGreaterThan(20);
    expect(r.rate('hg3 MN')).toBeGreaterThan(20);
    expect(r.rate('DNp01')).toBeLessThan(5);
  });

  test.each(['escape', 'sugar', 'song'])('%s: activity neither dies out nor explodes', (id) => {
    const r = run(cfg(id), []);
    expect(r.tail).toBeGreaterThan(0); // still spiking in the last 50 ms
    expect(r.spiking).toBeLessThan(0.3);
  });
});
