import type { Csr, NeuronTable } from '@fly/data';
import { reaction } from 'mobx';
import { Vector3 } from 'three/webgpu';
import { focusRoles } from '@/data/partners';
import { app } from '@/state/app';
import { experiment } from '@/state/experiment';
import type { Engine } from './engine';
import type { NeuronsLayer } from './layers/neurons';

/** Focus look fades in/out over this long (ms); instant with reduced motion and in snaps. */
const FOCUS_MS = 200;

/**
 * Selection → scene: roles of the selected neuron's partners, silenced rows and electrode slots go
 * into the layer's row-state texture, the focus look fades with the selection, fly-to requests move the camera.
 * `?select=<bodyId>` selects (and frames) that neuron once.
 */
export function startFocus(
  engine: Engine,
  layer: NeuronsLayer,
  meta: NeuronTable,
  graph: Csr | undefined,
  /** Per row centre + radius in source units (`rowBounds`). */
  bounds: Float32Array,
): (() => void)[] {
  const { rowState } = layer;
  const instant = app.reducedMotion || app.params.snap;
  let target = 0;
  let last: number | undefined;

  const fly = (row: number, now = false) => {
    const r = bounds[row * 4 + 3] as number;
    if (r < 0) return;
    const c = new Vector3().fromArray(bounds, row * 4);
    engine.world.updateMatrixWorld();
    engine.flyTo(engine.world.localToWorld(c), r * engine.world.scale.x, now);
  };

  const { select, probes } = app.params;
  for (const id of probes ?? []) {
    const row = meta.bodyIds.indexOf(id);
    if (row < 0) console.warn(`[scene] probes: bodyId ${id} not in this scenario`);
    else experiment.toggleProbe(row);
  }
  if (select !== undefined) {
    const row = meta.bodyIds.indexOf(select);
    if (row < 0) console.warn(`[scene] select: bodyId ${select} not in this scenario`);
    else {
      experiment.select(row);
      fly(row, true);
    }
  }

  return [
    reaction(
      () => experiment.selected,
      (row) => {
        target = row === null ? 0 : 1;
        // deselecting keeps the roles: focus fading to 0 makes them inert
        if (row === null || !graph) return;
        const roles = focusRoles(graph, row);
        for (let i = 0; i < meta.n; i++) rowState[i * 4] = roles[i] as number;
        layer.commitState();
      },
      { fireImmediately: true },
    ),
    reaction(
      () => [...experiment.silenced],
      (rows) => {
        for (let i = 0; i < meta.n; i++) rowState[i * 4 + 1] = 0;
        for (const r of rows) rowState[r * 4 + 1] = 1;
        layer.commitState();
      },
      { fireImmediately: true },
    ),
    reaction(
      () => [...experiment.probes],
      (slots) => {
        for (let i = 0; i < meta.n; i++) rowState[i * 4 + 2] = 0;
        slots.forEach((r, k) => {
          if (r !== null) rowState[r * 4 + 2] = k + 1;
        });
        layer.commitState();
      },
    ),
    reaction(
      () => experiment.fly,
      (f) => f && fly(f.row),
    ),
    engine.onFrame((now) => {
      const dt = now - (last ?? now);
      last = now;
      const f = layer.focus;
      if (f.value === target) return;
      const step = instant ? 1 : Math.max(dt, 1) / FOCUS_MS;
      f.value = target > f.value ? Math.min(target, f.value + step) : Math.max(target, f.value - step);
    }),
  ];
}
