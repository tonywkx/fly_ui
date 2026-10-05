import type { SpikeTrain } from '@fly/data';
import { bakedEvents, nextSimTime, SpikeLog } from '@/sim/feed';
import type { PlaybackStore } from '@/state/playback';
import type { Engine } from './engine';
import type { NeuronsLayer } from './layers/neurons';

/** Where spikes come from: a log, optionally refilled ahead of the clock (live) or looped (baked). */
export interface Source {
  log: SpikeLog;
  /** Called every frame with the display time (live: keep the Worker ahead of it). */
  pump?(t: number): void;
  /** Loop length in sim ms: the clock wraps to 0 past it. Absent: endless (live). */
  period?: number;
  /** One run in sim ms, where play-once stops (live: the baked run's length). Absent: `period`. */
  run?: number;
}

export interface PlayOptions {
  /** Frozen sim time (`?t=`): held (paused) once the log reaches it, then `onReached` fires. */
  fixed?: number;
  onReached?(): void;
}

/** Baked train on a loop: the whole run, then `tailMs` for the last wave to fade. */
export function bakedSource(train: SpikeTrain, tailMs: number): Source {
  const ev = bakedEvents(train);
  const period = ev.until + tailMs;
  const log = new SpikeLog(Math.max(1, ev.t.length));
  log.push(ev.t, ev.row, period);
  return { log, period };
}

/**
 * Drives the layer's sim clock and last-spike texture from `src` under `ctl` (pause, speed, seeks);
 * publishes the shown time and seekable range to `ctl.clock`. Returns a stop.
 */
export function play(
  engine: Engine,
  layer: NeuronsLayer,
  src: Source,
  ctl: PlaybackStore,
  o: PlayOptions = {},
): () => void {
  const { log } = src;
  ctl.setSource(log, src.period === undefined ? 'live' : 'baked');
  let target = o.fixed;
  if (target !== undefined) ctl.setPaused(true);
  let t = 0;
  let prev: number | undefined;
  log.seek(t, layer.lastSpike);
  layer.commit();
  return engine.onFrame((now) => {
    const frameMs = prev === undefined ? 0 : now - prev;
    prev = now;
    ctl.setRange(log.start, src.period ?? log.until);
    let seek = ctl.takeSeek();
    if (target !== undefined) {
      // live: the sim has to get there first
      src.pump?.(target);
      seek = Math.min(target, log.until);
      if (log.until >= target) {
        target = undefined;
        o.onReached?.();
      }
    }
    let changed = false;
    if (seek !== null) {
      t = seek;
      log.seek(t, layer.lastSpike);
      changed = true;
    } else if (!ctl.paused) {
      const run = src.run ?? src.period;
      if (ctl.once && run !== undefined && t >= run) {
        ctl.finish();
      } else if (src.period !== undefined && t >= src.period) {
        t = 0;
        log.seek(t, layer.lastSpike);
        changed = true;
      } else {
        let next = nextSimTime(t, frameMs, ctl.rate, log.until);
        if (ctl.once && run !== undefined) next = Math.min(next, run);
        changed = log.apply(t, next, layer.lastSpike);
        t = next;
      }
    }
    src.pump?.(t);
    ctl.clock.t = t;
    layer.simTime.value = t;
    if (changed) layer.commit();
  });
}
