import { describe, expect, it } from 'vitest';
import type { Action, Senses } from './bridge';
import { AIR_MS, ARENA_R, DOWN_MS, SWAT_MS, World, type WorldEvent } from './world';

const world = (seed = 1) => new World(seed);

/** Step `ms` in 1 ms ticks, collecting events. */
function run(w: World, action: Action, ms: number): WorldEvent[] {
  const ev: WorldEvent[] = [];
  for (let t = 0; t < ms; t++) ev.push(...w.step(1, action));
  return ev;
}

const silent = (s: Senses) => s.sugar + s.bitter + s.loom.L + s.loom.R + s.female.L + s.female.R === 0;

const kinds = (ev: WorldEvent[]) => ev.map((e) => e.kind);

describe('World', () => {
  it('is deterministic per seed', () => {
    const a = world(7);
    const b = world(7);
    const c = world(8);
    run(a, 'walk', 3000);
    run(b, 'walk', 3000);
    run(c, 'walk', 3000);
    expect(a.fly).toEqual(b.fly);
    expect(a.fly.x).not.toBe(c.fly.x);
  });

  it('reset reseeds: a rerun retraces the first run', () => {
    const w = world(7);
    w.add('sugar', 5, 0);
    run(w, 'walk', 2000);
    const first = { ...w.fly };
    w.reset();
    w.add('sugar', 5, 0);
    run(w, 'walk', 2000);
    expect(w.fly).toEqual(first);
  });

  it('keeps the walking fly inside the arena', () => {
    const w = world(3);
    let far = 0;
    for (let t = 0; t < 60_000; t++) {
      w.step(1, 'walk');
      far = Math.max(far, Math.hypot(w.fly.x, w.fly.y));
    }
    expect(far).toBeLessThanOrEqual(ARENA_R);
    expect(far).toBeGreaterThan(ARENA_R / 2); // it does explore
  });

  it('tastes sugar and bitter on contact only', () => {
    const w = world();
    w.add('sugar', 1.6, 0);
    w.add('bitter', 1.6, 0.3);
    expect(w.sense().sugar).toBe(1);
    expect(w.sense().bitter).toBe(1);
    const far = world();
    far.add('sugar', 8, 0);
    far.add('bitter', 0, 8);
    expect(far.sense().sugar).toBe(0);
    expect(far.sense().bitter).toBe(0);
  });

  it('backs away and stands while eating', () => {
    const w = world();
    run(w, 'back', 100);
    expect(w.fly.x).toBeCloseTo(-0.6, 1);
    expect(w.fly.heading).toBe(0);
    const e = world();
    run(e, 'eat', 500);
    expect([e.fly.x, e.fly.y]).toEqual([0, 0]);
  });

  it('turns away after backing off', () => {
    const w = world();
    run(w, 'back', 100);
    w.step(1, 'walk');
    expect(Math.abs(w.fly.heading)).toBeGreaterThan(1);
  });

  it('walks toward nearby sugar', () => {
    const w = world(2);
    w.add('sugar', 2, 2.2);
    let touched = false;
    for (let t = 0; t < 1000 && !touched; t++) {
      w.step(1, 'walk');
      touched = w.sense().sugar === 1;
    }
    expect(touched).toBe(true);
  });

  it('looms a held shadow on the near eye, growing, then withdraws', () => {
    const w = world();
    w.shadow(0, 4); // left of the heading
    run(w, 'eat', 100);
    const a = w.sense().loom;
    run(w, 'eat', 200);
    const b = w.sense().loom;
    expect(a.L).toBeGreaterThan(a.R);
    expect(b.L).toBeGreaterThan(a.L);
    w.shadow(null);
    run(w, 'eat', 2000);
    expect(w.sense().loom).toEqual({ L: 0, R: 0 });
    expect(w.hands.shadow).toBeNull();
  });

  it('misses a far swat unnoticed', () => {
    const w = world();
    w.fly.x = -6;
    w.swat(6, 0);
    let loom = 0;
    const ev: WorldEvent[] = [];
    for (let t = 0; t < SWAT_MS + 5; t++) {
      ev.push(...w.step(1, 'eat'));
      loom = Math.max(loom, w.sense().loom.L, w.sense().loom.R);
    }
    expect(loom).toBe(0);
    expect(kinds(ev)).toEqual(['miss']);
  });

  it('allows one swatter in the air at a time', () => {
    const w = world();
    expect(w.swat(1, 0)).toBe(true);
    expect(w.swat(2, 0)).toBe(false);
  });

  it('hits a fly that stays, then reassembles her at the rim', () => {
    const w = world();
    w.swat(0.5, 0);
    run(w, 'eat', SWAT_MS / 2);
    expect(w.sense().loom.L).toBeGreaterThan(0);
    const ev = run(w, 'eat', SWAT_MS);
    expect(kinds(ev)).toEqual(['hit']);
    expect(silent(w.sense())).toBe(true);
    const back = run(w, 'walk', DOWN_MS + 5);
    expect(kinds(back)).toEqual(['reassemble']);
    expect(Math.hypot(w.fly.x, w.fly.y)).toBeGreaterThan(ARENA_R - 3);
  });

  it('misses a fly that jumped', () => {
    const w = world();
    w.swat(0, 0);
    const ev = run(w, 'jump', SWAT_MS + 5);
    expect(kinds(ev)).toEqual(['takeoff', 'miss']);
  });

  it('jumps once per command: airborne and numb, lands inside', () => {
    const w = world(4);
    w.add('sugar', 1.6, 0);
    const up = run(w, 'jump', 10);
    expect(kinds(up)).toEqual(['takeoff']);
    expect(silent(w.sense())).toBe(true);
    const down = run(w, 'jump', AIR_MS + 200); // command still held: no second takeoff
    expect(kinds(down)).toEqual(['land']);
    expect(Math.hypot(w.fly.x, w.fly.y)).toBeLessThan(ARENA_R);
  });

  it('sees a female ahead, not one behind', () => {
    const w = world();
    w.add('female', 3, 0);
    const s = w.sense().female;
    expect(s.L).toBeGreaterThan(0);
    expect(s.R).toBeGreaterThan(0);
    const b = world();
    b.add('female', -5, 0);
    expect(b.sense().female).toEqual({ L: 0, R: 0 });
  });

  it('turns to the female when courting', () => {
    const w = world();
    w.fly.x = 6;
    w.add('female', 6, 4); // her circle stays clear of the male
    const f = () => w.items.find((i) => i.kind === 'female');
    const off = () => {
      const g = f();
      if (!g) return Math.PI;
      const a = Math.atan2(g.y - w.fly.y, g.x - w.fly.x) - w.fly.heading;
      return Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
    };
    const before = off();
    run(w, 'court', 500);
    expect(off()).toBeLessThan(before / 3);
  });

  it('steers left and right while walking, held by the visitor (scripted)', () => {
    for (const steer of [1, -1] as const) {
      const w = world(4);
      w.steer = steer;
      const h0 = w.fly.heading;
      run(w, 'walk', 100);
      const turned = Math.atan2(Math.sin(w.fly.heading - h0), Math.cos(w.fly.heading - h0));
      expect(Math.sign(turned)).toBe(steer);
      expect(Math.abs(turned)).toBeGreaterThan(0.3);
    }
  });

  it('does not steer while backing off, and lets go on reset', () => {
    const w = world(4);
    w.steer = 1;
    const h0 = w.fly.heading;
    run(w, 'back', 100);
    expect(w.fly.heading).toBe(h0);
    w.reset();
    expect(w.steer).toBe(0);
  });

  it('drifts toward the odor source (scripted)', () => {
    let withOdor = 0;
    let without = 0;
    for (let seed = 1; seed <= 8; seed++) {
      for (const odor of [true, false]) {
        const w = world(seed);
        w.fly.x = -6;
        if (odor) w.add('odor', 6, 0);
        run(w, 'walk', 3000);
        const d = Math.hypot(w.fly.x - 6, w.fly.y);
        if (odor) withOdor += d;
        else without += d;
      }
    }
    expect(withOdor).toBeLessThan(without * 0.7);
  });

  it('limits odor and female to one, rejects points off the dish, removes and resets', () => {
    const w = world();
    expect(w.add('odor', 1, 1)).not.toBeNull();
    expect(w.add('odor', 2, 2)).toBeNull();
    expect(w.add('female', 3, 3)).not.toBeNull();
    expect(w.add('female', 4, 0)).toBeNull();
    expect(w.add('sugar', 20, 0)).toBeNull();
    const s = w.add('sugar', 5, 0);
    expect(s).not.toBeNull();
    expect(w.remove(s as number)).toBe(true);
    expect(w.items).toHaveLength(2);
    w.shadow(1, 1);
    run(w, 'walk', 500);
    w.reset();
    expect(w.items).toHaveLength(0);
    expect(w.hands).toEqual({ shadow: null, swatter: null });
    expect([w.fly.x, w.fly.y, w.fly.heading]).toEqual([0, 0, 0]);
  });

  it('moves an item within the dish and re-aims the female', () => {
    const w = world();
    const s = w.add('sugar', 1, 0) as number;
    const f = w.add('female', 5, 0) as number;
    const h0 = w.items[1]?.heading;
    expect(w.move(s, -3, 2)).toBe(true);
    expect(w.items[0]).toMatchObject({ x: -3, y: 2 });
    expect(w.move(s, 20, 0)).toBe(false);
    expect(w.items[0]).toMatchObject({ x: -3, y: 2 });
    expect(w.move(f, 0, -5)).toBe(true);
    expect(w.items[1]?.heading).not.toBeCloseTo(h0 as number);
    expect(w.move(999, 0, 0)).toBe(false);
  });
});
