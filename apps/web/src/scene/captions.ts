import { NONE16 } from '@fly/data';
import type { SpikeLog } from '@/sim/feed';
import { type FlyPose, JUMP, PROBOSCIS, SHOWN, WING } from './behavior';

/**
 * One line of a scenario's narration. It starts at the first spike of its cell types, or when the
 * behaviour readout shows the body part move; never at a scripted time.
 */
export interface Beat {
  when: { types: RegExp } | { pose: 'jump' | 'proboscis' | 'wing' };
  text: string;
  /** Not reached `byMs` after the onset (the scenario's first beat) → say so (a silenced link). */
  missing?: { byMs: number; text: string };
}

/** Narration per scenario, in story order. Measured onsets (baked, ms) in the comments. */
export const SCRIPTS: Record<string, readonly Beat[]> = {
  escape: [
    // 0.1
    {
      when: { types: /^(LC4|LPLC2)$/ },
      text: 'A looming shadow: LC4 and LPLC2 cells in the optic lobes fire',
    },
    // 2.9
    {
      when: { types: /^DNp01$/ },
      text: 'The Giant Fiber fires: the escape command',
      missing: { byMs: 15, text: 'The Giant Fiber stays silent: the fast escape route is cut' },
    },
    // 8.3
    { when: { types: JUMP }, text: 'The signal reaches the thorax: the jump muscle’s motor neuron fires' },
    // ≈30
    { when: { pose: 'jump' }, text: 'Takeoff', missing: { byMs: 100, text: 'No takeoff' } },
  ],
  sugar: [
    // 0.1
    { when: { types: /^LB3[a-d]$/ }, text: 'Taste neurons (LB3) fire' },
    // ≈5
    { when: { types: /^GNG\d/ }, text: 'The signal spreads through the gnathal ganglion, the taste centre' },
    // 19.6
    {
      when: { types: PROBOSCIS },
      text: 'MN9, the proboscis motor neuron, fires',
      missing: { byMs: 100, text: 'MN9 stays silent' },
    },
    {
      when: { pose: 'proboscis' },
      text: 'The proboscis extends',
      missing: { byMs: 150, text: 'No proboscis extension' },
    },
  ],
  song: [
    // 0.1
    { when: { types: /^pC1/ }, text: 'P1 neurons (pC1), the male courtship drive, fire' },
    // 5.5
    {
      when: { types: /^pIP10$/ },
      text: 'pIP10 carries the song command down to the thorax',
      missing: { byMs: 30, text: 'pIP10 stays silent: no song command' },
    },
    // 11.5
    { when: { types: WING }, text: 'Wing motor neurons fire' },
    {
      when: { pose: 'wing' },
      text: 'The wing extends: courtship song',
      missing: { byMs: 150, text: 'No song' },
    },
  ],
};

interface MetaTypes {
  n: number;
  type: Uint16Array;
  strings: { types: string[] };
}

/** Beat index per row by cell type (first matching beat), −1 for rows no beat listens to. */
export function beatMask(meta: MetaTypes, beats: readonly Beat[]): Int8Array {
  const byType = meta.strings.types.map((t) =>
    beats.findIndex((b) => 'types' in b.when && b.when.types.test(t)),
  );
  const mask = new Int8Array(meta.n).fill(-1);
  for (let i = 0; i < meta.n; i++) {
    const t = meta.type[i] as number;
    if (t !== NONE16) mask[i] = byType[t] ?? -1;
  }
  return mask;
}

export interface CaptionEvent {
  beat: number;
  /** Sim ms: first spike / takeoff / when the part moved; for a missed beat, its deadline. */
  at: number;
  text: string;
  missed: boolean;
}

/** Sim time a pose beat is reached at, or null (`t` = now: rates have no single onset spike). */
function poseAt(pose: FlyPose, part: 'jump' | 'proboscis' | 'wing', t: number): number | null {
  if (part === 'jump') return pose.jumpAt;
  return pose[part] > SHOWN ? t : null;
}

/**
 * Reads the narration from `log` incrementally (like `Behavior`): `events` = beats reached or missed
 * by the last `update`, time-ordered. A seek back replays, so the result does not depend on the
 * scrub path.
 */
export class Narrator {
  readonly events: CaptionEvent[] = [];
  private reachedAt: number[];
  private missed: boolean[];
  private onset: number | null = null;
  private t = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly beats: readonly Beat[],
    private readonly mask: Int8Array,
  ) {
    this.reachedAt = beats.map(() => Number.POSITIVE_INFINITY);
    this.missed = beats.map(() => false);
  }

  update(log: SpikeLog, t: number, pose: FlyPose): readonly CaptionEvent[] {
    if (t < this.t) this.reset();
    const found: CaptionEvent[] = [];
    const reach = (b: number, at: number) => {
      this.reachedAt[b] = at;
      found.push({ beat: b, at, text: (this.beats[b] as Beat).text, missed: false });
    };

    const [i0, i1] = log.span(this.t, t);
    const times = log.times;
    const rows = log.rows;
    for (let i = i0; i < i1; i++) {
      const b = this.mask[rows[i] as number] ?? -1;
      if (b >= 0 && this.reachedAt[b] === Number.POSITIVE_INFINITY) reach(b, times[i] as number);
    }
    this.beats.forEach((beat, b) => {
      if (!('pose' in beat.when) || this.reachedAt[b] !== Number.POSITIVE_INFINITY) return;
      const at = poseAt(pose, beat.when.pose, t);
      if (at !== null) reach(b, at);
    });

    if (this.onset === null && found.length) this.onset = Math.min(...found.map((e) => e.at));
    const onset = this.onset;
    if (onset !== null)
      this.beats.forEach((beat, b) => {
        if (!beat.missing || this.missed[b]) return;
        const due = onset + beat.missing.byMs;
        if (t < due || (this.reachedAt[b] as number) <= due) return;
        this.missed[b] = true;
        found.push({ beat: b, at: due, text: beat.missing.text, missed: true });
      });

    found.sort((a, b) => a.at - b.at || a.beat - b.beat);
    this.events.push(...found);
    this.t = t;
    return this.events;
  }

  private reset() {
    this.events.length = 0;
    this.reachedAt.fill(Number.POSITIVE_INFINITY);
    this.missed.fill(false);
    this.onset = null;
    this.t = Number.NEGATIVE_INFINITY;
  }
}

/**
 * Which event to show while the cascade outruns reading speed (a whole scenario is ≈30 sim ms,
 * under a second at 1×): while the clock runs on, each event stays at least `minS` real seconds and
 * the next one queues; on pause, seek or loop wrap the latest event shows at once.
 */
export class Dwell {
  private i = -1;
  private since = Number.NEGATIVE_INFINITY;

  constructor(private readonly minS: number) {}

  /** `n` events so far; `now` real seconds; `follow` = the clock ran on continuously. Index, −1 = none. */
  pick(n: number, now: number, follow: boolean): number {
    if (!follow || this.i >= n) {
      if (this.i !== n - 1) this.since = now;
      this.i = n - 1;
    } else if (this.i < n - 1 && (this.i < 0 || now - this.since >= this.minS)) {
      this.i++;
      this.since = now;
    }
    return this.i;
  }
}
