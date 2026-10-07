import { observer } from 'mobx-react-lite';
import { Button } from '@/components/ui/button';
import { type Key, t } from '@/i18n';
import { cn } from '@/lib/utils';
import { HINTS, LEVELS } from '@/scene/dish/levels';
import { dish } from '@/state/dish';
import { nowLine } from './DishOps';

const ghost = 'h-8 px-2 text-caption text-mist hover:text-bone';

/**
 * The puzzle strip (8.12), top-left: the behaviour to bring about, a hint ladder, the success line.
 * No score, no timer; closing it is free play. Desktop only until the phone gets the operations (8.14).
 */
export const DishLevels = observer(function DishLevels() {
  const { level, hint, won } = dish;
  const box = 'pointer-events-auto absolute top-10 left-8 z-10 hidden md:flex';
  if (level === null)
    return (
      <div className={box}>
        <Button className={ghost} onClick={() => dish.openLevels()}>
          {t('level.open')}
        </Button>
      </div>
    );
  const l = LEVELS[level];
  if (!l) return null;
  const last = level === LEVELS.length - 1;
  const k = (part: string) => `level.${l.op}.${part}` as Key;
  return (
    <section
      aria-labelledby="level-goal"
      className={cn(box, 'w-72 flex-col gap-2 rounded-xl bg-card p-3 backdrop-blur-md')}
    >
      <div className="flex items-center gap-2">
        <p className="flex-1 font-mono text-caption tracking-widest text-ash uppercase">
          {t('level.of', { n: level + 1, of: LEVELS.length })}
        </p>
        <ol className="flex items-center">
          {LEVELS.map((x, i) => (
            <li key={x.op}>
              <Button
                aria-label={t('level.of', { n: i + 1, of: LEVELS.length })}
                aria-current={i === level ? 'step' : undefined}
                className="size-6 p-0"
                onClick={() => dish.startLevel(i)}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-1.5 rounded-full',
                    dish.solved.has(i) ? 'bg-saffron' : 'ring-1 ring-ash/60',
                    i === level && 'ring-2 ring-bone',
                  )}
                />
              </Button>
            </li>
          ))}
        </ol>
        <Button
          aria-label={t('level.free')}
          title={t('level.free')}
          className="-mr-1 size-6 p-0 font-mono text-label text-mist hover:text-bone"
          onClick={() => dish.closeLevels()}
        >
          ×
        </Button>
      </div>
      <h2 id="level-goal" className="text-label text-bone">
        {t(k('goal'))}
      </h2>
      {/* the latest rung only: each one says more than the last, and the strip stays short */}
      <p aria-live="polite" className={cn('text-caption text-bone', (hint === 0 || won) && 'hidden')}>
        {hint > 0 && !won && (
          <span
            key={hint}
            className="block motion-safe:transition-opacity motion-safe:duration-200 motion-safe:starting:opacity-0"
          >
            {t(k(`h${hint}`))}
          </span>
        )}
      </p>
      <p role="status" className={cn('text-caption text-saffron', !won && 'sr-only')}>
        {won && `${t('level.won')} · ${nowLine(l.op, won)}`}
      </p>
      {won && last && <p className="text-caption text-bone">{t('level.done')}</p>}
      <div className="-mx-2 -mb-1 flex items-center">
        {won ? (
          <>
            <Button
              className="h-8 px-3 text-caption text-bone ring-1 ring-bone/40 hover:bg-bone/10"
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
          </>
        )}
      </div>
    </section>
  );
});
