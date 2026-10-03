import { type Csr, type NeuronTable, neuronAt } from '@fly/data';
import type { Net } from '@fly/sim';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';
import type uPlot from 'uplot';
import { data } from '@/data/store';
import type { SpikeLog } from '@/sim/feed';
import { probe, scenarioNet, voltage } from '@/sim/trace';
import { experiment } from '@/state/experiment';
import { playback } from '@/state/playback';
import { PROBES, TEXT } from '@/ui/palette';

/** Sim ms shown per scope (2.5 s of wall time at 1×). */
const SCOPE_MS = 100;

const nets = new WeakMap<Csr, Net>();
/** The scenario's sim net, built on first use. */
function netOf(graph: Csr, meta: NeuronTable): Net {
  let net = nets.get(graph);
  if (!net) {
    const types = Array.from(meta.type, (t) => meta.strings.types[t] ?? null);
    net = scenarioNet(graph, meta.sign, types);
    nets.set(graph, net);
  }
  return net;
}

/**
 * One mini oscilloscope per placed electrode, in its slot's column and colour: the membrane potential
 * of the last `SCOPE_MS` up to the playhead, rebuilt from the spike log (`sim/trace.ts`).
 */
export const Scopes = observer(function Scopes() {
  const { log } = playback;
  const meta = data.scenario ? data.get(`${data.scenario}-meta`, 'meta') : undefined;
  const graph = data.scenario ? data.get(`${data.scenario}-graph`, 'graph') : undefined;
  const placed = experiment.probes.flatMap((row, slot) => (row === null ? [] : [{ row, slot }]));
  if (!log || !meta || !graph || placed.length === 0) return null;
  const net = netOf(graph, meta);

  return (
    <section aria-label="Oscilloscopes" className="grid w-[min(44rem,100%,100vw-30rem)] grid-cols-4 gap-1">
      {placed.map(({ row, slot }) => (
        <Scope
          key={slot}
          slot={slot}
          row={row}
          name={row < meta.n ? (neuronAt(meta, row).type ?? 'untyped') : `#${row}`}
          log={log}
          net={net}
        />
      ))}
    </section>
  );
});

interface ScopeProps {
  slot: number;
  row: number;
  name: string;
  log: SpikeLog;
  net: Net;
}

/** Redrawn in its own rAF from `playback.clock`, only when the time or the log horizon moved. */
function Scope({ slot, row, name, log, net }: ScopeProps) {
  const box = useRef<HTMLDivElement>(null);
  const color = PROBES[slot]?.hex ?? TEXT.bone;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const p = probe(net, row);
    let dead = false;
    let raf = 0;
    let ro: ResizeObserver | undefined;
    let plot: uPlot | undefined;
    void import('@/ui/scope').then(({ createScope, drawScope }) => {
      if (dead) return;
      const u = createScope(el, color);
      plot = u;
      let drawn = { t: Number.NaN, until: Number.NaN };
      const draw = () => {
        const { t } = playback.clock;
        drawn = { t, until: log.until };
        const { x, y } = voltage(log, p, Math.max(0, t - SCOPE_MS), t);
        drawScope(u, x, y, t - SCOPE_MS, t);
      };
      ro = new ResizeObserver(() => {
        u.setSize({ width: el.clientWidth, height: el.clientHeight });
        draw();
      });
      ro.observe(el);
      const tick = () => {
        raf = requestAnimationFrame(tick);
        if (playback.clock.t !== drawn.t || log.until !== drawn.until) draw();
      };
      tick();
    });
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      plot?.destroy();
    };
  }, [log, net, row, color]);

  return (
    <figure
      role="img"
      aria-label={`Electrode ${slot + 1}: ${name} membrane potential`}
      title={`${name}: −64…−40 mV, spikes clipped · dashed threshold, dotted rest`}
      className="flex min-w-0 flex-col gap-0.5 rounded-panel bg-card px-3 pt-1.5 pb-2 backdrop-blur-md"
      style={{ gridColumnStart: slot + 1 }}
    >
      <figcaption className="flex items-center gap-1 text-caption">
        <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
        <span className="font-mono text-ash tabular-nums">{slot + 1}</span>
        <span className="min-w-0 truncate text-bone">{name}</span>
      </figcaption>
      <div ref={box} aria-hidden className="h-10 w-full" />
    </figure>
  );
}
