import { neuronAt } from '@fly/data';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { data } from '@/data/store';
import { cn } from '@/lib/utils';
import { app } from '@/state/app';
import { experiment, keyAction, MAX_PROBES, STIM_RANGE, TOOL_KEYS, type Tool } from '@/state/experiment';
import { PROBES } from '@/ui/palette';
import { shareExperiment, shareNote } from '@/ui/share';
import { Tracer } from '@/ui/Tracer';

const TOOLS: { tool: Tool; label: string; hint: string }[] = [
  { tool: 'select', label: 'Select', hint: 'Click a neuron to inspect it.' },
  { tool: 'stimulate', label: 'Stimulate', hint: 'Click or drag across neurons to drive them.' },
  { tool: 'silence', label: 'Silence', hint: 'Click or drag across neurons to silence them.' },
  { tool: 'electrode', label: 'Electrode', hint: 'Click a neuron to place an electrode.' },
  { tool: 'trace', label: 'Trace', hint: 'Click a neuron for From, another for To, or type a cell type.' },
];

const SHARE_LABEL = { idle: 'Share', copied: 'Copied', address: 'In URL' } as const;
const SHARE_KEYS = Object.keys(SHARE_LABEL) as (keyof typeof SHARE_LABEL)[];
const SHARE_STATUS = { copied: 'Link copied', address: 'Copy the link from the address bar' } as const;

/** Keys typed into a field are not hotkeys. */
const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/**
 * Tool rail (Select / Stimulate / Silence / Electrode / Trace, then Share) with the active tool's options above it:
 * stimulus rate and strength, electrode slots, tracer ends and paths. Owns the global hotkeys (V S X E T, C colour mode, Esc).
 * `?ui=<tool>` (snaps) starts with that tool.
 */
export const Toolbar = observer(function Toolbar() {
  useEffect(() => {
    // snaps: `?ui=<tool>` opens with that tool active
    const { ui } = app.params;
    if (ui && ui in TOOL_KEYS) experiment.setTool(ui as Tool);
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || typing(e.target)) return;
      const a = keyAction(e);
      if (!a) return;
      if (a === 'escape') {
        if (experiment.escape()) e.preventDefault();
      } else if (a === 'color') app.cycleColorBy();
      else experiment.setTool(a);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const active = TOOLS.find((t) => t.tool === experiment.tool) ?? TOOLS[0];
  const note = shareNote.get() ?? 'idle';
  return (
    <div className="flex w-full flex-col-reverse items-center gap-1">
      <div
        role="toolbar"
        aria-label="Tools"
        className="pointer-events-auto flex items-center gap-0.5 rounded-panel bg-card p-0.5 backdrop-blur-md"
      >
        {TOOLS.map(({ tool, label }) => (
          <Button
            key={tool}
            aria-pressed={experiment.tool === tool}
            aria-keyshortcuts={TOOL_KEYS[tool]}
            onClick={() => experiment.setTool(tool)}
            className="h-5 gap-1 rounded-full px-1.5 aria-pressed:bg-accent aria-pressed:text-bone"
          >
            {label}
            <kbd className="font-mono text-caption text-mist">{TOOL_KEYS[tool]}</kbd>
          </Button>
        ))}
        <span aria-hidden className="mx-0.5 h-3 w-px bg-border" />
        <Button
          aria-label="Share experiment"
          onClick={() => void shareExperiment()}
          title="Copy a link to this experiment"
          className={cn('h-5 rounded-full px-1.5', note === 'idle' && 'text-ash')}
        >
          {/* every label in one cell: the button keeps its width, the centred rail does not shift */}
          <span aria-hidden className="grid">
            {SHARE_KEYS.map((k) => (
              <span key={k} className={cn('col-start-1 row-start-1 text-center', k !== note && 'invisible')}>
                {SHARE_LABEL[k]}
              </span>
            ))}
          </span>
        </Button>
        <span role="status" className="sr-only">
          {note === 'idle' ? '' : SHARE_STATUS[note]}
        </span>
      </div>
      {active && active.tool !== 'select' && (
        <div
          className={cn(
            'pointer-events-auto flex max-w-full flex-col gap-1 rounded-xl p-2 backdrop-blur-md',
            // the trace panel sits over the lit specimen: denser backing keeps its text legible
            active.tool === 'trace' ? 'w-60 bg-popover' : 'w-50 bg-card',
          )}
        >
          {active.tool === 'stimulate' && <StimControls />}
          {active.tool === 'electrode' && <Probes />}
          {active.tool === 'trace' && <Tracer />}
          <p className="text-caption text-ash">{active.hint}</p>
          <p aria-live="polite" className="text-caption text-mist empty:hidden">
            {active.tool === 'electrode' && experiment.probesFull
              ? `All ${MAX_PROBES} electrodes placed — remove one to move it.`
              : ''}
          </p>
        </div>
      )}
    </div>
  );
});

const StimControls = observer(function StimControls() {
  const { hz, gain } = experiment.stim;
  return (
    <>
      <Range
        label="Rate"
        value={hz}
        range={STIM_RANGE.hz}
        step={10}
        readout={`${hz} Hz`}
        onChange={(v) => experiment.setStim({ hz: v })}
      />
      <Range
        label="Strength"
        value={gain}
        range={STIM_RANGE.gain}
        step={0.05}
        readout={`${gain.toFixed(2)}×`}
        onChange={(v) => experiment.setStim({ gain: v })}
      />
    </>
  );
});

function Range(p: {
  label: string;
  value: number;
  range: readonly [number, number];
  step: number;
  readout: string;
  onChange(v: number): void;
}) {
  return (
    <div className="grid grid-cols-[4rem_1fr_3.5rem] items-center gap-1 text-caption">
      <span className="text-mist">{p.label}</span>
      <Slider
        label={p.label}
        min={p.range[0]}
        max={p.range[1]}
        step={p.step}
        value={[p.value]}
        onValueChange={([v]) => v !== undefined && p.onChange(v)}
        valueText={p.readout}
      />
      <span className="text-right font-mono text-bone tabular-nums">{p.readout}</span>
    </div>
  );
}

const Probes = observer(function Probes() {
  const meta = data.scenario ? data.get(`${data.scenario}-meta`, 'meta') : undefined;
  return (
    <ul aria-label="Electrodes" className="flex flex-col">
      {experiment.probes.map((row, slot) => {
        const name =
          row === null ? null : meta && row < meta.n ? (neuronAt(meta, row).type ?? 'untyped') : `#${row}`;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: slots are fixed positions
          <li key={slot} className="flex h-4 items-center gap-1 text-caption">
            <span
              aria-hidden
              // empty slot: ring in the slot colour, so the colour ↔ slot mapping is learnable up front
              className="size-1.5 shrink-0 rounded-full border-2"
              style={{
                borderColor: PROBES[slot]?.hex,
                background: row === null ? undefined : PROBES[slot]?.hex,
              }}
            />
            <span className="font-mono text-ash tabular-nums">{slot + 1}</span>
            <span className={cn('min-w-0 truncate', row === null ? 'text-ash' : 'text-bone')}>
              {name ?? 'empty'}
            </span>
            {row !== null && (
              <Button
                aria-label={`Remove electrode ${slot + 1} (${name})`}
                className="ml-auto h-4 px-1 text-caption"
                onClick={() => experiment.removeProbe(slot)}
              >
                Remove
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
});
