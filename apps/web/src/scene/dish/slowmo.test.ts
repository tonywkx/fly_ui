import { describe, expect, it } from 'vitest';
import { SlowMo } from './slowmo';

const run = (p: SlowMo, simPerWall: number, ms: number) => {
  for (let t = 0; t < ms; t += 16) p.add(16 * simPerWall, 16);
};

describe('SlowMo', () => {
  it('reports the nominal slow-motion while the brain keeps up', () => {
    const p = new SlowMo(6);
    expect(p.slow).toBe(6);
    run(p, 1 / 6, 3000);
    expect(p.slow).toBe(6);
  });

  it('a short stall does not change the label', () => {
    const p = new SlowMo(6);
    run(p, 1 / 6, 3000);
    run(p, 0, 200);
    run(p, 1 / 6, 500);
    expect(p.slow).toBe(6);
  });

  it('a brain that falls behind shows the real factor', () => {
    const p = new SlowMo(6);
    run(p, 1 / 13, 6000);
    expect(p.slow).toBe(13);
    run(p, 1 / 6, 6000);
    expect(p.slow).toBe(6);
  });
});
