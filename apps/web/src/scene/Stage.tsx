import { when } from 'mobx';
import { useEffect, useRef } from 'react';
import { data } from '@/data/store';
import { app } from '@/state/app';
import { Engine } from './engine';
import { smokeContent } from './smoke';

/** Frames rendered with content before the scene counts as drawn (snap readiness). */
const SETTLE_FRAMES = 2;

/** Mount point for the renderer. The engine owns the canvas; React only creates and disposes it. */
export function Stage() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const engine = new Engine(el, {
      forceWebGL: app.params.gl === 'webgl2',
      reducedMotion: app.reducedMotion,
    });
    let stopWhen: (() => void) | undefined;

    engine
      .init()
      .then((backend) => {
        if (engine.disposed) return;
        app.setBackend(backend);
        stopWhen = when(
          () => data.ready,
          () => populate(engine),
        );
      })
      .catch((e) => {
        console.error('[scene]', e);
        app.markReady('frame');
      });

    return () => {
      stopWhen?.();
      engine.dispose();
    };
  }, []);

  return <div ref={host} id="stage" className="absolute inset-0" />;
}

function populate(engine: Engine) {
  const m = data.manifest;
  const lod0 = m?.chunks.find((c) => c.kind === 'cloud' && c.lod === 0);
  const cloud = lod0 && data.get(lod0.id, 'cloud');
  if (!m || !cloud) throw new Error('cloud lod0 missing from first-frame data');
  engine.setFrame(m);
  engine.world.add(...smokeContent(m, cloud));

  let frames = 0;
  const off = engine.onFrame(() => {
    if (++frames <= SETTLE_FRAMES) return;
    off();
    app.markReady('frame');
  });
}
