import { OPERATIONS } from '@fly/sim';
import { observer } from 'mobx-react-lite';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { type Key, t } from '@/i18n';
import { cn } from '@/lib/utils';
import { DISCOVERIES, type Discovery } from '@/scene/dish/discoveries';
import { type Entry, trial } from '@/state/trial';
import { GLYPH } from './DishPalette';
import { cellPath, foundLine, OP_CELL } from './expText';

const title = (d: Discovery) => t(`found.${d.stim}.${d.op}` as Key);

/** What we did, in glyphs: the stimulus and the operated cell («● DNp01 выкл.»). */
function Did({ d }: { d: Discovery }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-caption text-ash">
      {d.stim !== 'none' && (
        <span aria-hidden="true" className={cn('[&_svg]:size-4', GLYPH[d.stim].tone)}>
          {GLYPH[d.stim].icon}
        </span>
      )}
      {d.op !== 'none' && (
        <>
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-saffron" />
          {OP_CELL[d.op]} {t(OPERATIONS[d.op].mode === 'on' ? 'exp.op.onShort' : 'exp.op.offShort')}
        </>
      )}
    </span>
  );
}

/** Which cells: the path, the operated one in saffron. */
function Cells({ d }: { d: Discovery }) {
  const cells = cellPath(d);
  if (!cells.length) return null;
  return (
    <p className="font-mono text-caption text-mist">
      {cells.map((c, i) => (
        <span key={c.cell}>
          {i > 0 && <span className="text-ash">{c.extra ? ' · ' : ' → '}</span>}
          <span className={c.mode ? 'text-saffron' : undefined}>{c.cell}</span>
        </span>
      ))}
    </p>
  );
}

/** A found tile: title; open, what came out of the first run, the cells and «повторить опыт». */
function Found({ d, e, open, onToggle }: { d: Discovery; e: Entry; open: boolean; onToggle: () => void }) {
  const id = useId();
  return (
    <li className={cn('flex flex-col rounded-lg bg-bone/5', open && 'col-span-2 ring-1 ring-bone/15')}>
      <Button
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        className={cn(
          'h-auto flex-col items-stretch gap-1 px-2 py-1.5 text-left whitespace-normal',
          open ? 'hover:bg-transparent' : 'hover:bg-bone/5',
        )}
        onClick={onToggle}
      >
        <Did d={d} />
        <span className="text-label leading-tight text-bone">{title(d)}</span>
      </Button>
      {open && (
        <div
          id={id}
          className="flex flex-col gap-1 px-2 pb-0.5 motion-safe:transition-opacity motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:opacity-0"
        >
          <p className="font-mono text-caption text-mist tabular-nums">{foundLine(e, d)}</p>
          {e.bet && (
            <p className="text-caption text-ash">
              {t('exp.found.bet', { act: t(`exp.act.${e.bet}` as Key) })}
            </p>
          )}
          <Cells d={d} />
          {d.op !== 'none' && <p className="text-caption text-ash">{t(`op.${d.op}.fact` as Key)}</p>}
          <Button
            className="-mx-1 h-8 self-start px-1 text-caption text-mist"
            onClick={() => trial.repeat(d.id)}
          >
            {t('exp.found.again')}
          </Button>
        </div>
      )}
    </li>
  );
}

/** A locked tile: the stimulus and a teaser, never the answer. */
function Locked({ d }: { d: Discovery }) {
  return (
    <li className="flex flex-col gap-1 rounded-lg px-2 py-1.5 ring-1 ring-bone/10">
      <span className="flex items-center gap-1.5 text-caption text-ash">
        {d.stim !== 'none' && (
          <span aria-hidden="true" className="opacity-60 [&_svg]:size-4">
            {GLYPH[d.stim].icon}
          </span>
        )}
        <span aria-hidden="true">?</span>
        <span className="sr-only">{t('exp.found.locked')}</span>
      </span>
      <span className="text-caption leading-tight text-ash">{t(`found.${d.stim}.${d.op}.tease` as Key)}</span>
    </li>
  );
}

/** «Открытия» (EXPERIMENT-SHAPE §Discoveries): the 12 tiles, found ones open in place. */
export const DishFound = observer(function DishFound() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      {trial.allFound && (
        <p className="px-2 text-caption text-mist">{t('exp.found.all', { of: DISCOVERIES.length })}</p>
      )}
      <ul className="grid grid-cols-2 gap-1">
        {DISCOVERIES.map((d) => {
          const e = trial.pairs[d.id];
          return e ? (
            <Found
              key={d.id}
              d={d}
              e={e}
              open={open === d.id}
              onToggle={() => setOpen(open === d.id ? null : d.id)}
            />
          ) : (
            <Locked key={d.id} d={d} />
          );
        })}
      </ul>
    </>
  );
});
