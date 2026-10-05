import { Command } from 'cmdk';
import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useState } from 'react';
import { CLASS_GROUPS, type ColorBy, classGroup } from '@/data/colorBy';
import { data } from '@/data/store';
import { findBodyIds, typeIndex } from '@/data/typeIndex';
import { type Key, t, tOr } from '@/i18n';
import { app } from '@/state/app';
import { experiment, paletteKey } from '@/state/experiment';
import { toggleSound } from '@/ui/Sound';
import { shareExperiment } from '@/ui/share';
import { scenarioTitle } from '@/ui/viewer';

const COLOR_ITEMS: { mode: ColorBy; label: Key }[] = (['nt', 'region', 'class', 'male'] as const).map(
  (mode) => ({
    mode,
    label: `palette.mode.${mode}`,
  }),
);
/** BodyId matches shown for an all-digits query. */
const MAX_IDS = 8;

const ITEM =
  'flex cursor-default items-center gap-1 rounded-lg px-1 py-0.5 text-label text-mist select-none data-[selected=true]:bg-accent data-[selected=true]:text-bone data-[selected=true]:*:text-bone';

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
      label={t('palette.label')}
      loop
      overlayClassName="fixed inset-0 z-40 bg-void/60"
      contentClassName="fixed top-[18%] left-1/2 z-50 w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 overflow-hidden rounded-xl bg-popover backdrop-blur-md"
    >
      <Command.Input
        value={query}
        onValueChange={setQuery}
        placeholder={t('palette.placeholder')}
        className="w-full bg-transparent px-2 pt-1.5 pb-1 text-body font-extralight text-bone outline-none placeholder:text-mist"
      />
      <Command.List className="max-h-[min(24rem,50vh)] overflow-y-auto overscroll-contain p-0.5 [&_[cmdk-group-heading]]:px-1 [&_[cmdk-group-heading]]:pt-1 [&_[cmdk-group-heading]]:pb-0.5 [&_[cmdk-group-heading]]:text-caption [&_[cmdk-group-heading]]:text-ash">
        <Command.Empty className="px-1 py-2 text-label text-ash">{t('palette.empty')}</Command.Empty>
        {meta && ids.length > 0 && (
          <Command.Group heading={t('palette.neurons')}>
            {ids.map((row) => {
              const id = String(meta.bodyIds[row]);
              const type = meta.type[row] as number;
              return (
                <Command.Item key={id} value={id} onSelect={() => inspect(row)} className={ITEM}>
                  <span className="font-mono text-bone tabular-nums">{id}</span>
                  <span className="text-mist">{meta.strings.types[type] ?? t('neuron.untyped')}</span>
                </Command.Item>
              );
            })}
          </Command.Group>
        )}
        <Command.Group heading={t('palette.experiment')}>
          <Command.Item
            value={t('share.aria')}
            keywords={['link', 'copy', 'url', 'share', 'share experiment']}
            onSelect={() => {
              void shareExperiment();
              close();
            }}
            className={ITEM}
          >
            {t('share.aria')}
          </Command.Item>
          <Command.Item
            value={t('follow.label')}
            keywords={['director', 'camera', 'follow', 'follow the activity']}
            onSelect={() => {
              app.toggleDirector();
              close();
            }}
            className={ITEM}
          >
            <span className="flex-1">{t('follow.label')}</span>
            {app.director && <span className="text-caption text-mist">{t('palette.on')}</span>}
          </Command.Item>
          <Command.Item
            value={t('sound.label')}
            keywords={['audio', 'mute', 'clicks', 'song', 'sound']}
            onSelect={() => {
              toggleSound();
              close();
            }}
            className={ITEM}
          >
            <span className="flex-1">{t('sound.label')}</span>
            {app.sound && <span className="text-caption text-mist">{t('palette.on')}</span>}
          </Command.Item>
          <Command.Item
            value={t('palette.captions')}
            keywords={['narration', 'subtitles', 'story', 'captions']}
            onSelect={() => {
              app.toggleCaptions();
              close();
            }}
            className={ITEM}
          >
            <span className="flex-1">{t('palette.captions')}</span>
            {app.captions && <span className="text-caption text-mist">{t('palette.on')}</span>}
          </Command.Item>
        </Command.Group>
        <Command.Group heading={t('legend.colorBy')}>
          {COLOR_ITEMS.map(({ mode, label }) => (
            <Command.Item
              key={mode}
              value={t('palette.colorBy', { mode: t(label) })}
              keywords={['color', 'colour', mode]}
              onSelect={() => {
                app.setColorBy(mode);
                close();
              }}
              className={ITEM}
            >
              <span className="flex-1">{t('palette.colorBy', { mode: t(label) })}</span>
              {app.colorBy === mode && <span className="text-caption text-mist">{t('palette.current')}</span>}
            </Command.Item>
          ))}
        </Command.Group>
        <Command.Group
          heading={t('palette.types', { scenario: scenarioTitle(data.scenario ?? '', 'title') })}
        >
          {types.map((e) => (
            <Command.Item
              key={e.type}
              value={e.type}
              onSelect={() => inspect(e.rows[0] as number)}
              className={ITEM}
            >
              <span className="min-w-0 flex-1 truncate text-bone">{e.type}</span>
              <span className="text-caption text-mist">
                {tOr(`group.class.${CLASS_GROUPS[classGroup(e.superclass)]}`, '')}
              </span>
              <span className="w-4 text-right font-mono text-caption text-mist tabular-nums">
                {e.rows.length}
              </span>
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
});
