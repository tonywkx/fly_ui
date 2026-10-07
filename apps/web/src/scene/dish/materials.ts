import { AdditiveBlending, Color, DoubleSide, MeshBasicNodeMaterial } from 'three/webgpu';

export const BONE = 0xffffff;
export const SAFFRON = 0xffb829;
export const TEAL = 0x22c3a1;
export const MIST = 0xbdbdbd;

/** Flat additive light of `hex` × `k` (k > 1 pushes it past the bloom threshold). */
export function glow(hex: number, k: number): MeshBasicNodeMaterial {
  const m = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  m.color = new Color(hex).multiplyScalar(k);
  return m;
}

/** Darkening fill (normal blending): shadows over the glowing floor. */
export function dark(opacity: number): MeshBasicNodeMaterial {
  const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide, opacity });
  m.color = new Color(0x000000);
  return m;
}
