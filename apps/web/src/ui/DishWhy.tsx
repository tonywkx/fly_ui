import { OPERATIONS, PATHS } from '@fly/sim';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { type Key, num, plural, t } from '@/i18n';
import { cn } from '@/lib/utils';
import { OP_OF, type WhyHop } from '@/scene/dish/why';
import { dish } from '@/state/dish';

/** Path cells with a plain name; the rest are «interneuron». */
const NAMED = new Set(['LC4', 'DNp01', 'TTMn', 'LB3', 'LB1', 'MN9', 'MDN', 'LC10a', 'pIP10']);
const name = (type: string) => t(`why.cell.${NAMED.has(type) ? type : 'other'}` as Key);
const ms = (v: number) => t('unit.ms', { v: `+${num(Math.round(v))}` });

function Hop({ h, last }: { h: WhyHop; last: boolean }) {
  const lit = h.fired === null || h.fired > 0;
  const silent = h.fired === 0;
  return (
    <li className="relative flex items-baseline justify-between gap-3 pl-5">
      <span
        aria-hidden="true"
        className={cn(
          'absolute top-1.5 left-0.5 rounded-full',
          last ? 'size-2 -translate-x-px' : 'size-1.5',
          lit ? 'bg-saffron' : 'bg-void ring-1 ring-ash/60',
        )}
      />
      <span title={`${h.type} · ${name(h.type)}`} className="min-w-0 truncate text-label text-bone">
        <span className="font-mono">{h.type}</span> <span className="text-mist">· {name(h.type)}</span>
      </span>
      <span className={cn('shrink-0 font-mono text-caption tabular-nums', silent ? 'text-ash' : 'text-bone')}>
        {h.fired === null ? (
          <span className="text-ash">{plural('op.cells', h.cells)}</span>
        ) : silent ? (
          t('why.silent')
        ) : (
          <>
            {h.ms !== null && ms(h.ms)}
            {/* phones: the time only, so the names fit */}
            <span aria-hidden="true" className={cn('text-ash', h.ms !== null && 'max-md:hidden')}>
              {h.ms !== null && ' · '}
              {h.fired}/{h.cells}
            </span>
            <span className="sr-only">{t('why.fired', { n: h.fired, of: h.cells })}</span>
          </>
        )}
      </span>
    </li>
  );
}

/**
 * «Why did the fly do that?» (8.11): the last decision's chain sense → path → command with the live
 * run's first-spike times and cells that fired. Opening it freezes the dish (the caller holds the
 * run); the button leads to the operation that tests the decision.
 */
export const DishWhy = observer(function DishWhy() {
  const { decision: d, why, whyOpen } = dish;
  const card = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || dish.zooming) return;
      if ((e.target as HTMLElement).closest('input, textarea, [contenteditable]')) return;
      if (e.key === 'Escape' && dish.whyOpen) dish.setWhyOpen(false);
      else if (e.code === 'KeyW') dish.setWhyOpen(!dish.whyOpen);
      else return;
      e.preventDefault();
    };
    // a press outside closes it (the «why?» toggle handles itself)
    const down = (e: PointerEvent) => {
      const el = e.target as HTMLElement;
      if (dish.whyOpen && !card.current?.contains(el) && !el.closest('[data-why]')) dish.setWhyOpen(false);
    };
    window.addEventListener('keydown', key);
    window.addEventListener('pointerdown', down);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('pointerdown', down);
    };
  }, []);

  // focus into the card on open, back to the «why?» toggle on close
  const was = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on open / close
  useEffect(() => {
    if (whyOpen) close.current?.focus({ preventScroll: true });
    else if (was.current) document.querySelector<HTMLElement>('[data-why]')?.focus({ preventScroll: true });
    was.current = whyOpen;
  }, [whyOpen]);

  if (!whyOpen || !d || !why) return null;
  const op = OP_OF[d.action];
  const forced = d.ms === null;
  const restore = forced && dish.ops.has(op) && OPERATIONS[op].mode === 'on';
  const sense = PATHS[d.action].sense;
  // a hop on the strongest path stayed silent while the command fired: the signal went round it
  const bypass = !forced && why.some((h) => h.fired === 0) && !!why.at(-1)?.fired;
  const side = d.side && (sense === 'loom' || sense === 'female') ? ` ${t(`why.side.${d.side}`)}` : '';

  return (
    <section
      ref={card}
      role="dialog"
      aria-labelledby="why-h"
      className={cn(
        'pointer-events-auto absolute inset-x-4 top-28 z-20 flex flex-col gap-2.5 rounded-xl bg-card p-4 backdrop-blur-md',
        'md:inset-x-auto md:top-auto md:bottom-24 md:left-1/2 md:w-90 md:-translate-x-1/2',
        'motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:translate-y-1 motion-safe:starting:opacity-0',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 id="why-h" className="text-body text-bone">
          {t(`why.title.${d.action}`)}
        </h2>
        <Button
          ref={close}
          aria-label={t('why.close')}
          className="-mt-1 -mr-2 size-8 shrink-0 rounded-full font-mono text-label text-mist hover:text-bone focus-visible:ring-bone/60"
          onClick={() => dish.setWhyOpen(false)}
        >
          ×
        </Button>
      </div>
      {forced ? (
        <p className="text-label text-mist">
          {t(restore || dish.brain ? 'why.forced' : 'why.unprompted', { type: why.at(-1)?.type ?? '' })}
        </p>
      ) : (
        <p className="flex items-baseline justify-between gap-3 text-label text-bone">
          <span>
            {t(`why.sense.${sense}`)}
            {side}
          </span>
          <span className="font-mono text-caption tabular-nums">{t('unit.ms', { v: 0 })}</span>
        </p>
      )}
      <ol className="relative flex flex-col gap-1.5 before:absolute before:top-2 before:bottom-2 before:left-[0.4375rem] before:w-px before:bg-ash/40">
        {why.map((h, i) => (
          <Hop key={h.type} h={h} last={i === why.length - 1} />
        ))}
      </ol>
      {!forced && (
        <p className="text-caption text-ash">
          {t('why.note')}
          {bypass && <span className="block text-mist">{t('why.bypass')}</span>}
        </p>
      )}
      {restore ? (
        <Button
          variant="primary"
          className="h-8 self-start px-3 text-caption"
          onClick={() => {
            dish.toggleOp(op);
            dish.setWhyOpen(false);
          }}
        >
          {t('op.restore')}
        </Button>
      ) : (
        // the surgeon panel is desktop-only until 8.14
        <Button
          className="hidden h-8 self-start px-0 text-caption text-bone underline-offset-4 hover:underline md:inline-flex"
          onClick={() => {
            dish.setOpen(op);
            dish.setWhyOpen(false);
          }}
        >
          {t('why.test', { name: t(`op.${op}.name`) })}
        </Button>
      )}
    </section>
  );
});
