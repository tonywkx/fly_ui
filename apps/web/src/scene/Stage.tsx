import { when } from 'mobx';
import { useEffect, useRef } from 'react';
import { data } from '@/data/store';
import { app } from '@/state/app';
import { Engine } from './engine';
import { CloudLayer } from './layers/cloud';
import { neuronsLayer } from './layers/neurons';
import { shellsLayer } from './layers/shells';
import { buildSegments } from './segments';

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
  if (!m) throw new Error('manifest missing');
  const chunk = (kind: 'cloud' | 'neuropil', id: string) => {
    const c = m.chunks.find((e) => e.id === id && e.kind === kind);
    if (!c) throw new Error(`${id} missing from manifest`);
    return c;
  };
  const shells = data.get(chunk('neuropil', 'neuropil-shells').id, 'neuropil');
  const lod0 = data.get(chunk('cloud', 'cloud-lod0').id, 'cloud');
  if (!shells || !lod0) throw new Error('shells or cloud lod0 missing from first-frame data');

  engine.setFrame(m);
  const cloud = new CloudLayer(m.unitNm / 1000);
  cloud.add(lod0);
  const shellMesh = shellsLayer(shells);
  const { debug } = app.params;
  cloud.group.visible = debug !== 'shells' && debug !== 'neurons';
  shellMesh.visible = debug !== 'cloud' && debug !== 'neurons';
  engine.world.add(cloud.group, shellMesh);

  const skeletons = data.get(`${data.scenario}-skeletons`, 'skeletons');
  const meta = data.get(`${data.scenario}-meta`, 'meta');
  if (skeletons && meta) {
    const neurons = neuronsLayer(buildSegments(skeletons, meta), m.unitNm / 1000);
    neurons.visible = debug !== 'cloud' && debug !== 'shells';
    engine.world.add(neurons);
  }

  let frames = 0;
  const off = engine.onFrame(() => {
    if (++frames <= SETTLE_FRAMES) return;
    off();
    app.markReady('frame');
    // Refine the dust once the first frame is up; lod2 is left to quality presets (2.8).
    const lod1 = chunk('cloud', 'cloud-lod1');
    data
      .loadChunk(lod1)
      .then(() => {
        const pos = data.get(lod1.id, 'cloud');
        if (pos && !engine.disposed) cloud.add(pos);
      })
      .catch((e) => console.warn('[scene] cloud lod1', e));
  });
}
