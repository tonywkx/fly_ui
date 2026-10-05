import type { NeuronTable } from '@fly/data';
import { autorun, reaction, when } from 'mobx';
import { useEffect, useRef } from 'react';
import { uniform } from 'three/tsl';
import { type Node, Vector3 } from 'three/webgpu';
import { colorGroups, fillTints } from '@/data/colorBy';
import { data } from '@/data/store';
import { LiveClient } from '@/sim/client';
import { app } from '@/state/app';
import { experiment } from '@/state/experiment';
import { playback } from '@/state/playback';
import { startDirector } from './director';
import { Engine } from './engine';
import { startFocus } from './focus';
import { onFrameSample } from './frameStats';
import { INTRO, type IntroPhase, introTimeline, lerpPose, type Pose } from './intro';
import { CloudLayer } from './layers/cloud';
import { isColorMode, type NeuronsLayer, neuronsLayer } from './layers/neurons';
import { shellsLayer } from './layers/shells';
import { Picker } from './pick';
import { bakedSource, play } from './playback';
import { FpsGuard, QUALITY } from './quality';
import { buildSegments, rowBounds } from './segments';
import { startTrace } from './trace';

/** First-frame dust chunk the intro assembles. */
const DUST = 'cloud-lod0';
/** Intro camera before the dive: × framing distance, off-axis, drifting slowly round. */
const FAR_RADIUS = 1.6;
const FAR_AZIMUTH = (-20 * Math.PI) / 180;
const FAR_ELEVATION = (12 * Math.PI) / 180;
const DRIFT_PER_S = (3 * Math.PI) / 180;
/** Frames rendered with content before the scene counts as drawn (snap readiness). */
const SETTLE_FRAMES = 2;
/** Pause after a baked run before it loops (sim ms). */
const TAIL_MS = 60;
/** Pointer travel (px) up to which a press + release still counts as a click, not an orbit. */
const CLICK_PX = 4;

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
        app.setRendererFailed();
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
  // snaps, debug modes and reduced motion show the final state
  const skip = (snap && frozen === undefined) || !!debug || app.reducedMotion;

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
    if (st.phase !== phase) {
      phase = st.phase;
      app.setIntro(phase);
    }
    if (phase === 'done') {
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
    const seg = buildSegments(skeletons, meta);
    const neurons = neuronsLayer(seg, meta.n, engine.world.scale.x, colorMode, intro.reveal);
    neurons.mesh.visible = !only || only === 'neurons';
    engine.world.add(neurons.mesh);
    stops.push(
      reaction(
        () => app.colorBy,
        (mode) => {
          fillTints(neurons.tints, colorGroups(meta, mode));
          neurons.commitTints();
        },
        { fireImmediately: true },
      ),
    );
    if (!colorMode) startActivity(engine, neurons, meta, stops);
    if (neurons.mesh.visible) stops.push(...startPicking(engine, neurons));
    const graph = data.get(`${data.scenario}-graph`, 'graph');
    const bounds = rowBounds(seg, meta.n);
    stops.push(...startFocus(engine, neurons, meta, graph, bounds));
    if (!colorMode) stops.push(...startDirector(engine, bounds));
    const types = data.manifest?.chunks.find((c) => c.id === 'typegraph-full');
    stops.push(...startTrace(engine, neurons, meta, types && data.url(types)));
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
 * Hover: GPU-picks the neuron under a mouse/pen pointer (not while dragging the orbit) into
 * `app.hover`, which highlights it; a click applies the active tool. With Stimulate / Silence a drag
 * that starts on a neuron is a brush stroke (orbit off meanwhile), elsewhere it orbits.
 * `?pick=x,y` picks once at that viewport point (snaps).
 */
function startPicking(engine: Engine, layer: NeuronsLayer): (() => void)[] {
  const canvas = engine.renderer.domElement;
  const { pick } = app.params;
  if (pick) app.waitFor('pick');
  // click = press and release within CLICK_PX without orbiting; applies the tool to the row under the press
  let press: { x: number; y: number; row: number | null; stroke: boolean; moved: boolean } | null = null;
  const picker = new Picker(engine, layer.pickMesh, (row) => {
    if (row !== app.hover) app.setHover(row);
    if (press?.moved && row !== null) experiment.paint(row);
    if (pick) app.markReady('pick');
  });
  let dragging = false;
  const at = (e: PointerEvent): [number, number] | null => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    return e.pointerType === 'touch' || x < 0 || y < 0 || x >= r.width || y >= r.height ? null : [x, y];
  };
  const far = (e: PointerEvent, p: { x: number; y: number }) =>
    Math.hypot(e.clientX - p.x, e.clientY - p.y) > CLICK_PX;
  const move = (e: PointerEvent) => {
    if (press?.stroke && !press.moved && far(e, press)) {
      press.moved = true;
      experiment.paint(press.row as number);
    }
    if (!dragging) picker.setPointer(at(e));
  };
  // capture phase: runs before OrbitControls' own pointerdown on the canvas, so a stroke can switch it off
  const down = (e: PointerEvent) => {
    const primary = e.button === 0 && e.pointerType !== 'touch';
    const row = app.hover;
    const stroke =
      primary && row !== null && (experiment.tool === 'stimulate' || experiment.tool === 'silence');
    press = primary ? { x: e.clientX, y: e.clientY, row, stroke, moved: false } : null;
    if (stroke) {
      engine.setOrbit(false);
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    dragging = true;
    picker.setPointer(null);
  };
  const up = (e: PointerEvent) => {
    dragging = false;
    picker.setPointer(at(e));
    if (press?.stroke) engine.setOrbit(true);
    if (press && !press.moved && !far(e, press)) experiment.apply(press.row);
    press = null;
  };
  const leave = () => picker.setPointer(null);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerdown', down, { capture: true });
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointerleave', leave);
  if (pick) picker.setPointer([pick[0] * canvas.clientWidth, pick[1] * canvas.clientHeight]);

  return [
    engine.onFrame(() => picker.update()),
    reaction(
      () => app.hover,
      (row) => {
        layer.hovered.value = row ?? -1;
      },
    ),
    autorun(() => {
      canvas.style.cursor = experiment.tool !== 'select' ? 'crosshair' : app.hover === null ? '' : 'pointer';
    }),
    () => {
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerdown', down, { capture: true });
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointerleave', leave);
      picker.dispose();
      app.setHover(null);
    },
  ];
}

/**
 * Baked spike train on a loop; the Worker sim takes over once the full graph has loaded (baked keeps
 * playing meanwhile) — from the start with `?sim=live`, else on the first stimulus / silencing.
 * A live snap at `?t=` waits for the sim to reach it.
 */
function startActivity(engine: Engine, layer: NeuronsLayer, meta: NeuronTable, stops: (() => void)[]) {
  const train = data.get(`${data.scenario}-spikes`, 'spikes');
  if (!train) return;
  const { t: fixed, sim } = app.params;
  let stop = play(engine, layer, bakedSource(train, TAIL_MS), playback, { fixed });
  let client: LiveClient | undefined;
  let disposed = false;
  stops.push(() => {
    disposed = true;
    stop();
    client?.dispose();
  });

  const goLive = () => {
    if (experiment.live !== 'off') return;
    const chunk = (id: string) => data.manifest?.chunks.find((c) => c.id === id);
    const graph = chunk('graph-full');
    const full = chunk('meta-full');
    if (!graph || !full) {
      console.warn('[sim] graph-full / meta-full missing from the manifest, staying on baked');
      experiment.setLive('failed');
      return;
    }
    experiment.setLive('loading');
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
        // the experiment's stimulus / silencing, applied as diffs (all stimuli again when the drive
        // changes); a restart clears them in the Worker
        const applied = { stim: new Set<number>(), silent: new Set<number>(), drive: experiment.stim };
        const sync = () => {
          const ops: Promise<void>[] = [];
          const { hz, gain } = experiment.stim;
          const redo = applied.drive !== experiment.stim;
          for (const r of experiment.stimulated)
            if (redo || !applied.stim.has(r)) ops.push(c.stimulate(r, hz, gain));
          for (const r of applied.stim) if (!experiment.stimulated.has(r)) ops.push(c.stimulate(r, 0));
          for (const r of experiment.silenced) if (!applied.silent.has(r)) ops.push(c.silence(r, true));
          for (const r of applied.silent) if (!experiment.silenced.has(r)) ops.push(c.silence(r, false));
          applied.stim = new Set(experiment.stimulated);
          applied.silent = new Set(experiment.silenced);
          applied.drive = experiment.stim;
          Promise.all(ops).catch((e) => console.error('[sim]', e));
        };
        const start = () => {
          stop();
          // a stimulus is meant to be seen: live starts playing unless a snap holds `?t=`
          if (fixed === undefined) playback.setPaused(false);
          stop = play(engine, layer, { log: c.log, pump: (t) => c.pump(t) }, playback, {
            fixed,
            onReached: () => app.markReady('sim'),
          });
        };
        sync();
        start();
        experiment.setLive('on');
        stops.push(
          reaction(() => [experiment.stim, ...experiment.stimulated, -1, ...experiment.silenced], sync),
        );
        if (import.meta.env.DEV && (!app.params.snap || app.params.ui === 'tune')) {
          import('@/dev/tuning').then(({ mountTuning }) => {
            if (disposed) return;
            stops.push(
              mountTuning({
                apply: (t) =>
                  void c.tune(t).then(() => {
                    if (disposed) return;
                    applied.stim.clear();
                    applied.silent.clear();
                    sync();
                    start();
                  }),
                speed: () => c.speed,
              }),
            );
          });
        }
      })
      .catch((e) => {
        console.error('[sim] live mode failed, staying on baked', e);
        experiment.setLive('failed');
        app.markReady('sim');
      });
  };

  if (sim === 'live') goLive();
  else stops.push(when(() => experiment.touched, goLive));
}
