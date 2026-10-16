import { observer } from 'mobx-react-lite';
import { Button } from '@/components/ui/button';
import {
  COLOR_BY,
  type ColorBy,
  colorGroups,
  type LegendEntry,
  type RegionPart,
  regionPart,
} from '@/data/colorBy';
import { data } from '@/data/store';
import { plural, t, tOr } from '@/i18n';
import { app } from '@/state/app';

const HEAD = 'py-0.5 font-mono text-caption tracking-widest text-ash uppercase';

/** Region rows under the tour's three words (legend rows come in group order, so runs are contiguous). */
function byPart(legend: LegendEntry[]) {
  const parts: { part: RegionPart | null; rows: LegendEntry[] }[] = [];
  for (const e of legend) {
    const part = regionPart(e.label);
    const last = parts.at(-1);
    if (last && last.part === part) last.rows.push(e);
    else parts.push({ part, rows: [e] });
  }
  return parts;
}

/** A group: swatch + plain name; the neuron count is the hover title (and read out), not a column. */
function Row({ e, mode }: { e: LegendEntry; mode: ColorBy }) {
  const count = plural('count.neurons', e.count);
  return (
    <li title={count} className="flex items-center gap-1 py-0.5">
      <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: e.swatch.hex }} />
      <span className="min-w-0 flex-1 truncate text-bone">{tOr(`group.${mode}.${e.label}`, e.label)}</span>
      <span className="sr-only">{count}</span>
    </li>
  );
}

/**
 * Colour mode switch (C cycles) and the legend of the groups present in the scenario, with names —
 * hue is never the only cue. Regions sit under the tour's eyes / brain / nerve cord. Hidden on phones
 * and in `?debug=` modes.
 */
export const Legend = observer(function Legend() {
  const meta = data.scenario ? data.get(`${data.scenario}-meta`, 'meta') : undefined;
  const mode = app.colorBy;
  if (!meta || app.params.debug) return null;
  const { legend } = colorGroups(meta, mode);

  return (
    <section
      aria-label={t('legend.label')}
      className="pointer-events-auto absolute top-8 left-8 z-10 hidden w-57 flex-col gap-1 rounded-xl bg-card p-2 backdrop-blur-md transition-opacity duration-200 ease-out starting:opacity-0 md:flex"
    >
      <fieldset aria-label={t('legend.colorBy')} className="flex items-center gap-0.5">
        {COLOR_BY.map((m) => (
          <Button
            key={m}
            aria-pressed={mode === m}
            aria-keyshortcuts="C"
            onClick={() => app.setColorBy(m)}
            className="h-5 flex-1 rounded-full px-1.5 text-caption aria-pressed:bg-accent aria-pressed:text-bone"
          >
            {t(`mode.${m}`)}
          </Button>
        ))}
        <kbd className="px-0.5 font-mono text-caption text-mist">C</kbd>
      </fieldset>
      {mode === 'region' ? (
        <ul className="grid grid-cols-[auto_1fr] gap-x-2 px-1 pb-0.5 text-caption">
          {byPart(legend).map(({ part, rows }) => (
            <li key={part ?? 'rest'} className="col-span-2 grid grid-cols-subgrid">
              {part && <p className={HEAD}>{t(`legend.part.${part}`)}</p>}
              <ul className="col-start-2 flex flex-col">
                {rows.map((e) => (
                  <Row key={e.label} e={e} mode={mode} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col px-1 pb-0.5 text-caption">
          {legend.map((e) => (
            <Row key={e.label} e={e} mode={mode} />
          ))}
        </ul>
      )}
    </section>
  );
});
