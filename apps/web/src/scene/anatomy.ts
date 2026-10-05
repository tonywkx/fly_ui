import type { NeuropilSet } from '@fly/data';
import type { Mesh } from 'three/webgpu';
import { Vector3 } from 'three/webgpu';
import type { Engine } from './engine';

/**
 * Tour step 1 anatomy labels (docs/TOUR.md §1): each label sits in the void beside its shell with a
 * thin leader line to the shell's centre. The DOM nodes come from `ui/tour/AnatomyLabels` through
 * `anatomyDom`; this module writes their positions every frame (no React state per frame).
 */
export type Part = 'optic' | 'brain' | 'vnc';
export type Side = 'left' | 'right' | 'above' | 'below';

/**
 * Shells per part (the eyes label picks the lobe on the left of the screen) and where the label goes,
 * in order of preference: the first side with room in the viewport wins.
 */
const PARTS: Record<Part, { shells: string[]; sides: Side[] }> = {
  optic: { shells: ['Optic(L)', 'Optic(R)'], sides: ['left', 'above'] },
  brain: { shells: ['CentralBrain'], sides: ['above'] },
  // seen from the front the cord hangs under the brain, where the step card sits
  vnc: { shells: ['VNC'], sides: ['right', 'below'] },
};

/** Vertices projected per shell per frame. */
const SAMPLES = 160;
/** Line from the shell's screen edge out to the label, px. */
const REACH = 28;
/** Between the line's end and the label text, px. */
const GAP = 6;
/** Labels keep this far from the viewport edge, px. */
const MARGIN = 16;

export interface LabelDom {
  label: HTMLElement;
  line: SVGLineElement;
  /** Label size, measured by the component (the frame loop never reads layout). */
  size: { w: number; h: number };
}
/** Mounted labels; empty = nothing to do (outside step 1). */
export const anatomyDom = new Map<Part, LabelDom>();

export interface ShellSamples {
  /** Vertex bbox centre, mesh space. */
  centre: [number, number, number];
  /** Up to `max` evenly strided vertices, mesh space. */
  points: Float32Array;
}

export function shellSamples(set: NeuropilSet, name: string, max: number): ShellSamples | undefined {
  const r = set.ranges.find((x) => x.name === name);
  if (!r) return undefined;
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let v = r.vertStart; v < r.vertStart + r.vertCount; v++)
    for (let k = 0; k < 3; k++) {
      const x = set.pos[v * 3 + k] as number;
      if (x < (lo[k] as number)) lo[k] = x;
      if (x > (hi[k] as number)) hi[k] = x;
    }
  const n = Math.min(max, r.vertCount);
  const stride = r.vertCount / n;
  const points = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = r.vertStart + Math.floor(i * stride);
    points.set(set.pos.subarray(v * 3, v * 3 + 3), i * 3);
  }
  const mid = (k: number) => ((lo[k] as number) + (hi[k] as number)) / 2;
  return { centre: [mid(0), mid(1), mid(2)], points };
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export interface Placement {
  /** Line end beside the shell, px. */
  end: [number, number];
  /** Label's top-left, px. */
  box: { x: number; y: number };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * Label beside the shell's screen `rect` on the first of `sides` where it fits the viewport (else the
 * last one, pushed inside), its line running to `anchor` (the projected centre).
 */
export function placeLabel(
  sides: Side[],
  rect: Rect,
  anchor: [number, number],
  size: { w: number; h: number },
  view: { w: number; h: number },
): Placement {
  const [ax, ay] = anchor;
  let p: Placement | undefined;
  for (const side of sides) {
    const end: [number, number] =
      side === 'left'
        ? [rect.x0 - REACH, ay]
        : side === 'right'
          ? [rect.x1 + REACH, ay]
          : side === 'above'
            ? [ax, rect.y0 - REACH]
            : [ax, rect.y1 + REACH];
    const x = side === 'left' ? end[0] - GAP - size.w : side === 'right' ? end[0] + GAP : end[0] - size.w / 2;
    const y =
      side === 'left' || side === 'right'
        ? end[1] - size.h / 2
        : side === 'above'
          ? end[1] - GAP - size.h
          : end[1] + GAP;
    const box = {
      x: clamp(x, MARGIN, view.w - MARGIN - size.w),
      y: clamp(y, MARGIN, view.h - MARGIN - size.h),
    };
    p = { end, box };
    if (box.x === x && box.y === y) return p;
  }
  if (!p) throw new Error('placeLabel: no sides');
  return p;
}

/** Positions the mounted labels every frame from the shells' projections. */
export function startAnatomy(engine: Engine, mesh: Mesh, set: NeuropilSet): () => void {
  const shells = new Map<string, ShellSamples>();
  for (const { shells: names } of Object.values(PARTS))
    for (const name of names) {
      const s = shellSamples(set, name, SAMPLES);
      if (s) shells.set(name, s);
      else console.warn(`[scene] anatomy: shell ${name} missing`);
    }
  const v = new Vector3();
  const canvas = engine.renderer.domElement;

  /** Screen rect of the samples and the projected centre; undefined when behind the camera. */
  const project = (s: ShellSamples, w: number, h: number) => {
    const rect: Rect = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    const toPx = () => {
      v.applyMatrix4(mesh.matrixWorld).project(engine.camera);
      return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h, v.z] as const;
    };
    for (let i = 0; i < s.points.length; i += 3) {
      v.fromArray(s.points, i);
      const [x, y] = toPx();
      rect.x0 = Math.min(rect.x0, x);
      rect.x1 = Math.max(rect.x1, x);
      rect.y0 = Math.min(rect.y0, y);
      rect.y1 = Math.max(rect.y1, y);
    }
    v.fromArray(s.centre);
    const [x, y, z] = toPx();
    return z > 1 ? undefined : { rect, anchor: [x, y] as [number, number] };
  };

  return engine.onFrame(() => {
    if (anatomyDom.size === 0) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    for (const [part, dom] of anatomyDom) {
      const { shells: names, sides } = PARTS[part];
      // several shells (the two optic lobes): the leftmost on screen
      let best: ReturnType<typeof project>;
      for (const name of names) {
        const s = shells.get(name);
        const p = s && project(s, w, h);
        if (p && (!best || p.anchor[0] < best.anchor[0])) best = p;
      }
      dom.label.style.visibility = dom.line.style.visibility = best ? '' : 'hidden';
      if (!best) continue;
      const { end, box } = placeLabel(sides, best.rect, best.anchor, dom.size, { w, h });
      dom.label.style.transform = `translate(${box.x}px, ${box.y}px)`;
      dom.line.setAttribute('x1', String(best.anchor[0]));
      dom.line.setAttribute('y1', String(best.anchor[1]));
      dom.line.setAttribute('x2', String(end[0]));
      dom.line.setAttribute('y2', String(end[1]));
    }
  });
}
