import { Command } from 'cmdk';
import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useState } from 'react';
import { CLASS_GROUPS, type ColorBy, classGroup } from '@/data/colorBy';
import { data } from '@/data/store';
import { findBodyIds, typeIndex } from '@/data/typeIndex';
import { app } from '@/state/app';
import { experiment, paletteKey } from '@/state/experiment';

const COLOR_ITEMS: { mode: ColorBy; label: string }[] = [
  { mode: 'nt', label: 'transmitter' },
  { mode: 'region', label: 'region' },
  { mode: 'class', label: 'class' },
  { mode: 'male', label: 'male-specific' },
];
/** BodyId matches shown for an all-digits query. */
const MAX_IDS = 8;

const ITEM =
  'flex cursor-default items-center gap-1 rounded-lg px-1 py-0.5 text-label text-mist select-none data-[selected=true]:bg-accent data-[selected=true]:text-bone';

/**
 * ⌘K / Ctrl+K: search the scenario's cell types (or bodyIds by digits) → inspect and fly to it;
 * also switches the colour mode. `?ui=palette` (snaps) opens it.
 */
export const CommandPalette = observer(function CommandPalette() {
  const [open, setOpen] = useState(app.params.ui === 'palette');
  const [query, setQuery] = useState('');
  const meta = data.scenario ? data.get(`${data.scenario}-meta`, 'meta') : undefined;
  const types = useMemo(() => (meta ? typeIndex(meta) : []), [meta]);
  const ids = meta ? findBodyIds(meta, query.trim(), MAX_IDS) : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!paletteKey(e)) return;
      e.preventDefault();
      setOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const inspect = (row: number) => {
    experiment.select(row);
    experiment.flyTo(row);
    close();
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      label="Search cell types"
      loop
      overlayClassName="fixed inset-0 z-40 bg-void/40"
      contentClassName="fixed top-[18%] left-1/2 z-50 w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 overflow-hidden rounded-xl bg-popover backdrop-blur-md"
    >
      <Command.Input
        value={query}
        onValueChange={setQuery}
        placeholder="Cell type or bodyId…"
        className="w-full border-b border-accent bg-transparent px-2 py-1.5 text-body font-extralight text-bone outline-none placeholder:text-ash"
      />
      <Command.List className="max-h-[min(24rem,50vh)] overflow-y-auto overscroll-contain p-0.5 [&_[cmdk-group-heading]]:px-1 [&_[cmdk-group-heading]]:pt-1 [&_[cmdk-group-heading]]:pb-0.5 [&_[cmdk-group-heading]]:text-caption [&_[cmdk-group-heading]]:text-ash">
        <Command.Empty className="px-1 py-2 text-label text-ash">No matching cell type.</Command.Empty>
        {meta && ids.length > 0 && (
          <Command.Group heading="Neurons">
            {ids.map((row) => {
              const id = String(meta.bodyIds[row]);
              const t = meta.type[row] as number;
              return (
                <Command.Item key={id} value={id} onSelect={() => inspect(row)} className={ITEM}>
                  <span className="font-mono text-bone tabular-nums">{id}</span>
                  <span className="text-ash">{meta.strings.types[t] ?? 'untyped'}</span>
                </Command.Item>
              );
            })}
          </Command.Group>
        )}
        <Command.Group heading={`Cell types in ${data.scenario ?? 'scenario'}`}>
          {types.map((e) => (
            <Command.Item
              key={e.type}
              value={e.type}
              onSelect={() => inspect(e.rows[0] as number)}
              className={ITEM}
            >
              <span className="min-w-0 flex-1 truncate text-bone">{e.type}</span>
              <span className="text-caption text-ash">{CLASS_GROUPS[classGroup(e.superclass)]}</span>
              <span className="w-4 text-right font-mono text-caption text-mist tabular-nums">
                {e.rows.length}
              </span>
            </Command.Item>
          ))}
        </Command.Group>
        <Command.Group heading="Colour by">
          {COLOR_ITEMS.map(({ mode, label }) => (
            <Command.Item
              key={mode}
              value={`colour by ${label}`}
              keywords={['color', mode]}
              onSelect={() => {
                app.setColorBy(mode);
                close();
              }}
              className={ITEM}
            >
              <span className="flex-1">Colour by {label}</span>
              {app.colorBy === mode && <span className="text-caption text-ash">current</span>}
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
});
