import { NONE16 } from '@fly/data';
import type { Key } from '@/i18n';
import type { SpikeLog } from '@/sim/feed';
import { type FlyPose, JUMP, PROBOSCIS, SHOWN, WING } from './behavior';

/**
 * One line of a scenario's narration. It starts at the first spike of its cell types, or when the
 * behaviour readout shows the body part move; never at a scripted time.
 */
export interface Beat<T extends string = string> {
  when: { types: RegExp } | { pose: 'jump' | 'proboscis' | 'wing' };
  /** What to say; in `SCRIPTS` a dictionary key (`i18n`). */
  text: T;
  /** The dataset's name for it (cell type, region), shown as is after the phrase; none → the time. */
  term?: string;
  /** Not reached `byMs` after the onset (the scenario's first beat) → say so (a silenced link). */
  missing?: { byMs: number; text: T; term?: string };
}

/** Narration per scenario, in story order. Measured onsets (baked, ms) in the comments. */
export const SCRIPTS: Record<string, readonly Beat<Key>[]> = {
  escape: [
    // 0.1
    {
      when: { types: /^(LC4|LPLC2)$/ },
      text: 'cap.escape.shadow',
      term: 'LC4, LPLC2',
    },
    // 2.9
    {
      when: { types: /^DNp01$/ },
      text: 'cap.escape.gf',
      term: 'DNp01',
      missing: { byMs: 15, text: 'cap.escape.gfSilent', term: 'DNp01' },
    },
    // 8.3
    { when: { types: JUMP }, text: 'cap.escape.ttmn', term: 'TTMn' },
    // ≈30
    {
      when: { pose: 'jump' },
      text: 'cap.escape.takeoff',
      missing: { byMs: 100, text: 'cap.escape.noTakeoff' },
    },
  ],
  sugar: [
    // 0.1
    { when: { types: /^LB3[a-d]$/ }, text: 'cap.sugar.taste', term: 'LB3' },
    // ≈5
    { when: { types: /^GNG\d/ }, text: 'cap.sugar.gng', term: 'GNG' },
    // 19.6
    {
      when: { types: PROBOSCIS },
      text: 'cap.sugar.mn9',
      term: 'MN9',
      missing: { byMs: 100, text: 'cap.sugar.mn9Silent', term: 'MN9' },
    },
    {
      when: { pose: 'proboscis' },
      text: 'cap.sugar.extend',
      missing: { byMs: 150, text: 'cap.sugar.noExtend' },
    },
  ],
  song: [
    // 0.1
    { when: { types: /^pC1/ }, text: 'cap.song.p1', term: 'P1 (pC1)' },
    // 5.5
    {
      when: { types: /^pIP10$/ },
      text: 'cap.song.pip10',
      term: 'pIP10',
      missing: { byMs: 30, text: 'cap.song.pip10Silent', term: 'pIP10' },
    },
    // 11.5
    { when: { types: WING }, text: 'cap.song.wingMn', term: 'wing MN' },
    {
      when: { pose: 'wing' },
      text: 'cap.song.wing',
      missing: { byMs: 150, text: 'cap.song.noSong' },
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
  term?: string;
  missed: boolean;
}

/** The behaviour readout (`Behavior`): pose at sim time `t`, replaying itself on a seek back. */
export interface Body {
  update(log: SpikeLog, t: number): FlyPose;
}

/** Sim ms between body reads while a pose beat is pending: its onset is found to within this. */
export const POSE_STEP_MS = 0.5;

/** Sim time a pose beat is reached at, or null (rates have no onset spike: the read time `t`). */
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
    private readonly body: Body,
  ) {
    this.reachedAt = beats.map(() => Number.POSITIVE_INFINITY);
    this.missed = beats.map(() => false);
  }

  update(log: SpikeLog, t: number): readonly CaptionEvent[] {
    if (t < this.t) this.reset();
    const found: CaptionEvent[] = [];
    const reach = (b: number, at: number) => {
      this.reachedAt[b] = at;
      const { text, term } = this.beats[b] as Beat;
      found.push({ beat: b, at, text, term, missed: false });
    };

    const [i0, i1] = log.span(this.t, t);
    const times = log.times;
    const rows = log.rows;
    for (let i = i0; i < i1; i++) {
      const b = this.mask[rows[i] as number] ?? -1;
      if (b >= 0 && this.reachedAt[b] === Number.POSITIVE_INFINITY) reach(b, times[i] as number);
    }
    // step the body through a jump (seek, slow frame) so a rate beat gets its onset, not the frame time
    const pending = () =>
      this.beats.some((beat, b) => 'pose' in beat.when && this.reachedAt[b] === Number.POSITIVE_INFINITY);
    let s = Number.isFinite(this.t) ? this.t : i0 < i1 ? (times[i0] as number) : t;
    while (pending()) {
      s = Math.min(t, s + POSE_STEP_MS);
      const pose = this.body.update(log, s);
      this.beats.forEach((beat, b) => {
        if (!('pose' in beat.when) || this.reachedAt[b] !== Number.POSITIVE_INFINITY) return;
        const at = poseAt(pose, beat.when.pose, s);
        if (at !== null) reach(b, at);
      });
      if (s >= t) break;
    }

    if (this.onset === null && found.length) this.onset = Math.min(...found.map((e) => e.at));
    const onset = this.onset;
    if (onset !== null)
      this.beats.forEach((beat, b) => {
        if (!beat.missing || this.missed[b]) return;
        const due = onset + beat.missing.byMs;
        if (t < due || (this.reachedAt[b] as number) <= due) return;
        this.missed[b] = true;
        found.push({ beat: b, at: due, text: beat.missing.text, term: beat.missing.term, missed: true });
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
