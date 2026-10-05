import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useRef } from 'react';
import { data } from '@/data/store';
import { num, tOr, t as tr } from '@/i18n';
import { cn } from '@/lib/utils';
import { Behavior, effectorMask } from '@/scene/behavior';
import { beatMask, Dwell, Narrator, SCRIPTS } from '@/scene/captions';
import { continuous } from '@/scene/sound';
import { app } from '@/state/app';
import { playback } from '@/state/playback';
import { tour } from '@/state/tour';
import { bigFlyCam } from './tour/TourChrome';

/** Real seconds each line stays up at least while the cascade runs ahead of it. */
const MIN_S = 1.6;

/**
 * Scenario narration: one line per beat of the cascade, started by the spikes themselves
 * (`Narrator`), held long enough to read (`Dwell`). Reads `playback` in its own rAF and writes the
 * DOM directly — no React renders per frame.
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
  const tag = useRef<HTMLSpanElement>(null);
  // not under the tour's narration (the baked loop plays beneath it)
  const on = app.captions && !!script && tour.state?.step !== 0;
  const lang = app.lang;

  useEffect(() => {
    if (!app.params.snap) return;
    app.waitFor('captions');
    if (!on) app.markReady('captions');
  }, [on]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new log (live takes over) or language must restart the narration
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
      if (e !== shown && line.current && text.current && tag.current) {
        shown = e;
        line.current.dataset.empty = String(!e);
        if (e) {
          text.current.textContent = tOr(e.text, e.text, lang);
          // the dataset's term, else when it happened (a body beat); a missing body beat has neither
          const suffix = e.term ?? (e.missed ? '' : tr('unit.ms', { v: num(e.at, lang, 1) }, lang));
          tag.current.textContent = suffix && `· ${suffix}`;
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
  }, [on, log, masks, script, lang]);

  if (!on) return null;
  return (
    <p
      ref={line}
      data-empty="true"
      className={cn(
        // phones: top (the title stack owns the bottom); desktop: under the timeline, clear of the corners
        'pointer-events-none absolute inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-10 mx-auto max-w-[32rem] text-center text-body font-light text-balance text-bone md:top-auto md:bottom-8 md:max-w-[max(16rem,min(32rem,100vw-44rem))]',
        'transition-opacity duration-200 ease-out motion-reduce:transition-none data-[empty=true]:opacity-0',
        // phones: under the tour's FlyCam strip
        bigFlyCam() && 'top-[calc(max(1rem,env(safe-area-inset-top))+17rem)]',
      )}
    >
      <span ref={text} />
      <span
        ref={tag}
        className="ml-1 font-mono text-caption whitespace-nowrap text-ash tabular-nums empty:hidden"
      />
    </p>
  );
});
