import type { Lanes } from '@/data/bands';
import type { SpikeLog } from '@/sim/feed';

/** Raster size in device px: `w` time columns; bands of `bandH` rows separated by `gap`. */
export interface RasterGeom {
  w: number;
  bandH: number;
  gap: number;
}

export const BAND_COUNT = 4;

export const bandTop = (b: number, g: RasterGeom) => b * (g.bandH + g.gap);
export const rasterHeight = (g: RasterGeom) => BAND_COUNT * g.bandH + (BAND_COUNT - 1) * g.gap;

/** Spikes of (from, to] counted per pixel (row-major w × height): x = time, y = the row's lane. */
export function rasterCounts(
  log: SpikeLog,
  lanes: Lanes,
  from: number,
  to: number,
  g: RasterGeom,
): Uint16Array {
  const h = rasterHeight(g);
  const out = new Uint16Array(g.w * h);
  const [i0, i1] = log.span(from, to);
  const { times, rows } = log;
  const xs = g.w / (to - from);
  for (let i = i0; i < i1; i++) {
    const r = rows[i] as number;
    const x = Math.min(g.w - 1, Math.floor(((times[i] as number) - from) * xs));
    const y = bandTop(lanes.band[r] as number, g) + Math.floor((lanes.rank[r] as number) * g.bandH);
    const k = y * g.w + x;
    if ((out[k] as number) < 0xffff) out[k] = (out[k] as number) + 1;
  }
  return out;
}

/** Spike density → white with alpha; `full` spikes per pixel saturate. */
export function paintCounts(counts: Uint16Array, img: ImageData, full: number): void {
  const d = img.data;
  for (let k = 0; k < counts.length; k++) {
    const c = counts[k] as number;
    const j = k * 4;
    d[j] = 255;
    d[j + 1] = 255;
    d[j + 2] = 255;
    d[j + 3] = c === 0 ? 0 : Math.round(255 * Math.min(1, 0.35 + (0.65 * c) / full));
  }
}
