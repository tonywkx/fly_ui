import { type RefObject, useEffect, useRef } from 'react';

/** fps / frame-ms readout. Writes textContent from rAF; no React state in the frame loop. */
export function Stats() {
  const fps = useRef<HTMLSpanElement>(null);
  const ms = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let start = performance.now();
    const tick = (now: number) => {
      frames++;
      const dt = now - start;
      if (dt >= 500 && fps.current && ms.current) {
        fps.current.textContent = String(Math.round((frames * 1000) / dt));
        ms.current.textContent = (dt / frames).toFixed(1);
        frames = 0;
        start = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <p className="flex gap-2">
      <Readout label="fps" value={fps} />
      <Readout label="ms" value={ms} />
    </p>
  );
}

function Readout({ label, value }: { label: string; value: RefObject<HTMLSpanElement | null> }) {
  return (
    <span>
      <span ref={value} className="inline-block min-w-[4ch] text-right text-bone">
        —
      </span>{' '}
      <span className="text-ash">{label}</span>
    </span>
  );
}
