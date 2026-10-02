import { when } from 'mobx';
import { useEffect, useRef } from 'react';
import { data } from '@/data/store';
import { app } from '@/state/app';
import { bfsOnsets, cycleMs, jitter, seedRows, writeSpikes } from './activity';
import { Engine } from './engine';
import { CloudLayer } from './layers/cloud';
import { isColorMode, neuronsLayer } from './layers/neurons';
import { shellsLayer } from './layers/shells';
import { buildSegments } from './segments';

/** Frames rendered with content before the scene counts as drawn (snap readiness). */
const SETTLE_FRAMES = 2;
/** Fake activity: sensory types the wave starts from, per scenario (others: no activity yet). */
const SEED_TYPES: Record<string, readonly string[]> = { escape: ['LPLC2', 'LC4'] };
/** Sim ms per synaptic hop, playback speed (sim ms per real s), pause after the last onset (sim ms). */
const HOP_MS = 6;
const SIM_MS_PER_S = 40;
const TAIL_MS = 60;
/** Spread of onsets per neuron (a looming stimulus recruits LPLC2/LC4 over several ms). */
const JITTER_MS = 12;

/** Mount point for the renderer. The engine owns the canvas; React only creates and disposes it. */
export function Stage() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const engine = new Engine(el, {
      forceWebGL: app.params.gl === 'webgl2',
      reducedMotion: app.reducedMotion,
    });
    let stopWhen: (() => void) | undefined;

    engine
      .init()
      .then((backend) => {
        if (engine.disposed) return;
        app.setBackend(backend);
        stopWhen = when(
          () => data.ready,
          () => populate(engine),
        );
      })
      .catch((e) => {
        console.error('[scene]', e);
        app.markReady('frame');
      });

    return () => {
      stopWhen?.();
      engine.dispose();
    };
  }, []);

  return <div ref={host} id="stage" className="absolute inset-0" />;
}

function populate(engine: Engine) {
  const m = data.manifest;
  if (!m) throw new Error('manifest missing');
  const chunk = (kind: 'cloud' | 'neuropil', id: string) => {
    const c = m.chunks.find((e) => e.id === id && e.kind === kind);
    if (!c) throw new Error(`${id} missing from manifest`);
    return c;
  };
  const shells = data.get(chunk('neuropil', 'neuropil-shells').id, 'neuropil');
  const lod0 = data.get(chunk('cloud', 'cloud-lod0').id, 'cloud');
  if (!shells || !lod0) throw new Error('shells or cloud lod0 missing from first-frame data');

  engine.setFrame(m);
  const cloud = new CloudLayer(m.unitNm / 1000);
  cloud.add(lod0);
  const shellMesh = shellsLayer(shells);
  const { debug } = app.params;
  const colorMode = isColorMode(debug) ? debug : undefined;
  // which layers a debug mode leaves visible (colour modes show neurons only)
  const only = colorMode ? 'neurons' : debug;
  cloud.group.visible = !only || only === 'cloud';
  shellMesh.visible = !only || only === 'shells';
  engine.world.add(cloud.group, shellMesh);

  const skeletons = data.get(`${data.scenario}-skeletons`, 'skeletons');
  const meta = data.get(`${data.scenario}-meta`, 'meta');
  const graph = data.get(`${data.scenario}-graph`, 'graph');
  if (skeletons && meta) {
    const neurons = neuronsLayer(buildSegments(skeletons, meta), meta.n, m.unitNm / 1000, colorMode);
    neurons.mesh.visible = !only || only === 'neurons';
    engine.world.add(neurons.mesh);
    const seeds = seedRows(meta, (data.scenario && SEED_TYPES[data.scenario]) || []);
    if (graph && seeds.length && !colorMode) {
      const onsets = jitter(bfsOnsets(graph, seeds, HOP_MS), JITTER_MS);
      const period = cycleMs(onsets, TAIL_MS);
      const fixed = app.params.t;
      engine.onFrame((now) => {
        const t = fixed ?? ((now / 1000) * SIM_MS_PER_S) % period;
        neurons.simTime.value = t;
        if (writeSpikes(onsets, t, neurons.lastSpike)) neurons.commit();
      });
    }
  }

  let frames = 0;
  const off = engine.onFrame(() => {
    if (++frames <= SETTLE_FRAMES) return;
    off();
    app.markReady('frame');
    // Refine the dust once the first frame is up; lod2 is left to quality presets (2.8).
    const lod1 = chunk('cloud', 'cloud-lod1');
    data
      .loadChunk(lod1)
      .then(() => {
        const pos = data.get(lod1.id, 'cloud');
        if (pos && !engine.disposed) cloud.add(pos);
      })
      .catch((e) => console.warn('[scene] cloud lod1', e));
  });
}
