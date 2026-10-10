import { describe, expect, it } from 'vitest';
import { delivery, STIMULI, type Stimulus } from './deliver';
import { ARENA_R, World, type WorldEvent } from './world';

/** A clean take: fresh world, the script ticks before each 1 ms walk step. */
function take(stim: Stimulus, ms: number, seed = 1) {
  const w = new World(seed);
  const tick = delivery(stim);
  const ev: WorldEvent[] = [];
  const looms: number[] = [];
  for (let t = 0; t < ms; t++) {
    tick(w);
    ev.push(...w.step(1, 'walk'));
    const l = w.sense().loom;
    looms.push(Math.max(l.L, l.R));
  }
  return { w, ev, looms };
}

/** Bearing of a point from the fly's start pose (+ = left). */
const ahead = (x: number, y: number) => ({ d: Math.hypot(x, y), a: Math.atan2(y, x) });

describe('delivery', () => {
  it('drops sugar and bitter just ahead of the fly, which reaches it', () => {
    for (const kind of ['sugar', 'bitter'] as const) {
      const { w } = take(kind, 1);
      const [it] = w.items;
      expect(it?.kind).toBe(kind);
      const p = ahead(it?.x ?? 0, it?.y ?? 0);
      expect(p.d).toBeCloseTo(2.5, 1);
      expect(Math.abs(p.a)).toBeLessThan(0.05);
    }
    const w = new World(1);
    const tick = delivery('sugar');
    let tasted = false;
    for (let t = 0; t < 300 && !tasted; t++) {
      tick(w);
      w.step(1, 'walk');
      tasted = w.sense().sugar > 0;
    }
    expect(tasted).toBe(true);
  });

  it('puts the banana at the far rim and the female ahead', () => {
    const b = take('banana', 1).w.items[0];
    expect(b?.kind).toBe('odor');
    expect(Math.hypot(b?.x ?? 0, b?.y ?? 0)).toBeGreaterThan(ARENA_R - 3);
    const f = take('female', 1).w.items[0];
    expect(f?.kind).toBe('female');
    expect(ahead(f?.x ?? 0, f?.y ?? 0).d).toBeCloseTo(4, 1);
    expect(take('female', 1).w.sense().female.L).toBeGreaterThan(0);
  });

  it('sweeps the shadow in from the left by itself: loom grows, left eye first', () => {
    const { w, looms } = take('shadow', 300);
    expect(w.hands.shadow?.held).toBe(true);
    expect(looms[299] ?? 0).toBeGreaterThan(looms[50] ?? 0);
    expect(looms[50] ?? 0).toBeGreaterThan(0);
    const s = new World(1);
    const tick = delivery('shadow');
    for (let t = 0; t < 100; t++) {
      tick(s);
      s.step(1, 'walk');
    }
    expect(s.sense().loom.L).toBeGreaterThan(s.sense().loom.R);
  });

  it('swings the swatter at once; it lands at SWAT_MS on a fly that keeps walking', () => {
    const { ev } = take('swatter', 200);
    expect(ev.find((e) => e.kind === 'hit')?.t).toBe(120);
  });

  it('gives nothing for none, and every stimulus is deterministic', () => {
    const n = take('none', 200).w;
    expect(n.items).toHaveLength(0);
    expect(n.hands).toEqual({ shadow: null, swatter: null });
    for (const s of STIMULI) expect(take(s, 500).w.fly).toEqual(take(s, 500).w.fly);
  });
});
