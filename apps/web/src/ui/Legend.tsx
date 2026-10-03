import { observer } from 'mobx-react-lite';
import { Button } from '@/components/ui/button';
import { type ColorBy, colorGroups } from '@/data/colorBy';
import { data } from '@/data/store';
import { app } from '@/state/app';

const MODES: { mode: ColorBy; label: string }[] = [
  { mode: 'nt', label: 'Transmitter' },
  { mode: 'region', label: 'Region' },
  { mode: 'class', label: 'Class' },
  { mode: 'male', label: 'Male' },
];

/**
 * Colour mode switch (C cycles) and the legend of the groups present in the scenario, with names and
 * neuron counts — hue is never the only cue. Hidden on phones and in `?debug=` modes.
 */
export const Legend = observer(function Legend() {
  const meta = data.scenario ? data.get(`${data.scenario}-meta`, 'meta') : undefined;
  const mode = app.colorBy;
  if (!meta || app.params.debug) return null;
  const { legend } = colorGroups(meta, mode);

  return (
    <section
      aria-label="Colour legend"
      className="pointer-events-auto absolute top-8 left-8 z-10 hidden w-57 flex-col gap-1 rounded-xl bg-card p-2 backdrop-blur-md md:flex"
    >
      <fieldset aria-label="Colour by" className="flex items-center gap-0.5">
        {MODES.map(({ mode: m, label }) => (
          <Button
            key={m}
            aria-pressed={mode === m}
            aria-keyshortcuts="C"
            onClick={() => app.setColorBy(m)}
            className="h-5 flex-1 rounded-full px-1.5 text-caption aria-pressed:bg-accent aria-pressed:text-bone"
          >
            {label}
          </Button>
        ))}
        <kbd className="px-0.5 font-mono text-caption text-mist">C</kbd>
      </fieldset>
      <ul className="flex flex-col px-1 pb-0.5 text-caption">
        {legend.map((e) => (
          <li key={e.label} className="flex items-center gap-1 py-0.5">
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: e.swatch.hex }}
            />
            <span className="min-w-0 flex-1 truncate text-bone">{e.label}</span>
            <span className="font-mono text-mist tabular-nums">{e.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
});
