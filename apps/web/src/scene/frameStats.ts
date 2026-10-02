/** fps / render-ms sampled by the engine's frame loop; Stats subscribes (no React state per frame). */
export interface FrameSample {
  fps: number;
  /** CPU time of renderer.render, ms (mean over the window). */
  ms: number;
}

type Listener = (s: FrameSample) => void;
const listeners = new Set<Listener>();
const WINDOW = 500;
let frames = 0;
let cpu = 0;
let start = -1;

export function sampleFrame(now: number, renderMs: number) {
  if (start < 0) start = now;
  frames++;
  cpu += renderMs;
  const dt = now - start;
  if (dt < WINDOW) return;
  const s = { fps: (frames * 1000) / dt, ms: cpu / frames };
  frames = 0;
  cpu = 0;
  start = now;
  for (const l of listeners) l(s);
}

export function onFrameSample(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
