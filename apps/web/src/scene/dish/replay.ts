import type { Action, Fly, Hands, Item, World, WorldEvent } from '@fly/sim';

/** A clip starts this long before the sense came on and ends this long after the decision, sim ms. */
export const LEAD = 50;
export const TAIL = 200;

/** What the dish shows, as the scene reads it (a live `World` or a recorded frame). */
export type Shown = Pick<World, 'fly' | 'items' | 'hands'>;

/** One sim tick of a run: the world after the step, the events on the way, the hologram heat. */
export interface Frame {
  t: number;
  action: Action;
  fly: Fly;
  items: Item[];
  hands: Hands;
  events: WorldEvent[];
  /** Hologram node levels in the caller's type order. */
  heat: Float32Array;
}

/** A frame that owns its copies (the world keeps stepping). */
export function snap(
  w: Shown,
  action: Action,
  t: number,
  events: readonly WorldEvent[],
  heat: Float32Array,
): Frame {
  const { shadow, swatter } = w.hands;
  return {
    t,
    action,
    fly: { ...w.fly },
    items: w.items.map((it) => ({ ...it })),
    hands: { shadow: shadow && { ...shadow }, swatter: swatter && { ...swatter } },
    events: events.map((e) => ({ ...e })),
    heat: heat.slice(),
  };
}

/** The last `capacity` frames (≈1.5 sim s at a frame per tick). */
export class Tape {
  private readonly ring: (Frame | undefined)[];
  private head = 0;
  private n = 0;

  constructor(readonly capacity = 1500) {
    this.ring = new Array(capacity);
  }

  get size(): number {
    return this.n;
  }

  push(f: Frame): void {
    this.ring[this.head] = f;
    this.head = (this.head + 1) % this.capacity;
    this.n = Math.min(this.n + 1, this.capacity);
  }

  /** Frames with `from ≤ t ≤ to`, oldest first. */
  clip(from: number, to: number): Frame[] {
    const out: Frame[] = [];
    for (let i = 0; i < this.n; i++) {
      const f = this.ring[(this.head - this.n + i + this.capacity) % this.capacity] as Frame;
      if (f.t >= from && f.t <= to) out.push(f);
    }
    return out;
  }

  clear(): void {
    this.ring.fill(undefined);
    this.head = this.n = 0;
  }
}

/** A recorded run to replay: frames by time (at least one). */
export class Clip {
  readonly t0: number;
  readonly t1: number;

  constructor(readonly frames: readonly Frame[]) {
    this.t0 = frames[0]?.t ?? 0;
    this.t1 = frames.at(-1)?.t ?? 0;
  }

  /** The last frame at or before `t` (clamped to the clip). */
  at(t: number): Frame {
    return this.frames[Math.max(0, this.index(t))] as Frame;
  }

  /** Events of the frames with `from < t ≤ to`. */
  events(from: number, to: number): WorldEvent[] {
    const out: WorldEvent[] = [];
    for (let i = this.index(from) + 1; i <= this.index(to); i++)
      out.push(...(this.frames[i] as Frame).events);
    return out;
  }

  /** Index of the last frame with `f.t ≤ t`; −1 before the first. */
  private index(t: number): number {
    let lo = 0;
    let hi = this.frames.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((this.frames[mid] as Frame).t <= t) lo = mid + 1;
      else hi = mid;
    }
    return lo - 1;
  }
}

/** The clip's window inside the run `[t0, t1]`: around the first decision, or the whole run. */
export function span(d: { t: number; ms: number | null } | null, t0: number, t1: number): [number, number] {
  if (!d) return [t0, t1];
  return [Math.max(t0, d.t - (d.ms ?? 0) - LEAD), Math.min(t1, d.t + TAIL)];
}
