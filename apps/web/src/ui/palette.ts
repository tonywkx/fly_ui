import type { Nt } from '@fly/data';

/** Colour for CSS (`hex`, sRGB) and shaders (`rgb`, linear 0..1). Mirrors `--color-nt-*` in theme.css. */
export interface Swatch {
  hex: string;
  rgb: readonly [number, number, number];
}

/** sRGB `#rrggbb` → linear floats (what three.js expects for colour uniforms/attributes). */
export function hexToLinear(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
}

/** WCAG contrast ratio between two sRGB hex colours. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = hexToLinear(hex);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const swatch = (hex: string): Swatch => ({ hex, rgb: hexToLinear(hex) });

/** Excitatory warm, inhibitory cold, modulatory magenta/pink (PRODUCT.md §Visual language). */
export const NT_COLORS: Record<Nt, Swatch> = {
  acetylcholine: swatch('#ffb829'),
  gaba: swatch('#8052ff'),
  glutamate: swatch('#22c3a1'),
  histamine: swatch('#4f8cff'),
  dopamine: swatch('#ff5ce1'),
  serotonin: swatch('#ff7aa8'),
  octopamine: swatch('#d36bff'),
  tyramine: swatch('#b98cff'),
  unclear: swatch('#6e6e6e'),
};

/** Focus roles around the selected neuron (replace the transmitter tint while focused). */
export const FOCUS = {
  selected: swatch('#ffffff'),
  input: swatch('#4fc3ff'),
  output: swatch('#ffb829'),
  both: swatch('#c7a6ff'),
} as const;

/** Silenced neurons: grey, no waves. */
export const SILENCED = swatch('#6e6e6e');

/** Electrode slots (scene tint, chip, oscilloscope trace): apart from the transmitter hues. */
export const PROBES: readonly Swatch[] = ['#c6ff3d', '#ff6b4a', '#5cf2ff', '#fff2a8'].map(swatch);

/** Oscilloscope guides: dashed threshold, dotted rest. */
export const SCOPE_GUIDE = { threshold: 'rgba(255,255,255,0.32)', rest: 'rgba(255,255,255,0.2)' } as const;

/** Male-specific highlight colour mode. */
export const MALE = swatch('#ff2fb3');

/** Typographic colours (must stay readable over the darkest scene). */
export const TEXT = { bone: '#ffffff', mist: '#bdbdbd', ash: '#9a9a9a' } as const;

/** Accent colours used outside CSS (canvas): mirror `--color-*` in theme.css. */
export const ACCENT = { saffron: '#ffb829', void: '#000000' } as const;
