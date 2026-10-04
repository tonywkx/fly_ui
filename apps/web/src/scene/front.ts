import type { SpikeLog } from '@/sim/feed';

export interface FrontOptions {
  /** Spikes in (t − windowMs, t] count. */
  windowMs: number;
  /** Weight of a spike `age` ms old: exp(−age / tauMs). */
  tauMs: number;
  /** Total weight below this = no front (the activity has faded). */
  minWeight: number;
}

export interface Front {
  /** Weighted centroid of the spiking neurons' centres (source units). */
  center: [number, number, number];
  /** Sphere to frame: RMS spread of the centres + half the mean neuron radius. */
  radius: number;
  weight: number;
}

const DEFAULTS: FrontOptions = { windowMs: 30, tauMs: 10, minWeight: 0.1 };
/** Share of a neuron's half-diagonal kept in frame: a lone long axon is not framed whole. */
const NEURON_SHARE = 0.5;

/**
 * Where the activity is at sim time `t`: recent spikes of `log`, fresher ones weighted more, located
 * by the per-row `bounds` (`rowBounds`: cx, cy, cz, radius; rows with radius < 0 are skipped).
 */
export function activityFront(
  log: SpikeLog,
  t: number,
  bounds: Float32Array,
  opts: Partial<FrontOptions> = {},
): Front | null {
  const { windowMs, tauMs, minWeight } = { ...DEFAULTS, ...opts };
  const [i0, i1] = log.span(t - windowMs, t);
  const times = log.times;
  const rows = log.rows;
  let w = 0;
  let x = 0;
  let y = 0;
  let z = 0;
  let xx = 0;
  let r = 0;
  for (let i = i0; i < i1; i++) {
    const o = (rows[i] as number) * 4;
    const rad = bounds[o + 3];
    if (rad === undefined || rad < 0) continue;
    const k = Math.exp(-(t - (times[i] as number)) / tauMs);
    const cx = bounds[o] as number;
    const cy = bounds[o + 1] as number;
    const cz = bounds[o + 2] as number;
    w += k;
    x += k * cx;
    y += k * cy;
    z += k * cz;
    xx += k * (cx * cx + cy * cy + cz * cz);
    r += k * rad;
  }
  if (w < minWeight || w === 0) return null;
  x /= w;
  y /= w;
  z /= w;
  const spread = Math.sqrt(Math.max(0, xx / w - (x * x + y * y + z * z)));
  return { center: [x, y, z], radius: spread + (NEURON_SHARE * r) / w, weight: w };
}
