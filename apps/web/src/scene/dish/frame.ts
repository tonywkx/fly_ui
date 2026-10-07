/** Px of chrome over each side of the picture; the dish centres in what is left. */
export interface Band {
  top: number;
  bottom: number;
  left: number;
  right: number;
}
export const NO_BAND: Band = { top: 0, bottom: 0, left: 0, right: 0 };

/** Camera and dish: vertical fov and pitch (deg), dish diameter, viewport shares it fills. */
export interface Lens {
  fov: number;
  pitch: number;
  diameter: number;
  /** Share of the height the (foreshortened) dish fills. */
  fillH: number;
  /** Share of the width it fills with no side chrome (phones). */
  fillW: number;
}

/** Px kept between the rim and a side column. */
export const GUTTER = 24;
/** On screen the near half of the dish, its wall and glow spread this much wider than its diameter. */
export const SPREAD = 1.08;
/** Least share of the width the dish keeps when side columns leave less (tablets). */
const MIN_FREE = 0.3;

/**
 * Camera distance that fits the dish in the free band, and the view offset (px, `setViewOffset`)
 * that centres it there: x > 0 slides the window right (the picture moves left), y > 0 raises it.
 */
export function frame(w: number, h: number, band: Band, lens: Lens) {
  const tan = Math.tan((lens.fov * Math.PI) / 360);
  const pitch = (lens.pitch * Math.PI) / 180;
  const side = band.left + band.right;
  const fillW = side
    ? Math.max(MIN_FREE, Math.min(lens.fillW, (w - side - 2 * GUTTER) / SPREAD / w))
    : lens.fillW;
  const dist = Math.max(
    (lens.diameter * Math.sin(pitch)) / lens.fillH / (2 * tan),
    lens.diameter / fillW / (2 * tan * (w / h)),
  );
  return {
    dist,
    x: Math.round((band.right - band.left) / 2),
    y: Math.round((band.bottom - band.top) / 2),
  };
}
