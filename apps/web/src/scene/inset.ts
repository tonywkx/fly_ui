/** Screen px on the right the scene keeps clear of (the tour's big FlyCam); written by the DOM. */
export const sceneInset = { right: 0 };

/** Share of the viewport width the framed CNS needs; the frame shrinks only below it. */
export const INSET_SHARE = 0.8;

/**
 * Camera view offset (`setViewOffset` args) that fits the whole frame, scaled down if needed,
 * into the strip left of `right`: centred in it, aspect kept. Null = no offset.
 */
export function insetView(w: number, h: number, right: number) {
  if (right <= 0) return null;
  const free = w - right;
  const s = Math.min(1, free / (w * INSET_SHARE));
  const fullW = w * s;
  const fullH = h * s;
  return { fullW, fullH, x: -(free - fullW) / 2, y: -(h - fullH) / 2 };
}
