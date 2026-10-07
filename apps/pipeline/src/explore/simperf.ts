import { fileURLToPath } from 'node:url';
import { createSim, mulberry32, resolveGroups, SENSE_HZ, SENSES } from '@fly/sim';
import { loadGraphCache } from '../fetch/graph';
import { buildGraph, orderNeurons, toRecord } from '../process/graph';
import { buildNet } from '../process/spikes';

// 8.15: sim speed (sim ms per wall s) per sensed input, plus the load behind it. Prints a table.
const MS = 2000;
const cache = fileURLToPath(new URL('../../../../data/cache/graph', import.meta.url));
const g = await loadGraphCache(cache);
const full = buildGraph(orderNeurons(g.neurons.map(toRecord)), g.edges);
const net = buildNet(full);
const groups = resolveGroups(
  { types: full.meta.map((r) => r.type), sides: full.meta.map((r) => r.somaSide) },
  SENSES,
);
console.log(`n=${net.n} edges=${net.cols.length}`);
console.log('input | sim ms/s | spikes/s | mean active | fan-out/s');
for (const k of ['none', ...Object.keys(SENSES)] as const) {
  const sim = createSim(net, {}, mulberry32(1));
  const rows = k === 'none' ? [] : groups[k as keyof typeof SENSES].all;
  for (const i of rows) sim.stimulate(i, SENSE_HZ);
  sim.run(200); // warm up
  sim.clearSpikes();
  let act = 0;
  let fan = 0;
  const steps = MS / sim.p.dt;
  const t0 = performance.now();
  for (let s = 0; s < steps; s++) {
    sim.step();
    act += sim.activeCount;
  }
  const wall = performance.now() - t0;
  for (let s = 0; s < sim.spikes.count; s++) {
    const i = sim.spikes.id[s] as number;
    fan += (net.offsets[i + 1] as number) - (net.offsets[i] as number);
  }
  const sec = MS / 1000;
  console.log(
    `${k} (${rows.length}) | ${((MS / wall) * 1000).toFixed(0)} | ${(sim.spikes.count / sec).toFixed(0)} | ${(act / steps).toFixed(0)} | ${(fan / sec).toFixed(0)}`,
  );
}
