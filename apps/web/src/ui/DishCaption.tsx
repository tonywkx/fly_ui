import { PATHS } from '@fly/sim';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { num, t } from '@/i18n';
import { cn } from '@/lib/utils';
import { app } from '@/state/app';
import { dish } from '@/state/dish';

/** Wall ms a decision's caption stays up (snaps keep it). */
const SHOW_MS = 4000;

/**
 * The last decision under the dish, in the Captions format: phrase + mono term, e.g.
 * «Тень → прыжок · LC4 → DNp01 → TTMn · 8 мс». Forced cells (no sense) name only the command.
 */
export const DishCaption = observer(function DishCaption() {
  const d = dish.decision;
  const [shown, setShown] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new decision restarts the timer
  useEffect(() => {
    setShown(!!d);
    if (!d || app.params.snap) return;
    const id = setTimeout(() => setShown(false), SHOW_MS);
    return () => clearTimeout(id);
  }, [d]);

  const path = d && PATHS[d.action];
  const sensed = d?.ms !== null && d?.ms !== undefined;
  const why = path ? t(sensed ? `dish.why.${path.sense}` : 'dish.why.forced') : '';
  const hops = path ? (sensed ? path.hops : path.hops.slice(-1)).map((h) => h.type).join(' → ') : '';
  const term = d && sensed ? `${hops} · ${t('unit.ms', { v: num(d.ms as number) })}` : hops;

  return (
    <div
      className={cn(
        // phones: under the timecode (the palette owns the bottom); desktop: the Captions slot
        'pointer-events-none absolute inset-x-4 top-16 z-10 mx-auto flex max-w-[32rem] flex-col items-center gap-1 text-center md:top-auto md:bottom-8 md:max-w-[max(16rem,min(32rem,100vw-44rem))]',
      )}
    >
      <p
        aria-live="off"
        data-empty={!shown}
        className="text-body font-light text-balance text-bone transition-opacity duration-200 ease-out motion-reduce:transition-none data-[empty=true]:opacity-0"
      >
        {d && (
          <>
            <span className="whitespace-nowrap">
              {t('dish.why', { why, act: t(`dish.state.${d.action}`) })}
            </span>{' '}
            <span className="font-mono text-caption whitespace-nowrap text-ash tabular-nums">· {term}</span>
          </>
        )}
      </p>
      {/* stays (dim) after the caption fades: the last decision can still be asked about */}
      {d && dish.why && (
        <Button
          data-why
          aria-expanded={dish.whyOpen}
          aria-keyshortcuts="W"
          className={cn(
            'pointer-events-auto h-7 px-2 font-mono text-caption hover:text-bone aria-expanded:invisible',
            shown ? 'text-mist' : 'text-ash',
          )}
          onClick={() => dish.setWhyOpen(!dish.whyOpen)}
        >
          {t('why.open')}
        </Button>
      )}
    </div>
  );
});
