import { reaction } from 'mobx';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';
import { data } from '@/data/store';
import { type Key, num, t } from '@/i18n';
import type { DishStatus } from '@/scene/dish/run';
import { QUALITY } from '@/scene/quality';
import { app } from '@/state/app';

function timecode(s: DishStatus): string {
  if (s.loading) return t('dish.loading');
  const word = s.paused ? t('dish.paused') : t(`dish.state.${s.action}` as Key);
  return `${t('dish.timecode', { t: num(s.t / 1000, undefined, 3) })} · ${word}`;
}

/**
 * The Terrarium (`?view=dish`): the dish scene with its live brain, and the timecode line. The
 * line is written from the frame loop straight into the DOM — no React renders per frame.
 */
export const Dish = observer(function Dish() {
  const { manifest } = data;
  const host = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLParagraphElement>(null);

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
        },
      });
      for (const it of items ?? []) run.world.add(it.kind, it.x, it.y);
      const quality = reaction(
        () => app.quality,
        (q) => run.applyQuality(QUALITY[q]),
      );
      const onKey = (e: KeyboardEvent) => {
        if (e.code !== 'Space' || e.repeat || (e.target as HTMLElement).closest('input, textarea')) return;
        e.preventDefault();
        run.togglePause();
      };
      window.addEventListener('keydown', onKey);
      dispose = () => {
        quality();
        window.removeEventListener('keydown', onKey);
        run.dispose();
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
    </>
  );
});
