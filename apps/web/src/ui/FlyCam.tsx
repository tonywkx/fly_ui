import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useRef } from 'react';
import { data } from '@/data/store';
import { cn } from '@/lib/utils';
import { Behavior, effectorMask, type FlyPose } from '@/scene/behavior';
import { app } from '@/state/app';
import { experiment } from '@/state/experiment';
import { playback } from '@/state/playback';

/** Above this a part counts as moving in the caption. */
const SHOWN = 0.2;

function caption(p: FlyPose): string {
  const parts: string[] = [];
  if (p.jumpAt !== null) parts.push(`takeoff ${p.jumpAt.toFixed(1)} ms`);
  if (p.proboscis > SHOWN) parts.push('proboscis out');
  if (p.wing > SHOWN) parts.push('wing song');
  return parts.join(' · ') || 'at rest';
}

/**
 * Behaviour camera: the glass fly driven by its motor neurons (TTMn jump, MN9 proboscis, wing MNs
 * song), read from `playback.log` at `playback.clock` in its own rAF — no React renders per frame.
 * Hidden on phones and when the scenario records no motor neurons.
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
      let shown = '';
      const tick = () => {
        if (dead || !cam) return;
        raf = requestAnimationFrame(tick);
        const pose = behavior.update(log, playback.clock.t);
        if (app.reducedMotion) pose.flick = 0;
        cam.render(pose);
        // fade in on the first drawn frame, not over an empty card
        if (box.current) box.current.dataset.ready = '';
        const text = caption(pose);
        if (text !== shown && label.current) {
          shown = text;
          label.current.textContent = text;
          label.current.title = text;
          label.current.dataset.active = String(text !== 'at rest');
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
  // the Inspector shares the right column and may reach down to here: give way while it is open
  const covered = experiment.selected !== null;
  return (
    <figure
      ref={box}
      aria-label="Behaviour camera"
      aria-hidden={covered}
      inert={covered}
      className={cn(
        'pointer-events-auto absolute right-8 bottom-16 z-10 hidden w-53 flex-col gap-1 overflow-hidden rounded-xl bg-card p-2 backdrop-blur-md select-none md:flex',
        'translate-y-1 opacity-0 transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none',
        app.params.snap && 'transition-none',
        covered ? 'pointer-events-none' : 'data-ready:translate-y-0 data-ready:opacity-100',
      )}
    >
      <div ref={host} aria-hidden className="aspect-[4/3] w-full" />
      <figcaption className="flex items-baseline justify-between gap-2 px-1 text-caption">
        <span aria-hidden className="text-ash">
          Behaviour
        </span>
        <span
          ref={label}
          role="status"
          aria-atomic
          className="truncate font-mono text-bone tabular-nums data-[active=true]:text-saffron"
        >
          at rest
        </span>
      </figcaption>
    </figure>
  );
});
