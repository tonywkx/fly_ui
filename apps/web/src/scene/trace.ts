import { type NeuronTable, NONE16 } from '@fly/data';
import { type Remote, wrap } from 'comlink';
import { reaction } from 'mobx';
import type { TraceApi } from '@/data/trace.worker';
import { app } from '@/state/app';
import { experiment } from '@/state/experiment';
import { pathHops, TRACE_K, TRACE_MAX_HOPS, trace } from '@/state/trace';
import type { Engine } from './engine';
import { type NeuronsLayer, TRACE_SLOTS } from './layers/neurons';

/** Trace look fades in/out over this long (ms), like the focus look. */
const FADE_MS = 200;
/** Reveal: one hop lights up per this many ms; then a pulse runs source → target every cycle. */
const HOP_MS = 150;
const PULSE_HOP_MS = 220;
/** A hop type of this many scene neurons or fewer gets the full hovered look; more fade towards the base. */
const FULL_GAIN_COUNT = 3;
/** Pulse cycle in hops: the path plus a pause before the next run. */
const PULSE_GAP_HOPS = 2;

/**
 * Tracer → scene: a query runs in a Worker over `typegraph-full` (fetched on the first query),
 * through the scenario's types only; the active path's hops go into the row-state texture (w) and
 * light up hop by hop while the Trace tool is on. `?trace=FROM>TO[>i]` opens it once (snaps).
 */
export function startTrace(
  engine: Engine,
  layer: NeuronsLayer,
  meta: NeuronTable,
  /** `typegraph-full` chunk URL; without it the tracer reports failure. */
  url: string | undefined,
): (() => void)[] {
  const { rowState } = layer;
  const instant = app.reducedMotion || app.params.snap;
  const via = meta.strings.types;
  let worker: Worker | undefined;
  let api: Remote<TraceApi> | undefined;
  let gen = 0;
  /** Frame time the reveal started; −1 = restart on the next frame (new path, tool back on). */
  let shownAt = -1;
  let wasOn = 0;
  let last: number | undefined;

  const { trace: preset } = app.params;
  if (preset) {
    app.waitFor('trace');
    trace.setEnds(preset.from, preset.to);
  }

  const run = (q: { from: string; to: string }) => {
    const g = ++gen;
    if (!url) {
      trace.setFailed();
      return;
    }
    if (!api) {
      worker = new Worker(new URL('../data/trace.worker.ts', import.meta.url), { type: 'module' });
      api = wrap<TraceApi>(worker);
    }
    trace.setLoading();
    api
      .trace(url, { ...q, via, k: TRACE_K, maxHops: TRACE_MAX_HOPS })
      .then((paths) => {
        if (g !== gen) return;
        trace.setResult(paths);
        if (preset) {
          trace.setActive(preset.path);
          app.markReady('trace');
        }
      })
      .catch((e) => {
        if (g !== gen) return;
        console.error('[trace]', e);
        trace.setFailed();
        app.markReady('trace');
      });
  };

  return [
    reaction(
      () => trace.query,
      (q) => {
        if (q) run(q);
        else gen++;
      },
      { fireImmediately: true, equals: (a, b) => a?.from === b?.from && a?.to === b?.to },
    ),
    reaction(
      () => experiment.tracePick,
      (p) => {
        const code = p ? (meta.type[p.row] as number) : NONE16;
        const name = code === NONE16 ? undefined : meta.strings.types[code];
        if (name) trace.pick(name);
      },
    ),
    reaction(
      () => trace.path,
      (path) => {
        const hops = path ? pathHops(meta, path.types) : new Uint8Array(meta.n);
        for (let i = 0; i < meta.n; i++) rowState[i * 4 + 3] = hops[i] as number;
        layer.commitState();
        const count = new Array<number>(TRACE_SLOTS).fill(0);
        for (const h of hops) if (h > 0 && h < TRACE_SLOTS) count[h] = (count[h] as number) + 1;
        count.forEach((c, h) => {
          layer.traceGain[h] = c > 0 ? Math.min(1, FULL_GAIN_COUNT / c) : 0;
        });
        layer.traceHops.value = path?.types.length ?? 1;
        shownAt = -1;
      },
      { fireImmediately: true },
    ),
    () => worker?.terminate(),
    engine.onFrame((now) => {
      const dt = now - (last ?? now);
      last = now;
      const on = experiment.tool === 'trace' && trace.path ? 1 : 0;
      const t = layer.trace;
      if (t.value !== on) {
        const step = instant ? 1 : Math.max(dt, 1) / FADE_MS;
        t.value = on > t.value ? Math.min(on, t.value + step) : Math.max(on, t.value - step);
      }
      if (on && !wasOn) shownAt = -1;
      wasOn = on;
      const hops = layer.traceHops.value;
      if (!on || instant) {
        layer.traceReveal.value = hops;
        layer.tracePulse.value = -10;
        return;
      }
      if (shownAt < 0) shownAt = now;
      const since = now - shownAt;
      layer.traceReveal.value = Math.min(hops, since / HOP_MS);
      const after = since - hops * HOP_MS;
      layer.tracePulse.value = after < 0 ? -10 : ((after / PULSE_HOP_MS) % (hops + PULSE_GAP_HOPS)) + 1;
    }),
  ];
}
