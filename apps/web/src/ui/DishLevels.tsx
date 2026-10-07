import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { type Key, t } from '@/i18n';
import { cn } from '@/lib/utils';
import { HINTS, LEVELS } from '@/scene/dish/levels';
import { dish } from '@/state/dish';
import { nowLine } from './DishOps';

const ghost = 'pointer-events-auto h-6 px-2 text-caption text-mist hover:text-bone';

/**
 * The puzzle line (8.12), under the timecode — the void above the dish's far rim: the behaviour to
 * bring about, one hint rung at a time, the success line. No score, no timer.
 * Desktop only until the phone gets the operations (8.14).
 */
export const DishLevels = observer(function DishLevels() {
  const { level, hint, won } = dish;
  const head = useRef<HTMLHeadingElement>(null);
  const reopen = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);
  // «Дальше →» / «Ещё раз» / «Свободный режим» unmount the focused button: keep focus on the line
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new puzzle or a win moves the focus
  useEffect(() => {
    if (!moved.current) {
      moved.current = true;
      return;
    }
    const lost = !document.activeElement || document.activeElement === document.body;
    if (lost) (level === null ? reopen.current : head.current)?.focus();
  }, [level, won]);
  // the dark halo keeps the line legible where it crosses the rim's glow
  const box =
    'pointer-events-none absolute inset-x-0 top-14 z-10 mx-auto hidden w-fit max-w-[max(18rem,min(40rem,100vw-48rem))] flex-col items-center gap-0.5 text-center [text-shadow:0_0_6px_var(--color-void)] md:flex';
  if (level === null)
    return (
      <div className={box}>
        <Button ref={reopen} className={ghost} onClick={() => dish.openLevels()}>
          {t('level.open')}
        </Button>
      </div>
    );
  const l = LEVELS[level];
  if (!l) return null;
  const last = level === LEVELS.length - 1;
  const k = (part: string) => `level.${l.op}.${part}` as Key;
  return (
    <section aria-labelledby="level-goal" className={box}>
      <h2
        ref={head}
        id="level-goal"
        tabIndex={-1}
        className="flex items-center gap-2 text-label text-bone outline-none"
      >
        <span className="font-mono text-caption tracking-widest text-ash uppercase">
          {t('level.of', { n: level + 1, of: LEVELS.length })}
          <span className="sr-only">: </span>
        </span>
        <span aria-hidden="true" className="flex gap-1">
          {LEVELS.map((x, i) => (
            <span
              key={x.op}
              className={cn(
                'size-1 rounded-full',
                dish.solved.has(i) ? 'bg-saffron' : i === level ? 'bg-bone' : 'bg-ash/50',
              )}
            />
          ))}
        </span>
        {t(k('goal'))}
      </h2>
      {/* the latest rung only: each says more than the last, and the line stays short */}
      <p aria-live="polite" className="text-label text-bone">
        {hint > 0 && !won && (
          <span
            key={hint}
            className="block motion-safe:transition-opacity motion-safe:duration-200 motion-safe:starting:opacity-0"
          >
            {t(k(`h${hint}`))}
          </span>
        )}
      </p>
      <p
        role="status"
        className={cn(
          'text-label text-saffron motion-safe:transition-opacity motion-safe:duration-200 motion-safe:starting:opacity-0',
          !won && 'sr-only',
        )}
      >
        {won && `${t('level.won')} · ${nowLine(l.op, won)}`}
      </p>
      {won && last && <p className="text-caption text-bone">{t('level.done')}</p>}
      <div className="flex items-center">
        {won ? (
          <>
            <Button
              className="pointer-events-auto h-6 px-3 text-caption text-bone ring-1 ring-bone/40 hover:bg-bone/10"
              onClick={() => (last ? dish.closeLevels() : dish.nextLevel())}
            >
              {last ? t('level.free') : t('level.next')}
            </Button>
            <Button className={ghost} onClick={() => dish.startLevel(level)}>
              {t('level.again')}
            </Button>
          </>
        ) : (
          <>
            {hint < HINTS && (
              <Button className={ghost} onClick={() => dish.showHint()}>
                {t('level.hint')}
              </Button>
            )}
            {!last && (
              <Button className={ghost} onClick={() => dish.nextLevel()}>
                {t('level.skip')}
              </Button>
            )}
            <Button className={ghost} onClick={() => dish.closeLevels()}>
              {t('level.free')}
            </Button>
          </>
        )}
      </div>
    </section>
  );
});
