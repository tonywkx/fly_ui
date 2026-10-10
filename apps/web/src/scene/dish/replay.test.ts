import { World, type WorldEvent } from '@fly/sim';
import { describe, expect, it } from 'vitest';
import { Clip, type Frame, LEAD, snap, span, TAIL, Tape } from './replay';

const ev = (t: number): WorldEvent => ({ kind: 'takeoff', t, x: 0, y: 0 });
const frame = (t: number, events: WorldEvent[] = []): Frame =>
  snap(new World(1), 'walk', t, events, new Float32Array([t]));

describe('snap', () => {
  it('copies the world: later steps do not reach the frame', () => {
    const w = new World(1);
    w.add('sugar', 3, 4);
    w.swat(1, 2);
    const f = snap(w, 'walk', 0, [], new Float32Array(2));
    const { x } = w.fly;
    for (let i = 0; i < 50; i++) w.step(1, 'walk');
    w.items.length = 0;
    expect(f.fly.x).toBe(x);
    expect(f.items).toHaveLength(1);
    expect(f.hands.swatter).toMatchObject({ x: 1, y: 2, t: 0 });
    expect(w.hands.swatter?.t).not.toBe(0);
  });
});

describe('Tape', () => {
  it('keeps the last `capacity` frames in time order', () => {
    const tape = new Tape(3);
    for (let t = 1; t <= 5; t++) tape.push(frame(t));
    expect(tape.size).toBe(3);
    expect(tape.clip(0, 10).map((f) => f.t)).toEqual([3, 4, 5]);
  });

  it('clips a window and clears', () => {
    const tape = new Tape(10);
    for (let t = 1; t <= 8; t++) tape.push(frame(t));
    expect(tape.clip(3, 5).map((f) => f.t)).toEqual([3, 4, 5]);
    tape.clear();
    expect(tape.size).toBe(0);
    expect(tape.clip(0, 10)).toEqual([]);
  });
});

describe('Clip', () => {
  const clip = new Clip([frame(10), frame(11, [ev(11)]), frame(12), frame(13, [ev(13)])]);

  it('spans its frames', () => {
    expect([clip.t0, clip.t1]).toEqual([10, 13]);
  });

  it('finds the frame at or before t, clamped to the ends', () => {
    expect(clip.at(11.5).t).toBe(11);
    expect(clip.at(12).t).toBe(12);
    expect(clip.at(0).t).toBe(10);
    expect(clip.at(99).t).toBe(13);
  });

  it('lists the events in (from, to]', () => {
    expect(clip.events(10, 13).map((e) => e.t)).toEqual([11, 13]);
    expect(clip.events(11, 12)).toEqual([]);
    expect(clip.events(-Infinity, 11).map((e) => e.t)).toEqual([11]);
  });
});

describe('span', () => {
  it('runs from just before the sense to a tail after the decision', () => {
    expect(span({ t: 140, ms: 30 }, 0, 440)).toEqual([140 - 30 - LEAD, 140 + TAIL]);
  });

  it('stays inside the run', () => {
    expect(span({ t: 20, ms: 15 }, 0, 100)).toEqual([0, 100]);
  });

  it('keeps the whole run without a decision, or one without a sense', () => {
    expect(span(null, 0, 600)).toEqual([0, 600]);
    expect(span({ t: 140, ms: null }, 0, 440)).toEqual([140 - LEAD, 140 + TAIL]);
  });
});
