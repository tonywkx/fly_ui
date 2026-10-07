import { type Command, type Drive, type Group, mulberry32, SENSES, World } from '@fly/sim';
import { describe, expect, it } from 'vitest';
import { DishLoop } from './loop';

const g = (...rows: number[]): Group => ({
  all: Uint32Array.from(rows),
  L: Uint32Array.from(rows.filter((r) => r % 2 === 0)),
  R: Uint32Array.from(rows.filter((r) => r % 2 === 1)),
});
const commands: Record<Command, Group> = { jump: g(0, 1), back: g(2), eat: g(3), court: g(4), gate: g(5) };
const senses = Object.fromEntries(
  Object.keys(SENSES).map((k, i) => [k, g(100 + 2 * i, 101 + 2 * i)]),
) as Record<keyof typeof SENSES, Group>;

/** A log where `rows` fire every `every` ms from `from` on. */
function log(rows: number[], from: number, until: number, every = 1) {
  const t: number[] = [];
  const r: number[] = [];
  for (let s = from; s < until; s += every)
    for (const i of rows) {
      t.push(s);
      r.push(i);
    }
  const times = Float32Array.from(t);
  const lo = (x: number) => times.findIndex((v) => v >= x);
  return {
    until,
    times,
    rows: Uint32Array.from(r),
    span: (a: number, b: number): [number, number] => {
      const i = lo(a);
      const j = lo(b);
      return [i < 0 ? times.length : i, j < 0 ? times.length : j];
    },
  };
}

const setup = () => {
  const drives: Drive[] = [];
  const loop = new DishLoop(new World(mulberry32(1)), senses, commands, { drive: (d) => drives.push(d) });
  return { loop, drives };
};

describe('DishLoop', () => {
  it('jumps when the jump command fires hard', () => {
    const { loop } = setup();
    const ev = loop.advance(100, log([0, 1], 20, 200));
    expect(loop.action).toBe('jump');
    expect(ev.map((e) => e.kind)).toContain('takeoff');
  });

  it('walks on a quiet log and never runs past it', () => {
    const { loop } = setup();
    loop.advance(500, log([], 0, 50));
    expect(loop.action).toBe('walk');
    expect(loop.t).toBe(50);
  });

  it('drives sensory rows only when what the fly senses changes', () => {
    const { loop, drives } = setup();
    loop.world.add('sugar', 1.6, 0);
    loop.world.fly.heading = 0;
    loop.advance(5, log([], 0, 100));
    expect(drives).toHaveLength(1);
    expect([...(drives[0]?.rows ?? [])]).toEqual([100, 101]);
    loop.world.remove(loop.world.items[0]?.id ?? 0);
    loop.advance(10, log([], 0, 100));
    expect(drives).toHaveLength(2);
    expect([...(drives[1]?.hz ?? [])]).toEqual([0, 0]);
  });

  it('resets world, clock and drive', () => {
    const { loop, drives } = setup();
    loop.world.add('sugar', 1.6, 0);
    loop.advance(5, log([], 0, 100));
    loop.reset();
    expect(loop.t).toBe(0);
    expect(loop.world.items).toHaveLength(0);
    expect(loop.action).toBe('walk');
    expect([...(drives.at(-1)?.hz ?? [])]).toEqual([0, 0]);
  });
});
