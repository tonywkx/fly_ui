import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useRef } from 'react';
import { data } from '@/data/store';
import { num, t } from '@/i18n';
import { cn } from '@/lib/utils';
import { Behavior, effectorMask, type FlyPose, SHOWN } from '@/scene/behavior';
import { app } from '@/state/app';
import { experiment } from '@/state/experiment';
import { playback } from '@/state/playback';
import { tour } from '@/state/tour';
import { bigFlyCam } from './tour/TourChrome';

/** What the fly is doing; empty at rest. */
function caption(p: FlyPose): string {
  const parts: string[] = [];
  if (p.jumpAt !== null) parts.push(t('flycam.takeoff', { ms: num(p.jumpAt, undefined, 1) }));
  if (p.proboscis > SHOWN) parts.push(t('flycam.proboscis'));
  if (p.wing > SHOWN) parts.push(t('flycam.wing'));
  return parts.join(' · ');
}

/**
 * Behaviour camera: the glass fly driven by its motor neurons (TTMn jump, MN9 proboscis, wing MNs
 * song), read from `playback.log` at `playback.clock` in its own rAF — no React renders per frame.
 * Hidden on phones (except the tour's runs) and when the scenario records no motor neurons.
 */
export const FlyCam = observer(function FlyCam() {
  const { log } = playback;
  const meta = log && data.scenario ? data.get(`${data.scenario}-meta`, 'meta') : undefined;
  const mask = useMemo(() => (meta ? effectorMask(meta) : undefined), [meta]);
  const moves = useMemo(() => !!mask && new Behavior(mask).any, [mask]);
  const box = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!app.params.snap) return;
    app.waitFor('flycam');
    // nothing to draw (no motor neurons / no data): do not hold the snap
    if (!moves) app.markReady('flycam');
  }, [moves]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new log (live takes over) must restart the readout
  useEffect(() => {
    const el = host.current;
    if (!el || !log || !mask || !moves) return;
    const behavior = new Behavior(mask);
    let dead = false;
    let raf = 0;
    let cam: import('@/scene/flycam/flycam').FlyCam | undefined;
    void import('@/scene/flycam/flycam').then(async ({ FlyCam: Cam }) => {
      if (dead) return;
      cam = new Cam(el);
      await cam.init();
      let shown: string | null = null;
      const tick = () => {
        if (dead || !cam) return;
        raf = requestAnimationFrame(tick);
        const pose = behavior.update(log, playback.clock.t);
        if (app.reducedMotion) pose.flick = 0;
        cam.render(pose);
        // fade in on the first drawn frame, not over an empty card
        if (box.current) box.current.dataset.ready = '';
        const doing = caption(pose);
        const text = doing || t('flycam.rest');
        if (text !== shown && label.current) {
          shown = text;
          label.current.textContent = text;
          label.current.title = text;
          label.current.dataset.active = String(doing !== '');
        }
        app.markReady('flycam');
      };
      tick();
    });
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      cam?.dispose();
    };
  }, [log, mask, moves]);

  if (!moves) return null;
  // the Inspector opens in the same corner: give way while it is open; the tour shows it from its run on
  const covered = experiment.selected !== null || (tour.state !== null && tour.state.step < 2);
  // the tour's runs: twice the size (phones: a wide strip at the top)
  const big = bigFlyCam();
  return (
    <figure
      ref={box}
      aria-label={t('flycam.label')}
      aria-hidden={covered}
      inert={covered}
      className={cn(
        'pointer-events-auto absolute top-8 right-8 z-10 hidden w-53 flex-col gap-1 overflow-hidden rounded-xl bg-card p-2 backdrop-blur-md select-none md:flex',
        big &&
          'inset-x-4 top-[max(1rem,env(safe-area-inset-top))] flex w-auto md:inset-x-auto md:top-8 md:right-8 md:w-96',
        '-translate-y-1 opacity-0 transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none',
        app.params.snap && 'transition-none',
        covered ? 'pointer-events-none' : 'data-ready:translate-y-0 data-ready:opacity-100',
      )}
    >
      <div
        ref={host}
        aria-hidden
        className={cn('aspect-[4/3] w-full', big && 'aspect-auto h-36 md:aspect-[4/3] md:h-auto')}
      />
      <figcaption className="flex items-baseline justify-between gap-2 px-1 text-caption">
        <span aria-hidden className="text-ash">
          {t('flycam.title')}
        </span>
        <span
          ref={label}
          role="status"
          aria-atomic
          className="truncate font-mono text-bone tabular-nums data-[active=true]:text-saffron"
        >
          {t('flycam.rest')}
        </span>
      </figcaption>
    </figure>
  );
});
