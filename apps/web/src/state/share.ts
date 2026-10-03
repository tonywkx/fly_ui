import { STIM_RANGE, type Stimulus } from './experiment';

/** What a shared link carries in `?x=`: the user's stimuli and silencing by bodyId (stable across bakes). */
export interface SharedExperiment {
  stimulated: number[];
  silenced: number[];
  stim: Stimulus;
}

const VERSION = 1;
/** A safe integer needs at most 8 LEB128 bytes (7 bits each). */
const MAX_VARINT = 8;

/**
 * `?x=` code: base64url (no padding) of LEB128 varints
 * `version | hz | gain×100 | nStim | Δ stim ids… | nSilenced | Δ silenced ids…`, ids sorted and deduped
 * (so equal experiments share a code). Varints use arithmetic, not bit ops: bodyIds exceed 2³².
 */
export function encodeExperiment(e: SharedExperiment): string {
  const out: number[] = [VERSION];
  const put = (n: number) => {
    let v = n;
    while (v >= 0x80) {
      out.push((v % 0x80) | 0x80);
      v = Math.floor(v / 0x80);
    }
    out.push(v);
  };
  const ids = (list: number[]) => {
    const sorted = [...new Set(list)].sort((a, b) => a - b);
    put(sorted.length);
    let prev = 0;
    for (const id of sorted) {
      put(id - prev);
      prev = id;
    }
  };
  put(Math.max(0, Math.round(e.stim.hz)));
  put(Math.max(0, Math.round(e.stim.gain * 100)));
  ids(e.stimulated);
  ids(e.silenced);
  return btoa(String.fromCharCode(...out))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

/** Pure, never throws: null for anything that is not a complete v1 code. The drive is clamped to the sliders. */
export function decodeExperiment(code: string): SharedExperiment | null {
  if (!/^[A-Za-z0-9_-]+$/.test(code)) return null;
  let bytes: Uint8Array;
  try {
    const b64 = code.replaceAll('-', '+').replaceAll('_', '/');
    bytes = Uint8Array.from(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
  let at = 0;
  const get = (): number => {
    let n = 0;
    for (let k = 0, scale = 1; k < MAX_VARINT && at < bytes.length; k++, scale *= 0x80) {
      const b = bytes[at++] as number;
      n += (b & 0x7f) * scale;
      if (b < 0x80) return Number.isSafeInteger(n) ? n : Number.NaN;
    }
    return Number.NaN;
  };
  const ids = (): number[] | null => {
    const count = get();
    // every id takes at least one byte
    if (!(count <= bytes.length - at)) return null;
    const list: number[] = [];
    let prev = 0;
    for (let i = 0; i < count; i++) {
      const d = get();
      if (Number.isNaN(d) || !Number.isSafeInteger(prev + d)) return null;
      prev += d;
      list.push(prev);
    }
    return list;
  };

  if (get() !== VERSION) return null;
  const hz = get();
  const gain = get();
  if (Number.isNaN(hz) || Number.isNaN(gain)) return null;
  const stimulated = ids();
  const silenced = stimulated && ids();
  if (!stimulated || !silenced || at !== bytes.length) return null;
  return {
    stimulated,
    silenced,
    stim: { hz: clamp(hz, STIM_RANGE.hz), gain: clamp(gain / 100, STIM_RANGE.gain) },
  };
}

/** Query string of a shared link: only what is set, in a fixed order (probes keep their commas). */
export function shareSearch(p: { scenario?: string; x?: string; probes?: number[]; color?: string }): string {
  const parts: string[] = [];
  if (p.scenario) parts.push(`scenario=${encodeURIComponent(p.scenario)}`);
  if (p.x) parts.push(`x=${p.x}`);
  if (p.probes?.length) parts.push(`probes=${p.probes.join(',')}`);
  if (p.color) parts.push(`color=${encodeURIComponent(p.color)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

function clamp(v: number, [lo, hi]: readonly [number, number]) {
  return Math.min(hi, Math.max(lo, v));
}
