import type { NeuronTable } from '@fly/data';
import { reaction, when } from 'mobx';
import { useEffect, useRef } from 'react';
import { uniform } from 'three/tsl';
import { type Node, Vector3 } from 'three/webgpu';
import { data } from '@/data/store';
import { LiveClient } from '@/sim/client';
import { app } from '@/state/app';
import { Engine } from './engine';
import { onFrameSample } from './frameStats';
import { INTRO, type IntroPhase, introTimeline, lerpPose, type Pose } from './intro';
import { CloudLayer } from './layers/cloud';
import { isColorMode, type NeuronsLayer, neuronsLayer } from './layers/neurons';
import { shellsLayer } from './layers/shells';
import { bakedSource, play } from './playback';
import { FpsGuard, QUALITY } from './quality';
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
/** Playback speed (sim ms per real s) and the pause after a baked run before it loops (sim ms). */
const SIM_MS_PER_S = 40;
const TAIL_MS = 60;

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
    engine.applyQuality(QUALITY[app.quality]);
    const stops: (() => void)[] = [];

    engine
      .init()
      .then((backend) => {
        if (engine.disposed) return;
        app.setBackend(backend);
        stops.push(
          reaction(
            () => app.quality,
            (q) => engine.applyQuality(QUALITY[q]),
            { fireImmediately: true },
          ),
        );
        // dust first (the intro assembles it while the rest streams in), everything else on ready
        stops.push(
          when(
            () => !!data.manifest && data.loaded.has(DUST),
            () => {
              const intro = stageDust(engine, stops);
              stops.push(
                when(
                  () => data.ready,
                  () => populate(engine, intro, stops),
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
function stageDust(engine: Engine, stops: (() => void)[]): Intro {
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
      stops.push(...afterIntro(engine, cloud));
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

/**
 * After the intro: dust tiers follow the quality preset (refining loads `cloud-lod{i}` in order), and
 * slow frames step an unpinned preset down. Snaps wait for the tiers (`dust` ready flag).
 */
function afterIntro(engine: Engine, cloud: CloudLayer): (() => void)[] {
  const tiers = (data.manifest?.chunks ?? [])
    .filter((c) => c.kind === 'cloud' && c.lod !== undefined)
    .sort((a, b) => (a.lod ?? 0) - (b.lod ?? 0));
  let busy = false;
  const refine = async () => {
    if (busy) return;
    busy = true;
    try {
      // the first tier is already in; re-read the preset after every await
      for (let want = QUALITY[app.quality].dustTiers; cloud.loaded < Math.min(want, tiers.length); ) {
        const c = tiers[cloud.loaded];
        if (!c) break;
        await data.loadChunk(c);
        const pos = data.get(c.id, 'cloud');
        if (!pos || engine.disposed) return;
        cloud.add(pos);
        want = QUALITY[app.quality].dustTiers;
      }
    } catch (e) {
      console.warn('[scene] cloud tiers', e);
    } finally {
      busy = false;
      app.markReady('dust');
    }
  };

  app.waitFor('dust');
  const stops: (() => void)[] = [
    reaction(
      () => QUALITY[app.quality].dustTiers,
      (n) => {
        cloud.setTiers(n);
        void refine();
      },
      { fireImmediately: true },
    ),
  ];
  if (!app.qualityPinned && !app.params.debug) {
    const guard = new FpsGuard();
    stops.push(
      onFrameSample(({ fps }) => {
        const q = guard.sample(fps, app.quality);
        if (!q) return;
        console.info(`[scene] ${fps.toFixed(0)} fps → quality ${q}`);
        app.setQuality(q);
      }),
    );
  }
  return stops;
}

function populate(engine: Engine, intro: Intro, stops: (() => void)[]) {
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
    if (!colorMode) startActivity(engine, neurons, meta, stops);
  }

  intro.ready();

  let frames = 0;
  const off = engine.onFrame(() => {
    if (++frames <= SETTLE_FRAMES) return;
    off();
    app.markReady('frame');
  });
}

/**
 * Baked spike train on a loop; with `?sim=live` the Worker sim takes over once the full graph has
 * loaded (baked keeps playing meanwhile). A live snap at `?t=` waits for the sim to reach it.
 */
function startActivity(engine: Engine, layer: NeuronsLayer, meta: NeuronTable, stops: (() => void)[]) {
  const train = data.get(`${data.scenario}-spikes`, 'spikes');
  if (!train) return;
  const { t: fixed, sim } = app.params;
  let stop = play(engine, layer, bakedSource(train, TAIL_MS), { rate: SIM_MS_PER_S, fixed });
  let client: LiveClient | undefined;
  let disposed = false;
  stops.push(() => {
    disposed = true;
    stop();
    client?.dispose();
  });
  if (sim !== 'live') return;

  const chunk = (id: string) => data.manifest?.chunks.find((c) => c.id === id);
  const graph = chunk('graph-full');
  const full = chunk('meta-full');
  if (!graph || !full) {
    console.warn('[sim] graph-full / meta-full missing from the manifest, staying on baked');
    return;
  }
  if (fixed !== undefined) app.waitFor('sim');
  LiveClient.start({
    graphUrl: data.url(graph),
    metaUrl: data.url(full),
    scenarioBodyIds: meta.bodyIds,
    stim: [...train.stim],
    seed: train.seed,
  })
    .then((c) => {
      if (disposed) return c.dispose();
      client = c;
      const start = () => {
        stop();
        stop = play(
          engine,
          layer,
          { feed: c.feed, pump: (t) => c.pump(t) },
          { rate: SIM_MS_PER_S, fixed, onReached: () => app.markReady('sim') },
        );
      };
      start();
      if (import.meta.env.DEV && (!app.params.snap || app.params.ui === 'tune')) {
        import('@/dev/tuning').then(({ mountTuning }) => {
          if (disposed) return;
          stops.push(
            mountTuning({
              apply: (t) => void c.tune(t).then(() => !disposed && start()),
              speed: () => c.speed,
            }),
          );
        });
      }
    })
    .catch((e) => {
      console.error('[sim] live mode failed, staying on baked', e);
      app.markReady('sim');
    });
}
