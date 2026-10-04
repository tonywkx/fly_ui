import { observer } from 'mobx-react-lite';
import { useEffect, useMemo } from 'react';
import { data } from '@/data/store';
import { Behavior, effectorMask } from '@/scene/behavior';
import { clicks, continuous } from '@/scene/sound';
import { app } from '@/state/app';
import { experiment } from '@/state/experiment';
import { playback } from '@/state/playback';

/** Most ticks per frame (≈480/s at 60 fps): a volley beyond that is thinned, each tick louder. */
const MAX_TICKS = 8;
/** Ticks go out this far ahead of the context clock (s), so a frame's spikes keep their spacing. */
const AHEAD_S = 0.03;
/** Song level changes smaller than this do not reschedule the ramp. */
const SONG_EPS = 0.02;

let ctx: AudioContext | undefined;

/**
 * Sound on/off. Must run inside the user's gesture: the AudioContext is created / resumed here,
 * synchronously, because the audio module itself loads lazily (autoplay policy).
 */
export function toggleSound() {
  const on = !app.sound;
  if (on) {
    ctx ??= new AudioContext({ latencyHint: 'interactive' });
    void ctx.resume();
  } else void ctx?.suspend();
  app.setSound(on);
}

/**
 * Audio monitor: spikes as ticks (only the electrodes' rows when any are placed, else the whole
 * population, thinned) and the pulse song while the wing MNs fire. Reads `playback` in its own
 * rAF like the behaviour camera; renders nothing. Silent while paused, on seeks and loop wraps.
 */
export const Sound = observer(function Sound() {
  const { log } = playback;
  const on = app.sound && !app.params.snap;
  const meta = log && data.scenario ? data.get(`${data.scenario}-meta`, 'meta') : undefined;
  const mask = useMemo(() => (meta ? effectorMask(meta) : undefined), [meta]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new log (live takes over) must restart the monitor
  useEffect(() => {
    if (!on || !log || !ctx) return;
    const context = ctx;
    const behavior = mask ? new Behavior(mask) : undefined;
    let dead = false;
    let raf = 0;
    let audio: import('@/scene/audio').Audio | undefined;
    void import('@/scene/audio').then(({ Audio }) => {
      if (dead) return;
      audio = new Audio(context);
      if (import.meta.env.DEV) (window as { flySound?: unknown }).flySound = audio;
      let prev = playback.clock.t;
      let level = 0;
      const tick = () => {
        if (dead || !audio) return;
        raf = requestAnimationFrame(tick);
        const t = playback.clock.t;
        const rate = playback.rate;
        const moving = continuous(prev, t, rate);
        if (moving) {
          const probes = experiment.probes.filter((r): r is number => r !== null);
          const at = audio.now + AHEAD_S;
          for (const c of clicks(log, prev, t, rate, {
            max: MAX_TICKS,
            rows: probes.length ? probes : undefined,
          }))
            audio.tick(at + c.dt, c.gain);
        }
        // gated by pause, not by `moving`: a frame the clock skips must not stutter the song
        const wing = behavior && !playback.paused ? behavior.update(log, t).wing : 0;
        if (Math.abs(wing - level) > SONG_EPS || (wing === 0 && level !== 0)) {
          level = wing;
          audio.song(level);
        }
        prev = t;
      };
      tick();
    });
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      audio?.dispose();
    };
  }, [on, log, mask]);

  return null;
});
