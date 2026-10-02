import type { SpikeTrain } from '@fly/data';
import { bakedEvents, NEVER, nextSimTime, SpikeFeed } from '@/sim/feed';
import type { Engine } from './engine';
import type { NeuronsLayer } from './layers/neurons';

/** Where spikes come from: a feed, optionally refilled ahead of the clock (live) or looped (baked). */
export interface Source {
  feed: SpikeFeed;
  /** Called every frame with the display time (live: keep the Worker ahead of it). */
  pump?(t: number): void;
  /** Loop length in sim ms; `restart` refills the feed from t = 0. Absent: endless. */
  period?: number;
  restart?(): void;
}

export interface PlayOptions {
  /** Sim ms per real second. */
  rate: number;
  /** Frozen sim time (`?t=`): shown once the feed reaches it, then `onReached` fires. */
  fixed?: number;
  onReached?(): void;
}

/** Baked train on a loop: the whole run, then `tailMs` for the last wave to fade. */
export function bakedSource(train: SpikeTrain, tailMs: number): Source {
  const ev = bakedEvents(train);
  const period = ev.until + tailMs;
  const feed = new SpikeFeed(Math.max(1, ev.t.length));
  const restart = () => {
    feed.reset();
    feed.push(ev.t, ev.row, period);
  };
  restart();
  return { feed, period, restart };
}

/** Drives the layer's sim clock and last-spike texture from `src`; returns a stop. */
export function play(engine: Engine, layer: NeuronsLayer, src: Source, o: PlayOptions): () => void {
  layer.lastSpike.fill(NEVER);
  layer.commit();
  let t = 0;
  let prev: number | undefined;
  let reached = false;
  return engine.onFrame((now) => {
    const frameMs = prev === undefined ? 0 : now - prev;
    prev = now;
    const { feed } = src;
    let changed = false;
    if (o.fixed !== undefined) {
      src.pump?.(o.fixed);
      t = Math.min(o.fixed, feed.until);
      if (!reached && feed.until >= o.fixed) {
        reached = true;
        o.onReached?.();
      }
    } else {
      if (src.period !== undefined && t >= src.period) {
        t = 0;
        src.restart?.();
        layer.lastSpike.fill(NEVER);
        changed = true;
      }
      t = nextSimTime(t, frameMs, o.rate, feed.until);
      src.pump?.(t);
    }
    layer.simTime.value = t;
    if (feed.drain(t, layer.lastSpike) || changed) layer.commit();
  });
}
