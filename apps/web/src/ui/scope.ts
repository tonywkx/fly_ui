import { LIF_DEFAULTS } from '@fly/sim';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { SCOPE_GUIDE } from '@/ui/palette';

/**
 * Sub-threshold range, mV: PSPs are a few mV, so the view is zoomed around rest / threshold and spikes
 * (drawn at `SPIKE_MV`) run off the top like a clipped scope trace.
 */
const Y_RANGE: [number, number] = [-64, -40];

/** Bare uPlot trace (no axes / legend / cursor) with dashed threshold and rest guides. Lazy-loaded with uPlot. */
export function createScope(el: HTMLElement, color: string): uPlot {
  const guides = (u: uPlot) => {
    const { ctx, bbox } = u;
    ctx.save();
    ctx.lineWidth = devicePixelRatio;
    for (const [mV, dash, stroke] of [
      [LIF_DEFAULTS.vThreshold, [3, 3], SCOPE_GUIDE.threshold],
      [LIF_DEFAULTS.vRest, [1, 3], SCOPE_GUIDE.rest],
    ] as const) {
      const y = Math.round(u.valToPos(mV, 'y', true)) + 0.5;
      ctx.strokeStyle = stroke;
      ctx.setLineDash(dash.map((d) => d * devicePixelRatio));
      ctx.beginPath();
      ctx.moveTo(bbox.left, y);
      ctx.lineTo(bbox.left + bbox.width, y);
      ctx.stroke();
    }
    ctx.restore();
  };
  return new uPlot(
    {
      width: el.clientWidth,
      height: el.clientHeight,
      padding: [0, 0, 0, 0],
      legend: { show: false },
      cursor: { show: false },
      select: { show: false, left: 0, top: 0, width: 0, height: 0 },
      axes: [{ show: false }, { show: false }],
      scales: { x: { time: false, auto: false }, y: { auto: false, range: Y_RANGE } },
      series: [{}, { stroke: color, width: 1.25, points: { show: false } }],
      hooks: { drawAxes: [guides] },
    },
    [[], []],
    el,
  );
}

/** Shows `[x, y]` over the x range [from, to]. */
export function drawScope(
  u: uPlot,
  x: ArrayLike<number>,
  y: ArrayLike<number>,
  from: number,
  to: number,
): void {
  u.batch(() => {
    u.setData([x as number[], y as number[]], false);
    u.setScale('x', { min: from, max: to });
  });
}
