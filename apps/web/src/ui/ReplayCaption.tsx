import { PATHS } from '@fly/sim';
import { observer } from 'mobx-react-lite';
import { type Key, num, plural, t } from '@/i18n';
import { cn } from '@/lib/utils';
import type { WhyHop } from '@/scene/dish/why';
import { dish } from '@/state/dish';
import { trial } from '@/state/trial';

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
 * The replay's caption (EXPERIMENT-SHAPE §Replay, was the 8.11 «why?» card): the run's decision as
 * the chain sense → path → command with this run's first-spike times and cells that fired; a missed
 * decision shows the norm's chain and where the signal stopped.
 */
export const ReplayCaption = observer(function ReplayCaption() {
  const r = dish.recorded;
  const d = r?.e;
  const why = r?.why;
  if (!r || !d || !why) return <p className="px-2 text-label text-mist">{t('exp.replay.none')}</p>;
  const forced = d.ms === null;
  const sense = PATHS[d.action].sense;
  const silent = why.find((h) => h.fired === 0);
  // a hop on the strongest path stayed silent while the command fired: the signal went round it
  const bypass = !r.missed && !forced && !!silent && !!why.at(-1)?.fired;
  const side = d.side && (sense === 'loom' || sense === 'female') ? ` ${t(`why.side.${d.side}`)}` : '';

  return (
    <div className="flex flex-col gap-2.5 px-2">
      <h3 className="text-body leading-tight text-bone">
        {t(r.missed ? (`why.title.not.${d.action}` as Key) : `why.title.${d.action}`)}
      </h3>
      {forced ? (
        <p className="text-label text-mist">
          {t(trial.op !== 'none' || dish.brain ? 'why.forced' : 'why.unprompted', {
            type: why.at(-1)?.type ?? '',
          })}
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
      {r.missed && (
        <p className="text-label text-mist">
          {silent
            ? t('why.missed', { type: silent.type })
            : t('why.missed.weak', { type: why.at(-1)?.type ?? '' })}
        </p>
      )}
      {!forced && (
        <p className="text-caption text-ash">
          {t('why.note')}
          {bypass && <span className="block text-mist">{t('why.bypass')}</span>}
        </p>
      )}
    </div>
  );
});
