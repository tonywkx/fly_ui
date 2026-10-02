import { when } from 'mobx';
import { useEffect, useRef } from 'react';
import { uniform } from 'three/tsl';
import { type Node, Vector3 } from 'three/webgpu';
import { data } from '@/data/store';
import { app } from '@/state/app';
import { bfsOnsets, cycleMs, jitter, seedRows, writeSpikes } from './activity';
import { Engine } from './engine';
import { INTRO, type IntroPhase, introTimeline, lerpPose, type Pose } from './intro';
import { CloudLayer } from './layers/cloud';
import { isColorMode, neuronsLayer } from './layers/neurons';
import { shellsLayer } from './layers/shells';
import { buildSegments } from './segments';

/** First-frame dust chunk the intro assembles. */
const DUST = 'cloud-lod0';
/** Intro camera before the dive: × framing distance, off-axis, drifting slowly round. */
const FAR_RADIUS = 1.6;
const FAR_AZIMUTH = (-20 * Math.PI) / 180;
const FAR_ELEVATION = (12 * Math.PI) / 180;
const DRIFT_PER_S = (3 * Math.PI) / 180;
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
    const stops: (() => void)[] = [];

    engine
      .init()
      .then((backend) => {
        if (engine.disposed) return;
        app.setBackend(backend);
        // dust first (the intro assembles it while the rest streams in), everything else on ready
        stops.push(
          when(
            () => !!data.manifest && data.loaded.has(DUST),
            () => {
              const intro = stageDust(engine);
              stops.push(
                when(
                  () => data.ready,
                  () => populate(engine, intro),
                ),
              );
            },
          ),
        );
      })
      .catch((e) => {
        console.error('[scene]', e);
        app.markReady('frame');
      });

    return () => {
      for (const stop of stops) stop();
      engine.dispose();
    };
  }, []);

  return <div ref={host} id="stage" className="absolute inset-0" />;
}

interface Intro {
  cloud: CloudLayer;
  /** Shells/neurons fade-in, driven by the intro clock. */
  reveal: Node<'float'>;
  /** Call once the rest of the data is in the scene (the dive may start). */
  ready(): void;
}

/** Frames the CNS, adds the dust and starts the intro clock on the next frame. */
function stageDust(engine: Engine): Intro {
  const m = data.manifest;
  const lod0 = data.get(DUST, 'cloud');
  if (!m || !lod0) throw new Error('manifest or cloud lod0 missing');
  engine.setFrame(m);

  const { snap, debug, intro: frozen } = app.params;
  // snaps and debug modes show the final state; reduced motion too, but keeps the hint
  const skip = (snap && frozen === undefined) || !!debug || app.reducedMotion;
  const showHint = !(snap && frozen === undefined) && !debug;

  const s = m.unitNm / 1000;
  const min = new Vector3().fromArray(m.bbox.min);
  const max = new Vector3().fromArray(m.bbox.max);
  const clock = { value: 0 };
  const cloud = new CloudLayer(s, {
    clock,
    center: min.clone().add(max).multiplyScalar(0.5).toArray(),
    radius: max.clone().sub(min).length() / 2,
  });
  cloud.add(lod0);
  cloud.group.visible = !debug || debug === 'cloud';
  engine.world.add(cloud.group);
  const reveal = uniform(0);

  const rest = engine.restPose;
  let t0: number | undefined;
  let readyAt = frozen !== undefined || skip ? 0 : Number.POSITIVE_INFINITY;
  let userTook = false;
  let phase: IntroPhase | undefined;
  let hint: boolean | undefined;
  const offInput = engine.onUserInput(() => {
    userTook = true;
  });
  const off = engine.onFrame((now) => {
    t0 ??= now;
    const t = skip ? Number.POSITIVE_INFINITY : (frozen ?? now - t0);
    const st = introTimeline(t, readyAt);
    clock.value = st.assembleMs;
    reveal.value = st.reveal;
    if (!userTook && !skip) {
      const diveStart = Math.max(INTRO.assembleMs, readyAt);
      const far: Pose = {
        radius: rest.radius * FAR_RADIUS,
        azimuth: FAR_AZIMUTH + (DRIFT_PER_S * Math.min(t, diveStart)) / 1000,
        elevation: FAR_ELEVATION,
      };
      engine.setPose(lerpPose(far, rest, st.dive));
    }
    const h = showHint && (st.hint || (userTook && st.phase !== 'assemble'));
    if (st.phase !== phase || h !== hint) {
      phase = st.phase;
      hint = h;
      app.setIntro(phase, hint);
    }
    if (phase === 'done' && (hint || !showHint)) {
      off();
      offInput();
      afterIntro(engine, cloud);
    }
  });

  return {
    cloud,
    reveal,
    ready: () => {
      if (t0 !== undefined && readyAt === Number.POSITIVE_INFINITY) readyAt = performance.now() - t0;
      else if (t0 === undefined) readyAt = 0;
    },
  };
}

/** Refine the dust once the intro is over; lod2 is left to quality presets (2.8). */
function afterIntro(engine: Engine, cloud: CloudLayer) {
  const lod1 = data.manifest?.chunks.find((c) => c.id === 'cloud-lod1');
  if (!lod1) return;
  data
    .loadChunk(lod1)
    .then(() => {
      const pos = data.get(lod1.id, 'cloud');
      if (pos && !engine.disposed) cloud.add(pos);
    })
    .catch((e) => console.warn('[scene] cloud lod1', e));
}

function populate(engine: Engine, intro: Intro) {
  const shells = data.get('neuropil-shells', 'neuropil');
  if (!shells) throw new Error('neuropil shells missing from first-frame data');
  const shellMesh = shellsLayer(shells, intro.reveal);
  const { debug } = app.params;
  const colorMode = isColorMode(debug) ? debug : undefined;
  // which layers a debug mode leaves visible (colour modes show neurons only)
  const only = colorMode ? 'neurons' : debug;
  shellMesh.visible = !only || only === 'shells';
  engine.world.add(shellMesh);

  const skeletons = data.get(`${data.scenario}-skeletons`, 'skeletons');
  const meta = data.get(`${data.scenario}-meta`, 'meta');
  const graph = data.get(`${data.scenario}-graph`, 'graph');
  if (skeletons && meta) {
    const neurons = neuronsLayer(
      buildSegments(skeletons, meta),
      meta.n,
      engine.world.scale.x,
      colorMode,
      intro.reveal,
    );
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

  intro.ready();

  let frames = 0;
  const off = engine.onFrame(() => {
    if (++frames <= SETTLE_FRAMES) return;
    off();
    app.markReady('frame');
  });
}
