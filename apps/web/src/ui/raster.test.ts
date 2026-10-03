import { describe, expect, it } from 'vitest';
import { SpikeLog } from '../sim/feed';
import { bandTop, rasterCounts } from './raster';

// 4 rows: 0, 1 → band 0 (ranks 0, 0.5); 2 → band 2; 3 → band 3
const lanes = {
  band: Uint8Array.of(0, 0, 2, 3),
  rank: Float32Array.of(0, 0.5, 0, 0),
  counts: Uint32Array.of(2, 0, 1, 1),
};
const geom = { w: 10, bandH: 4, gap: 1 };

describe('rasterCounts', () => {
  it('bins spikes of (from, to] into time columns and band lanes', () => {
    const log = new SpikeLog();
    log.push([0.5, 1, 9.5, 10, 10, 12], [0, 1, 2, 3, 3, 0], 12);
    const c = rasterCounts(log, lanes, 0, 10, geom);
    const h = 4 * 4 + 3;
    expect(c.length).toBe(10 * h);
    const at = (x: number, y: number) => c[y * 10 + x];
    expect(at(0, 0)).toBe(1); // row 0 at 0.5 ms
    expect(at(1, 2)).toBe(1); // row 1 (rank 0.5 → y 2) at 1 ms
    expect(at(9, bandTop(2, geom))).toBe(1); // row 2 at 9.5 ms
    expect(at(9, bandTop(3, geom))).toBe(2); // t = 10 lands in the last column
    expect([...c].reduce((a, b) => a + b, 0)).toBe(5); // 12 ms is outside
  });
});
