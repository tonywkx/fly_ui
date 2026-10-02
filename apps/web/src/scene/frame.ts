/**
 * Camera distance from a box centre (looking down −z) so the box's front face fills the view:
 * the tighter of the vertical and horizontal fits, times `margin`, plus half the depth.
 */
export function frameDistance(
  half: readonly [number, number, number],
  fovDeg: number,
  aspect: number,
  margin: number,
): number {
  const tanV = Math.tan((fovDeg * Math.PI) / 360);
  const fit = Math.max(half[1] / tanV, half[0] / (tanV * aspect));
  return fit * margin + half[2];
}
