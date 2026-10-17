import { type Decision, OPERATIONS, PATHS } from '@fly/sim';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { num, t } from '@/i18n';
import { cn } from '@/lib/utils';
import { app } from '@/state/app';
import { dish } from '@/state/dish';
import { trial } from '@/state/trial';
import { PULL_GLYPH, puppetHops } from './puppet';

/** Wall ms a decision's caption stays up (snaps keep it). */
const SHOW_MS = 4000;

/**
 * The last decision under the dish, in the Captions format: phrase + mono term, e.g.
 * «Тень → прыжок · LC4 → DNp01 → TTMn · 8 мс». Forced cells (no sense) name only the command.
 * Before any, on desktop: the palette hint.
 */
export const DishCaption = observer(function DishCaption() {
  const d = dish.decision;
  const [shown, setShown] = useState(false);
  // free play's decisions for screen readers; a run's is the card's to announce
  const [said, setSaid] = useState('');
  const line = useRef<HTMLParagraphElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new decision restarts the timer
  useEffect(() => {
    setShown(!!d);
    setSaid(d && trial.phase !== 'running' ? (line.current?.textContent ?? '') : '');
    if (!d || app.params.snap) return;
    const id = setTimeout(() => setShown(false), SHOW_MS);
    return () => clearTimeout(id);
  }, [d]);

  const path = d && PATHS[d.action];
  const sensed = d?.ms !== null && d?.ms !== undefined;
  const pull = d?.pull;
  // no sense of its own: an operation switched the command on, another sense set it off
  // (the shadow → MDN), or it fired after the stimulus was gone (swatter × DNp01 off, once struck)
  const on = !!d && !sensed && !pull && drivenOn(d.action);
  const via = d && !sensed && !pull && !on ? d.via : undefined;
  const why = !path
    ? ''
    : pull
      ? t('dish.why.puppet', { key: PULL_GLYPH[pull] })
      : t(
          sensed
            ? `dish.why.${path.sense}`
            : via
              ? `dish.why.${via.sense}`
              : on
                ? 'dish.why.forced'
                : 'dish.why.unprompted',
        );
  const shownHops = !path ? [] : pull ? puppetHops(pull) : sensed ? path.hops : path.hops.slice(-1);
  const hops = shownHops.map((h) => h.type).join(' → ');
  const ms = sensed ? (d?.ms as number) : via?.ms;
  const term = ms === undefined ? hops : `${hops} · ${t('unit.ms', { v: num(ms) })}`;
  // the replay's caption is in the card
  if (trial.replaying) return null;

  return (
    <div
      className={cn(
        // phones: under the timecode / puzzle strip (`--band-top`, Dish); desktop: the Captions slot
        'pointer-events-none absolute inset-x-4 top-[calc(var(--band-top,6rem)+0.25rem)] z-10 mx-auto flex max-w-[32rem] flex-col items-center gap-1 text-center md:top-auto md:bottom-8 md:max-w-[max(16rem,min(32rem,100vw-44rem))]',
      )}
    >
      {/* desktop: how the palette works, until the first encounter or run */}
      {!d && dish.empty && trial.run === 0 && (
        <p className="hidden text-caption text-ash md:block">{t('pal.hint')}</p>
      )}
      <p role="status" className="sr-only">
        {said}
      </p>
      <p
        ref={line}
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
      {/* stays (dim) after the caption fades: the last run's decision can still be asked about */}
      {d && dish.recorded && trial.phase === 'result' && (
        <Button
          aria-keyshortcuts="W"
          className={cn(
            'pointer-events-auto h-7 px-2 font-mono text-caption hover:text-bone',
            shown ? 'text-mist' : 'text-ash',
          )}
          onClick={() => trial.replay()}
        >
          {t('why.open')}
        </Button>
      )}
    </div>
  );
});

/** The slot's operation or the brain's cells drive this decision's command. */
function drivenOn(action: Decision): boolean {
  const cmd = PATHS[action].hops.at(-1)?.type ?? '';
  const op = trial.op;
  return (
    !!trial.applied?.on || (op !== 'none' && OPERATIONS[op].mode === 'on' && OPERATIONS[op].types.test(cmd))
  );
}
