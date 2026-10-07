/** Smoothing window (ms of wall time) of the measured pace. */
const WINDOW_MS = 1500;
/** The label leaves the nominal factor only past this much slower (no flicker around it). */
const SLACK = 1.25;

/**
 * The dish's real slow-motion: the world waits for the live brain, so a slow worker (a phone, a
 * busy sense) stretches «×1/6» further. Fed sim ms and wall ms per frame, never while paused.
 */
export class SlowMo {
  /** Smoothed sim ms per wall ms. */
  private rate: number;

  constructor(private readonly nominal: number) {
    this.rate = 1 / nominal;
  }

  add(simMs: number, wallMs: number): void {
    if (wallMs <= 0) return;
    const k = 1 - Math.exp(-wallMs / WINDOW_MS);
    this.rate += (simMs / wallMs - this.rate) * k;
  }

  /** The denominator to show: the nominal one unless the brain is clearly behind. */
  get slow(): number {
    const real = 1 / Math.max(this.rate, 1e-6);
    return real > this.nominal * SLACK ? Math.round(real) : this.nominal;
  }

  reset(): void {
    this.rate = 1 / this.nominal;
  }
}
