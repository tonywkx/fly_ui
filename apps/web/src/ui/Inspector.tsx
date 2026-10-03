import { type NeuronRecord, neuronAt } from '@fly/data';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { type PartnerGroup, type Partners, partners } from '@/data/partners';
import { data } from '@/data/store';
import { cn } from '@/lib/utils';
import { app } from '@/state/app';
import { experiment } from '@/state/experiment';
import { FOCUS, MALE, NT_COLORS } from '@/ui/palette';

/** Partner types listed per side before "+N more". */
const TOP_TYPES = 8;
const SIDES = { L: 'left', R: 'right', M: 'midline' } as const;

const words = (s: string | null) => s?.replaceAll('_', ' ') ?? null;
const fmt = new Intl.NumberFormat('en-US');

interface Shown {
  row: number;
  n: NeuronRecord;
  p: Partners | null;
}

/**
 * Selected neuron: identity, actions (stimulate / silence / fly to) and its inputs and outputs within
 * the scenario circuit. Stays mounted (fades out with the last neuron); Esc closes.
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

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') experiment.select(null);
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  return (
    <aside
      aria-label="Inspector"
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
      {s && <Body s={s} />}
    </aside>
  );
});

const Body = observer(function Body({ s: { row, n, p } }: { s: Shown }) {
  const stimulated = experiment.stimulated.has(row);
  const silenced = experiment.silenced.has(row);
  const cls = [words(n.superclass), words(n.class)].filter(Boolean).join(' · ');

  return (
    <>
      <header className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <h2 className="truncate text-body leading-tight font-normal text-bone">{n.type ?? 'untyped'}</h2>
          <p className="font-mono text-caption text-ash tabular-nums">{n.bodyId}</p>
        </div>
        <Button
          aria-label="Close inspector"
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
        <Fact label="Transmitter">
          <span className="flex items-center gap-1">
            <Dot color={NT_COLORS[n.nt ?? 'unclear'].hex} />
            {n.nt ?? 'unknown'}
            {n.ntConf !== null && (
              <span className="font-mono text-ash tabular-nums">{Math.round(n.ntConf * 100)}% pred.</span>
            )}
          </span>
        </Fact>
        {cls && <Fact label="Class">{cls}</Fact>}
        {n.region && <Fact label="Region">{n.region}</Fact>}
        {n.somaSide && <Fact label="Soma">{SIDES[n.somaSide]}</Fact>}
        {n.maleSpecific && (
          <Fact label="Sex">
            <span className="flex items-center gap-1">
              <Dot color={MALE.hex} />
              male-specific
            </span>
          </Fact>
        )}
      </dl>

      <div className="mt-3 flex items-center gap-1">
        <Button variant="primary" aria-pressed={stimulated} onClick={() => experiment.toggleStim(row)}>
          {stimulated ? 'Stop stimulus' : 'Stimulate'}
        </Button>
        <Button
          aria-pressed={silenced}
          className={cn(silenced && 'text-bone')}
          onClick={() => experiment.toggleSilence(row)}
        >
          {silenced ? 'Unsilence' : 'Silence'}
        </Button>
        <Button onClick={() => experiment.flyTo(row)}>Fly to</Button>
      </div>
      <LiveNote />

      {p ? (
        <>
          <PartnerList title="Inputs" color={FOCUS.input.hex} groups={p.inputs} />
          <PartnerList title="Outputs" color={FOCUS.output.hex} groups={p.outputs} />
          <p className="mt-3 text-caption text-ash">Synapse counts within the {data.scenario} circuit.</p>
        </>
      ) : (
        <p className="mt-3 text-caption text-ash">Connectivity not loaded.</p>
      )}
    </>
  );
});

const LiveNote = observer(function LiveNote() {
  const text =
    experiment.live === 'loading'
      ? 'Loading the whole-CNS simulation…'
      : experiment.live === 'failed' && experiment.touched
        ? 'Live simulation unavailable — showing the recorded run.'
        : null;
  return (
    <p aria-live="polite" className="mt-1 min-h-[1lh] text-caption text-ash">
      {text}
    </p>
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
  const rest = groups.length - TOP_TYPES;
  return (
    <section className="mt-3">
      <h3 className="flex items-baseline gap-1 text-caption text-mist">
        <span className="flex items-center gap-1 self-center text-bone">
          <Dot color={color} />
          {title}
        </span>
        <span className="ml-auto font-mono text-ash tabular-nums">
          {groups.length} types · {fmt.format(syn)} syn
        </span>
      </h3>
      {groups.length === 0 ? (
        <p className="mt-1 text-caption text-ash">None in this circuit.</p>
      ) : (
        <ul className="mt-1 flex flex-col">
          {groups.slice(0, TOP_TYPES).map((g) => (
            <li key={`${g.type}-${g.top}`}>
              <button
                type="button"
                onClick={() => experiment.select(g.top)}
                title={`Inspect the strongest ${g.type ?? 'untyped'} partner`}
                className="-mx-1 flex w-[calc(100%+--spacing(2))] cursor-pointer items-center gap-1 rounded-md px-1 py-0.5 text-left text-caption text-mist outline-none transition-colors duration-150 hover:bg-accent hover:text-bone focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Dot color={NT_COLORS[g.nt ?? 'unclear'].hex} />
                <span className="min-w-0 truncate">{g.type ?? 'untyped'}</span>
                {g.count > 1 && <span className="font-mono text-ash tabular-nums">×{g.count}</span>}
                <span className="ml-auto font-mono text-ash tabular-nums">{fmt.format(g.synapses)}</span>
              </button>
            </li>
          ))}
          {rest > 0 && <li className="px-0 py-0.5 text-caption text-ash">+{rest} more types</li>}
        </ul>
      )}
    </section>
  );
}
