import { readFileSync } from 'node:fs';
import { NTS } from '@fly/data';
import { describe, expect, it } from 'vitest';
import { MAX_PROBES } from '../state/experiment';
import { contrast, hexToLinear, MALE, NT_COLORS, PROBES, TEXT } from './palette';

const css = readFileSync(new URL('./theme.css', import.meta.url), 'utf8');
const cssVar = (name: string) =>
  css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1]?.toLowerCase();

describe('palette', () => {
  it('has a colour for every transmitter', () => {
    expect(Object.keys(NT_COLORS).sort()).toEqual([...NTS].sort());
  });

  it('matches theme.css', () => {
    for (const nt of NTS) expect(cssVar(`color-nt-${nt}`), nt).toBe(NT_COLORS[nt].hex);
    expect(cssVar('color-male')).toBe(MALE.hex);
    for (const [k, v] of Object.entries(TEXT)) expect(cssVar(`color-${k}`), k).toBe(v);
  });

  it('converts sRGB hex to linear floats', () => {
    expect(hexToLinear('#000000')).toEqual([0, 0, 0]);
    expect(hexToLinear('#ffffff')).toEqual([1, 1, 1]);
    const [r] = hexToLinear('#808080');
    expect(r).toBeCloseTo(0.2159, 3);
    expect(NT_COLORS.gaba.rgb).toEqual(hexToLinear(NT_COLORS.gaba.hex));
  });

  it('text tokens reach 4.5:1 on black', () => {
    for (const [k, v] of Object.entries(TEXT)) expect(contrast(v, '#000000'), k).toBeGreaterThanOrEqual(4.5);
  });

  it('has a distinct, readable colour per electrode slot', () => {
    expect(PROBES).toHaveLength(MAX_PROBES);
    expect(new Set(PROBES.map((p) => p.hex)).size).toBe(MAX_PROBES);
    for (const p of PROBES) expect(contrast(p.hex, '#000000'), p.hex).toBeGreaterThanOrEqual(4.5);
  });
});
