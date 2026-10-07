import { reaction } from 'mobx';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { data } from '@/data/store';
import { type Key, num, t } from '@/i18n';
import type { DishRun, DishStatus } from '@/scene/dish/run';
import { QUALITY } from '@/scene/quality';
import { app } from '@/state/app';
import { Credit } from './Credit';
import { DishPalette } from './DishPalette';
import { LangSwitch } from './LangSwitch';
import { ViewSwitch } from './ViewSwitch';

function timecode(s: DishStatus): string {
  if (s.loading) return t('dish.loading');
  const word = s.paused ? t('dish.paused') : t(`dish.state.${s.flash ?? s.action}` as Key);
  return `${t('dish.timecode', { t: num(s.t / 1000, undefined, 3) })} · ${word}`;
}

/** The remove button sits this far (px) up-right of the hovered item's centre. */
const REMOVE_OFFSET = { x: 24, y: -30 };

/**
 * The Terrarium (`?view=dish`): the dish scene with its live brain, the timecode line, the palette
 * and the hovered item's remove button. The line and the button are written from the frame loop
 * straight into the DOM — no React renders per frame.
 */
export const Dish = observer(function Dish() {
  const { manifest } = data;
  const host = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLParagraphElement>(null);
  const remove = useRef<HTMLButtonElement>(null);
  const hovered = useRef<number | null>(null);
  const [run, setRun] = useState<DishRun | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the manifest arriving starts the dish
  useEffect(() => {
    const el = host.current;
    if (!el || !manifest) return;
    const chunk = (id: string) => manifest.chunks.find((c) => c.id === id);
    const graph = chunk('graph-full');
    const meta = chunk('meta-full');
    if (!graph || !meta) {
      console.error('[dish] graph-full / meta-full missing from the manifest');
      app.markReady('frame');
      return;
    }
    const { snap, t: until, items, gl } = app.params;
    if (snap) app.waitFor('sim');
    let disposed = false;
    let dispose = () => {};
    void import('@/scene/dish/run').then(({ DishRun }) => {
      if (disposed) return;
      const run = new DishRun(el, {
        forceWebGL: gl === 'webgl2',
        reducedMotion: app.reducedMotion,
        graphUrl: data.url(graph),
        metaUrl: data.url(meta),
        until: snap ? (until ?? 0) : undefined,
        onReady: () => app.markReady('sim'),
        onStatus: (s) => {
          const text = timecode(s);
          if (line.current && line.current.textContent !== text) line.current.textContent = text;
          const b = remove.current;
          hovered.current = s.hover?.id ?? null;
          if (!b) return;
          b.hidden = !s.hover;
          if (s.hover)
            b.style.transform = `translate(${s.hover.x + REMOVE_OFFSET.x}px, ${s.hover.y + REMOVE_OFFSET.y}px) translate(-50%, -50%)`;
        },
      });
      for (const it of items ?? []) run.input.place(it.kind, it);
      setRun(run);
      const quality = reaction(
        () => app.quality,
        (q) => run.applyQuality(QUALITY[q]),
      );
      dispose = () => {
        quality();
        run.dispose();
        setRun(null);
      };
      run
        .start()
        .then((backend) => {
          app.setBackend(backend);
          run.applyQuality(QUALITY[app.quality]);
          app.markReady('frame');
        })
        .catch((e) => {
          console.error('[dish] renderer failed', e);
          app.setRendererFailed();
        });
    });
    return () => {
      disposed = true;
      dispose();
    };
  }, [manifest]);

  return (
    <>
      <div ref={host} className="absolute inset-0" role="img" aria-label={t('dish.label')} />
      <p
        ref={line}
        aria-live="off"
        className="pointer-events-none absolute inset-x-0 top-6 text-center font-mono text-caption text-mist tabular-nums md:top-10"
      />
      <Button
        ref={remove}
        hidden
        aria-label={t('dish.remove')}
        className="absolute top-0 left-0 z-10 size-8 rounded-full bg-panel font-mono text-label text-mist backdrop-blur hover:text-bone"
        onClick={() => {
          if (hovered.current !== null) run?.input.remove(hovered.current);
        }}
      >
        ×
      </Button>
      {run && <DishPalette input={run.input} />}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 p-4 md:flex-row md:items-end md:justify-between md:p-8">
        <div className="flex items-center justify-between md:block">
          <h1 className="text-heading-sm leading-none font-normal tracking-[-0.04em] md:text-heading-lg">
            fly_ui
          </h1>
          <div className="-mx-1 flex items-center gap-1 md:mt-1">
            <ViewSwitch />
            <LangSwitch />
          </div>
        </div>
        <Credit />
      </div>
    </>
  );
});
