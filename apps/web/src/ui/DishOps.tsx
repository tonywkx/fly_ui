import { OPERATIONS } from '@fly/sim';
import { observer } from 'mobx-react-lite';
import { Button } from '@/components/ui/button';
import { type Key, plural, t } from '@/i18n';
import { cn } from '@/lib/utils';
import { OPS, type Op, type Outcome, USUAL } from '@/scene/dish/verdict';
import { dish } from '@/state/dish';

/** Mono term on the closed card. */
const ID: Record<Op, string> = { panic: 'DNp01', moon: 'MDN', sugar: 'LB3', p1: 'P1' };
/** Types inferred, not named in the dataset (LB3 = sugar, pC1 = P1): source chip «inferred». */
const GUESS: ReadonlySet<Op> = new Set(['sugar', 'p1']);

const k = (op: Op, part: string) => `op.${op}.${part}` as Key;

function usual(op: Op): string {
  const u = USUAL[op];
  return op === 'moon' ? t('op.moon.usual') : t(k(op, 'did'), { hz: u.hz, ms: u.ms ?? 0 });
}

function now(op: Op, o: Outcome | undefined): string {
  if (!o) return t('op.try', { hint: t(k(op, 'try')) });
  const line = op === 'panic' && o.line === 'verdict' && o.hit ? 'verdict_hit' : o.line;
  return t(k(op, line), { hz: o.hz, ms: o.ms ?? 0 });
}

const Card = observer(function Card({ op }: { op: Op }) {
  const open = dish.open === op;
  const on = dish.ops.has(op);
  const o = dish.now[op];
  const body = `op-${op}`;
  return (
    <div className={cn('rounded-lg transition-colors duration-200 ease-out', open && 'bg-bone/5')}>
      <h3 className="contents">
        <Button
          id={`${body}-h`}
          aria-expanded={open}
          aria-controls={open ? body : undefined}
          className="h-8 w-full justify-start gap-2 px-2 text-mist focus-visible:ring-offset-0 hover:text-bone aria-expanded:text-bone"
          onClick={() => dish.toggleOpen(op)}
        >
          <span
            aria-hidden="true"
            className={cn('size-1.5 shrink-0 rounded-full', on ? 'bg-saffron' : 'ring-1 ring-ash/60')}
          />
          {on && <span className="sr-only">{t('op.active')}</span>}
          <span className="flex-1 text-left">{t(k(op, 'name'))}</span>
          {!open && <span className="font-mono text-caption text-ash">{ID[op]}</span>}
        </Button>
      </h3>
      {open && (
        <section
          id={body}
          aria-labelledby={`${body}-h`}
          className="flex flex-col gap-2 px-2 pb-2 motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:-translate-y-1 motion-safe:starting:opacity-0"
        >
          <p className="font-mono text-caption text-mist">
            {t(k(op, 'term'))}
            {dish.cells && <span className="tabular-nums"> · {plural('op.cells', dish.cells[op])}</span>}
          </p>
          <p className="text-label text-bone">{t(k(op, 'role'))}</p>
          <p className="text-caption text-mist">{t(k(op, 'fact'))}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-caption tabular-nums">
            <dt className="font-mono text-mist">{t('op.usual')}</dt>
            <dd className="text-mist">{usual(op)}</dd>
            <dt className="font-mono text-mist">{t('op.now')}</dt>
            <dd className={cn(!o ? 'text-ash' : o.line === 'verdict' ? 'text-saffron' : 'text-bone')}>
              {now(op, o)}
            </dd>
          </dl>
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="primary"
              aria-pressed={on}
              className="h-8 px-3 text-caption aria-pressed:bg-transparent aria-pressed:text-bone aria-pressed:ring-1 aria-pressed:ring-bone/40 aria-pressed:hover:bg-bone/10"
              onClick={() => dish.toggleOp(op)}
            >
              {on ? t('op.restore') : t(OPERATIONS[op].mode === 'on' ? 'op.on' : 'op.off')}
            </Button>
            <span className="text-right font-mono text-caption text-mist">
              {t(GUESS.has(op) ? 'op.src.guess' : 'op.src.data')}
            </span>
          </div>
        </section>
      )}
    </div>
  );
});

/**
 * The neurosurgeon (TERRARIUM-SHAPE §Operations): four famous-neuron cards, one open, each with a
 * switch on the live brain and «usually / now» lines. Desktop: the right column; phone in 8.14.
 * The latest outcome is announced from one live region that outlives the cards.
 */
export const DishOps = observer(function DishOps({ onClearBrain }: { onClearBrain: () => void }) {
  const { last, brain } = dish;
  return (
    <section
      aria-label={t('op.title')}
      className="pointer-events-auto absolute top-1/2 right-8 z-10 hidden w-57 -translate-y-1/2 flex-col gap-0.5 rounded-xl bg-card p-2 backdrop-blur-md md:flex"
    >
      <h2 className="px-2 pb-1 font-mono text-caption tracking-widest text-ash uppercase">{t('op.title')}</h2>
      {OPS.map((op) => (
        <Card key={op} op={op} />
      ))}
      {/* what the visitor did in the brain view, carried back by the zoom */}
      {brain && (
        <div className="mt-1 flex items-center justify-between gap-1 pl-2">
          <p className="text-caption text-bone">
            {t('op.brain')}{' '}
            <span className="font-mono text-ash tabular-nums">{t('op.brain.cells', brain)}</span>
          </p>
          <Button className="h-8 px-2 text-caption text-mist" onClick={onClearBrain}>
            {t('op.restore')}
          </Button>
        </div>
      )}
      {dish.ops.size > 0 && (
        <Button
          className="mt-1 h-8 justify-start px-2 text-caption text-mist"
          onClick={() => dish.clearOps()}
        >
          {t('op.clear')}
        </Button>
      )}
      <p role="status" className="sr-only">
        {last && `${t(k(last, 'name'))}: ${now(last, dish.now[last])}`}
      </p>
    </section>
  );
});
