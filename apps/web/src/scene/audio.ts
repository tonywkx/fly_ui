import * as Tone from 'tone';

/** Click: a 3 ms biphasic tick, like an extracellular spike on the rig's audio monitor. */
const CLICK_MS = 3;
/**
 * Pulse song (D. melanogaster): pulses ≈35 ms apart, each a couple of cycles of a ≈220 Hz carrier.
 * Played at natural speed (the sim clock is slowed ×25: in sim time it would be infrasound).
 */
const IPI_S = 0.035;
const CARRIER_HZ = 220;
const PULSE_SIGMA_S = 0.003;
/** Master and song levels (dB / linear), and how fast the song follows the wings (s). */
const MASTER_DB = -6;
const SONG_GAIN = 0.6;
const SONG_RAMP_S = 0.08;

function clickBuffer(rate: number): Float32Array<ArrayBuffer> {
  const n = Math.round((rate * CLICK_MS) / 1000);
  const out = new Float32Array(n);
  const tau = n / 6;
  for (let i = 0; i < n; i++) out[i] = Math.sin((2 * Math.PI * i) / (n / 1.5)) * Math.exp(-i / tau);
  return out;
}

/** One IPI with a Gaussian-windowed pulse in the middle; looped, it is the pulse train. */
function pulseBuffer(rate: number): Float32Array {
  const n = Math.round(rate * IPI_S);
  const out = new Float32Array(n);
  const mid = n / 2;
  for (let i = 0; i < n; i++) {
    const t = (i - mid) / rate;
    const w = Math.exp(-(t * t) / (2 * PULSE_SIGMA_S * PULSE_SIGMA_S));
    // + 2nd harmonic: laptop speakers barely reproduce 220 Hz
    out[i] = w * (Math.sin(2 * Math.PI * CARRIER_HZ * t) + 0.5 * Math.sin(4 * Math.PI * CARRIER_HZ * t));
  }
  return out;
}

/**
 * The rig's loudspeaker on an already-unlocked `ctx`: `click(at, gain)` schedules one tick,
 * `song(level)` sets the pulse song level (0…1). Everything goes through a limiter.
 */
export class Audio {
  private readonly ctx: AudioContext;
  private readonly master: Tone.Volume;
  private readonly limiter: Tone.Limiter;
  private readonly click: AudioBuffer;
  private readonly songGain: Tone.Gain;
  private readonly player: Tone.Player;
  /** Ticks scheduled so far (a probe for tests and the smoke script). */
  scheduled = 0;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    Tone.setContext(ctx);
    this.limiter = new Tone.Limiter(-3).toDestination();
    this.master = new Tone.Volume(MASTER_DB).connect(this.limiter);
    const tick = clickBuffer(ctx.sampleRate);
    this.click = ctx.createBuffer(1, tick.length, ctx.sampleRate);
    this.click.copyToChannel(tick, 0);
    this.songGain = new Tone.Gain(0).connect(this.master);
    this.player = new Tone.Player(Tone.ToneAudioBuffer.fromArray(pulseBuffer(ctx.sampleRate)));
    this.player.loop = true;
    this.player.connect(this.songGain).start();
  }

  get now(): number {
    return this.ctx.currentTime;
  }

  /** One tick at context time `at`. */
  tick(at: number, gain: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.click;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    Tone.connect(g, this.master);
    src.start(at);
    this.scheduled++;
  }

  song(level: number): void {
    this.songGain.gain.rampTo(level * SONG_GAIN, SONG_RAMP_S);
  }

  dispose(): void {
    this.player.dispose();
    this.songGain.dispose();
    this.master.dispose();
    this.limiter.dispose();
  }
}
