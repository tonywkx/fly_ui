import { type NeuronRecord, neuronAt } from '@fly/data';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { type PartnerGroup, type Partners, partners } from '@/data/partners';
import { data } from '@/data/store';
import { num, plural, t } from '@/i18n';
import { cn } from '@/lib/utils';
import { app } from '@/state/app';
import { experiment } from '@/state/experiment';
import { FOCUS, MALE, NT_COLORS } from '@/ui/palette';
import { scenarioTitle } from '@/ui/viewer';

/** Partner types listed per side before "+N more". */
const TOP_TYPES = 8;

const words = (s: string | null) => s?.replaceAll('_', ' ') ?? null;

interface Shown {
  row: number;
  n: NeuronRecord;
  p: Partners | null;
}

/**
 * Selected neuron: identity, actions (stimulate / silence / fly to) and its inputs and outputs within
 * the scenario circuit. Stays mounted (fades out with the last neuron); Esc closes (`Toolbar` hotkeys).
 */
export const Inspector = observer(function Inspector() {
  const meta = data.scenario ? data.get(`${data.scenario}-meta`, 'meta') : undefined;
  const graph = data.scenario ? data.get(`${data.scenario}-graph`, 'graph') : undefined;
  const row = experiment.selected;
  const open = row !== null && !!meta && row < meta.n;
  const last = useRef<Shown | null>(null);
  if (open && last.current?.row !== row) {
    last.current = { row, n: neuronAt(meta, row), p: graph ? partners(graph, meta, row) : null };
  }
  const s = last.current;

  return (
    <aside
      aria-label={t('inspector.label')}
      aria-hidden={!open}
      inert={!open}
      className={cn(
        'absolute z-10 flex flex-col overflow-y-auto overscroll-contain rounded-xl bg-card p-3 backdrop-blur-md',
        // phone: bottom sheet; wider: right column
        'inset-x-2 bottom-2 max-h-[55%] md:inset-x-auto md:top-8 md:right-8 md:bottom-auto md:max-h-[calc(100%-4rem)] md:w-53',
        'transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none',
        app.params.snap && 'transition-none',
        open
          ? 'translate-x-0 opacity-100'
          : 'pointer-events-none translate-y-1 opacity-0 md:translate-x-1 md:translate-y-0',
      )}
    >
      {s && <Body key={s.row} s={s} />}
    </aside>
  );
});

const Body = observer(function Body({ s: { row, n, p } }: { s: Shown }) {
  const stimulated = experiment.stimulated.has(row);
  const silenced = experiment.silenced.has(row);
  const cls = [words(n.superclass), words(n.class)].filter(Boolean).join(' · ');
  // keyboard users land in the panel when it opens or switches neuron
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => title.current?.focus({ preventScroll: true }), []);

  return (
    <>
      <header className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <h2
            ref={title}
            tabIndex={-1}
            className="truncate text-body leading-tight font-normal text-bone outline-none"
          >
            {n.type ?? t('neuron.untyped')}
          </h2>
          <p className="font-mono text-caption text-ash tabular-nums">{n.bodyId}</p>
        </div>
        <Button
          aria-label={t('inspector.close')}
          className="-mt-1 -mr-1 size-6 p-0"
          onClick={() => experiment.select(null)}
        >
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="size-3"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
        </Button>
      </header>

      <dl className="mt-2 flex flex-col gap-0.5 text-caption text-mist">
        <Fact label={t('inspector.nt')}>
          <span className="flex items-center gap-1">
            <Dot color={NT_COLORS[n.nt ?? 'unclear'].hex} />
            {n.nt ? t(`group.nt.${n.nt}`) : t('inspector.unknown')}
            {n.ntConf !== null && (
              <span className="font-mono text-ash tabular-nums">
                {t('neuron.pred', { p: Math.round(n.ntConf * 100) })}
              </span>
            )}
          </span>
        </Fact>
        {cls && <Fact label={t('inspector.class')}>{cls}</Fact>}
        {n.region && <Fact label={t('inspector.region')}>{n.region}</Fact>}
        {n.somaSide && <Fact label={t('inspector.soma')}>{t(`side.${n.somaSide}`)}</Fact>}
        {n.maleSpecific && (
          <Fact label={t('inspector.sex')}>
            <span className="flex items-center gap-1">
              <Dot color={MALE.hex} />
              {t('neuron.maleSpecific')}
            </span>
          </Fact>
        )}
      </dl>

      <div className="mt-3 flex items-center gap-1">
        <Button variant="primary" aria-pressed={stimulated} onClick={() => experiment.toggleStim(row)}>
          {t(stimulated ? 'inspector.stopStim' : 'inspector.stimulate')}
        </Button>
        <Button
          aria-pressed={silenced}
          className="aria-pressed:bg-accent aria-pressed:text-bone"
          onClick={() => experiment.toggleSilence(row)}
        >
          {t(silenced ? 'inspector.unsilence' : 'inspector.silence')}
        </Button>
        <Button onClick={() => experiment.flyTo(row)}>{t('inspector.flyTo')}</Button>
      </div>
      <LiveNote />

      {p ? (
        <>
          <PartnerList title={t('inspector.inputs')} color={FOCUS.input.hex} groups={p.inputs} />
          <PartnerList title={t('inspector.outputs')} color={FOCUS.output.hex} groups={p.outputs} />
          <p className="mt-3 text-caption text-ash">
            {t('inspector.footnote', { scenario: scenarioTitle(data.scenario ?? '', 'title') })}
          </p>
        </>
      ) : (
        <p className="mt-3 text-caption text-ash">{t('inspector.noConnectivity')}</p>
      )}
    </>
  );
});

const LiveNote = observer(function LiveNote() {
  const text =
    experiment.live === 'loading'
      ? t('live.loading')
      : experiment.live === 'failed' && experiment.touched
        ? t('live.failed')
        : null;
  return (
    <div aria-live="polite" className="text-caption text-ash">
      {text && <p className="mt-1">{text}</p>}
    </div>
  );
});

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[--spacing(12)_1fr] gap-1">
      <dt className="text-ash">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span aria-hidden className="size-1 shrink-0 rounded-full" style={{ background: color }} />;
}

function PartnerList({ title, color, groups }: { title: string; color: string; groups: PartnerGroup[] }) {
  const syn = groups.reduce((a, g) => a + g.synapses, 0);
  const [all, setAll] = useState(false);
  const shown = all ? groups : groups.slice(0, TOP_TYPES);
  const rest = groups.length - shown.length;
  return (
    <section className="mt-3">
      <h3 className="flex items-baseline gap-1 text-label text-mist">
        <span className="flex items-center gap-1 self-center text-bone">
          <Dot color={color} />
          {title}
        </span>
        <span className="ml-auto font-mono text-caption text-ash tabular-nums">
          {plural('count.types', groups.length)} · {t('trace.syn', { n: syn })}
        </span>
      </h3>
      {groups.length === 0 ? (
        <p className="mt-1 text-caption text-ash">{t('inspector.none')}</p>
      ) : (
        <ul className="mt-1 flex flex-col">
          {shown.map((g) => (
            <li key={`${g.type}-${g.top}`}>
              <button
                type="button"
                onClick={() => experiment.select(g.top)}
                aria-label={t('inspector.partner', {
                  type: g.type ?? t('neuron.untyped'),
                  neurons: plural('count.neurons', g.count),
                  synapses: plural('count.synapses', g.synapses),
                })}
                className="-mx-1 flex w-[calc(100%+--spacing(2))] cursor-pointer items-center gap-1 rounded-md px-1 py-0.5 text-left text-caption text-mist outline-none transition-colors duration-150 hover:bg-accent hover:text-bone focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Dot color={NT_COLORS[g.nt ?? 'unclear'].hex} />
                <span className="min-w-0 truncate">{g.type ?? t('neuron.untyped')}</span>
                {g.count > 1 && <span className="font-mono text-ash tabular-nums">×{g.count}</span>}
                <span className="ml-auto font-mono text-ash tabular-nums">{num(g.synapses)}</span>
              </button>
            </li>
          ))}
          {rest > 0 && (
            <li>
              <Button className="-mx-1 h-auto py-0.5 text-caption" onClick={() => setAll(true)}>
                {plural('inspector.more', rest)}
              </Button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
