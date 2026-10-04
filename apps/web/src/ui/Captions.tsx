import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useRef } from 'react';
import { data } from '@/data/store';
import { cn } from '@/lib/utils';
import { Behavior, effectorMask } from '@/scene/behavior';
import { beatMask, Dwell, Narrator, SCRIPTS } from '@/scene/captions';
import { continuous } from '@/scene/sound';
import { app } from '@/state/app';
import { playback } from '@/state/playback';
import { hintShown } from '@/ui/IntroHint';

/** Real seconds each line stays up at least while the cascade runs ahead of it. */
const MIN_S = 1.6;

/**
 * Scenario narration: one line per beat of the cascade, started by the spikes themselves
 * (`Narrator`), held long enough to read (`Dwell`). Reads `playback` in its own rAF and writes the
 * DOM directly — no React renders per frame. Gives way to the intro hint.
 */
export const Captions = observer(function Captions() {
  const { log } = playback;
  const script = data.scenario ? SCRIPTS[data.scenario] : undefined;
  const meta = log && script && data.scenario ? data.get(`${data.scenario}-meta`, 'meta') : undefined;
  const masks = useMemo(
    () => (meta && script ? { beats: beatMask(meta, script), body: effectorMask(meta) } : undefined),
    [meta, script],
  );
  const line = useRef<HTMLParagraphElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const time = useRef<HTMLSpanElement>(null);
  const on = app.captions && !!script;
  const hint = hintShown();

  useEffect(() => {
    if (!app.params.snap) return;
    app.waitFor('captions');
    if (!on) app.markReady('captions');
  }, [on]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new log (live takes over) must restart the narration
  useEffect(() => {
    if (!on || !log || !masks || !script) return;
    const narrator = new Narrator(script, masks.beats, new Behavior(masks.body));
    const dwell = new Dwell(MIN_S);
    let shown: unknown = null;
    let prev = playback.clock.t;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = playback.clock.t;
      const follow = continuous(prev, t, playback.rate);
      prev = t;
      const events = narrator.update(log, t);
      const e = events[dwell.pick(events.length, performance.now() / 1000, follow)];
      if (e !== shown && line.current && text.current && time.current) {
        shown = e;
        line.current.dataset.empty = String(!e);
        if (e) {
          text.current.textContent = e.text;
          time.current.textContent = e.missed ? '' : `${e.at.toFixed(1)} ms`;
          if (!app.reducedMotion && !app.params.snap)
            line.current.animate([{ transform: 'translateY(4px)' }, { transform: 'none' }], {
              duration: 200,
              easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
            });
        }
      }
      // a snap holds the clock at `?t=`: ready once the line is the one for that time
      if (!follow) app.markReady('captions');
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [on, log, masks, script]);

  if (!on) return null;
  return (
    <p
      ref={line}
      data-empty="true"
      aria-hidden={hint}
      className={cn(
        // phones: top (the title stack owns the bottom); desktop: under the timeline, clear of the corners
        'pointer-events-none absolute inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-10 mx-auto max-w-[32rem] text-center text-body font-light text-balance text-bone md:top-auto md:bottom-8',
        'transition-opacity duration-200 ease-out motion-reduce:transition-none data-[empty=true]:opacity-0',
        hint && 'opacity-0',
      )}
    >
      <span ref={text} />
      <span
        ref={time}
        className="ml-1 font-mono text-caption whitespace-nowrap text-ash tabular-nums empty:hidden"
      />
    </p>
  );
});
