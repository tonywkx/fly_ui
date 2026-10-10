import { observer } from 'mobx-react-lite';
import { type RefObject, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import type { DishRun, ReplayStatus } from '@/scene/dish/run';
import { app } from '@/state/app';
import { dish } from '@/state/dish';
import { trial } from '@/state/trial';

/** ←/→ step this many sim ms (Shift: ×10). */
const STEP_MS = 1;

export interface ReplayRefs {
  range: HTMLInputElement | null;
  play: HTMLButtonElement | null;
}

/** Writes the replay clock into the bar (called from the frame loop: no React renders). */
export function paintReplay(b: ReplayRefs, s: ReplayStatus): void {
  const { range, play } = b;
  if (range) {
    range.min = `${s.t0}`;
    range.max = `${s.t1}`;
    range.value = `${s.t}`;
  }
  const on = `${s.playing}`;
  if (play && play.dataset.playing !== on) {
    play.dataset.playing = on;
    play.ariaLabel = t(s.playing ? 'exp.replay.pause' : 'exp.replay.play');
  }
}

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement && !!el.closest('input:not([type=range]), textarea, button, [contenteditable]');

/**
 * The replay's controls under the arena (EXPERIMENT-SHAPE §Replay): play / pause and a hairline
 * scrubber. Keys: Space play / pause, ←/→ step, Esc close; W opens the last run's replay.
 */
export const ReplayBar = observer(function ReplayBar({
  run,
  bar,
}: {
  run: DishRun;
  bar: RefObject<ReplayRefs>;
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || dish.zooming) return;
      if (!trial.replaying) {
        if (e.code !== 'KeyW' || e.repeat || typing(e.target) || !dish.recorded || !trial.replay()) return;
      } else if (e.key === 'Escape') trial.closeReplay();
      else if (e.code === 'Space' && !typing(e.target)) {
        if (!e.repeat) run.toggleReplay();
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !typing(e.target))
        run.stepReplay((e.key === 'ArrowLeft' ? -STEP_MS : STEP_MS) * (e.shiftKey ? 10 : 1));
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [run]);

  if (!trial.replaying) return null;
  return (
    // phones: in the foot's flow over the caption; desktop: centred under the arena
    <div className="pointer-events-auto z-10 flex items-center gap-2 md:absolute md:inset-x-4 md:bottom-8 md:mx-auto md:max-w-[max(16rem,min(32rem,100vw-44rem))]">
      <Button
        ref={(el) => {
          bar.current.play = el;
        }}
        data-playing="false"
        // reduced motion: the decision frame, scrubbed by hand, never played
        disabled={app.reducedMotion}
        aria-label={t('exp.replay.play')}
        aria-keyshortcuts="Space"
        onClick={() => run.toggleReplay()}
        className="group size-8 shrink-0 rounded-full p-0 text-bone"
      >
        <svg viewBox="0 0 16 16" aria-hidden className="size-2.5 fill-current">
          <path className="group-data-[playing=true]:hidden" d="M4 2.5v11l9.5-5.5z" />
          <path className="hidden group-data-[playing=true]:block" d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" />
        </svg>
      </Button>
      <input
        ref={(el) => {
          bar.current.range = el;
        }}
        type="range"
        step={1}
        aria-label={t('exp.replay.scrub')}
        aria-keyshortcuts="ArrowLeft ArrowRight"
        onInput={(e) => run.seekReplay(Number(e.currentTarget.value))}
        className="h-8 min-w-0 flex-1 cursor-pointer touch-none appearance-none focus-visible:[&::-moz-range-thumb]:ring-2 focus-visible:[&::-moz-range-thumb]:ring-bone/60 bg-transparent focus-visible:outline-none [&::-moz-range-thumb]:size-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-bone [&::-moz-range-track]:h-px [&::-moz-range-track]:bg-bone/50 [&::-webkit-slider-runnable-track]:h-px [&::-webkit-slider-runnable-track]:bg-bone/50 [&::-webkit-slider-thumb]:-mt-[0.3125rem] [&::-webkit-slider-thumb]:size-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-bone focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-bone/60"
      />
      {/* phones: the card's «Закрыть» */}
      <Button
        aria-label={t('exp.replay.close')}
        onClick={() => trial.closeReplay()}
        className="h-8 shrink-0 rounded-full px-2 text-caption text-mist ring-1 ring-bone/30 hover:text-bone md:hidden"
      >
        {t('exp.replay.close')}
      </Button>
    </div>
  );
});
