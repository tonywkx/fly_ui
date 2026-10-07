/** Exponential spike kernel: `s` = Σ exp(−age/τ) as of time `at`. */
export class Kernel {
  s = 0;
  at = 0;
  constructor(readonly tau: number) {}

  value(t: number): number {
    return this.s * Math.exp(-(t - this.at) / this.tau);
  }

  add(t: number): void {
    this.s = this.value(t) + 1;
    this.at = t;
  }

  /** Mean rate (Hz) per neuron of `n`, at `t`. */
  hz(t: number, n: number): number {
    return n ? (this.value(t) / (n * this.tau)) * 1000 : 0;
  }
}
