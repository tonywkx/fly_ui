import { describe, expect, it } from 'vitest';
import { DICTS } from '../i18n';
import { SpikeLog } from '../sim/feed';
import type { FlyPose } from './behavior';
import { type Beat, beatMask, Dwell, Narrator, POSE_STEP_MS, SCRIPTS } from './captions';

/** Rows: 0 LC4, 1 DNp01, 2 TTMn, 3 untyped. */
const types = ['LC4', 'DNp01', 'TTMn'];
const meta = { n: 4, type: Uint16Array.from([0, 1, 2, 0xffff]), strings: { types } };

const beats: Beat[] = [
  { when: { types: /^LC4$/ }, text: 'shadow' },
  { when: { types: /^DNp01$/ }, text: 'gf', missing: { byMs: 15, text: 'gf silent' } },
  { when: { types: /^TTMn$/ }, text: 'ttmn' },
  { when: { pose: 'jump' }, text: 'takeoff', missing: { byMs: 100, text: 'no takeoff' } },
];
const mask = beatMask(meta, beats);

const rest: FlyPose = { jumpAt: null, lift: 0, proboscis: 0, wing: 0, flick: 0 };
/** Body that never moves. */
const still = { update: () => rest };
/** Proboscis out from `from` ms on; records the times it was read at. */
function extendsAt(from: number) {
  const seen: number[] = [];
  return {
    seen,
    update: (_: unknown, t: number) => {
      seen.push(t);
      return { ...rest, proboscis: t >= from ? 1 : 0 };
    },
  };
}

function log(t: number[], row: number[], until = 1000) {
  const l = new SpikeLog();
  l.push(t, row, until);
  return l;
}

const texts = (n: Narrator) => n.events.map((e) => e.text);

describe('SCRIPTS', () => {
  it('every line is a key in both dictionaries', () => {
    const keys = Object.values(SCRIPTS).flatMap((s) => s.flatMap((b) => [b.text, b.missing?.text ?? b.text]));
    for (const k of keys) {
      expect(DICTS.ru[k], k).toBeTypeOf('string');
      expect(DICTS.en[k], k).toBeTypeOf('string');
    }
  });
});

describe('beatMask', () => {
  it('maps rows to the beat of their type, −1 for none', () => {
    expect([...mask]).toEqual([0, 1, 2, -1]);
  });

  it('matches the shipped scripts against their scenario types', () => {
    const m = beatMask(
      { n: 2, type: Uint16Array.from([0, 1]), strings: { types: ['DNp01', 'hg1 MN'] } },
      SCRIPTS.song ?? [],
    );
    expect(m[1]).toBeGreaterThanOrEqual(0);
    expect(
      beatMask({ n: 1, type: Uint16Array.from([0]), strings: { types: ['DNp01'] } }, SCRIPTS.escape ?? [])[0],
    ).toBe(1);
  });
});

describe('Narrator', () => {
  it('emits each beat once, at its first spike, in time order', () => {
    const l = log([0.25, 0.5, 2.75, 3, 8.5], [0, 0, 1, 1, 2]);
    const n = new Narrator(beats, mask, still);
    n.update(l, 5);
    expect(texts(n)).toEqual(['shadow', 'gf']);
    n.update(l, 20);
    expect(n.events.map((e) => [e.text, e.at])).toEqual([
      ['shadow', 0.25],
      ['gf', 2.75],
      ['ttmn', 8.5],
    ]);
  });

  it('orders beats found in one frame by time', () => {
    const n = new Narrator(beats, mask, still);
    n.update(log([1, 2, 3], [2, 1, 0]), 10);
    expect(texts(n)).toEqual(['shadow', 'gf', 'ttmn'].reverse());
  });

  it('takes the jump beat at the takeoff time', () => {
    const body = { update: () => ({ ...rest, jumpAt: 29.5 }) };
    const n = new Narrator(beats, mask, body);
    n.update(log([0.25], [0]), 40);
    expect(n.events.at(-1)).toMatchObject({ text: 'takeoff', at: 29.5, missed: false });
  });

  it('finds a rate beat onset within a step even across a seek forward', () => {
    const script: Beat[] = [
      { when: { types: /^LC4$/ }, text: 'shadow' },
      { when: { pose: 'proboscis' }, text: 'out' },
    ];
    const body = extendsAt(21.3);
    const n = new Narrator(script, beatMask(meta, script), body);
    n.update(log([0.25], [0]), 60);
    const out = n.events.at(-1);
    expect(out?.text).toBe('out');
    expect(out?.at).toBeGreaterThanOrEqual(21.3);
    expect(out?.at).toBeLessThan(21.3 + POSE_STEP_MS + 1e-9);
    // once reached, the body is read once per update, not stepped
    const reads = body.seen.length;
    n.update(log([0.25], [0]), 61);
    expect(body.seen.length - reads).toBeLessThanOrEqual(1);
  });

  it('reports a beat missing past its deadline after the onset', () => {
    const l = log([10, 30], [0, 2]);
    const n = new Narrator(beats, mask, still);
    n.update(l, 24);
    expect(texts(n)).toEqual(['shadow']);
    n.update(l, 200);
    expect(n.events.map((e) => [e.text, e.at, e.missed])).toEqual([
      ['shadow', 10, false],
      ['gf silent', 25, true],
      ['ttmn', 30, false],
      ['no takeoff', 110, true],
    ]);
  });

  it('says nothing before any spike (no onset, no deadlines)', () => {
    const n = new Narrator(beats, mask, still);
    n.update(log([], []), 500);
    expect(n.events).toEqual([]);
  });

  it('replays on a seek back: same events regardless of the scrub path', () => {
    const l = log([0.1, 2.9, 8.3], [0, 1, 2]);
    const a = new Narrator(beats, mask, still);
    a.update(l, 50);
    a.update(l, 4);
    const b = new Narrator(beats, mask, still);
    b.update(l, 4);
    expect(a.events).toEqual(b.events);
  });
});

describe('Dwell', () => {
  it('shows the first event at once, then holds each one at least minS', () => {
    const d = new Dwell(1.5);
    expect(d.pick(0, 0, true)).toBe(-1);
    expect(d.pick(3, 0.1, true)).toBe(0);
    expect(d.pick(3, 1.0, true)).toBe(0);
    expect(d.pick(3, 1.6, true)).toBe(1);
    expect(d.pick(3, 3.0, true)).toBe(1);
    expect(d.pick(3, 3.2, true)).toBe(2);
    expect(d.pick(3, 9, true)).toBe(2);
  });

  it('jumps to the latest event when the clock did not run on (pause, seek, wrap)', () => {
    const d = new Dwell(1.5);
    d.pick(3, 0, true);
    expect(d.pick(3, 0.1, false)).toBe(2);
    expect(d.pick(0, 0.2, false)).toBe(-1);
    expect(d.pick(1, 0.3, true)).toBe(0);
  });
});
