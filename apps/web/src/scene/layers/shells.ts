import type { NeuropilSet } from '@fly/data';
import { abs, color, dot, float, normalView, oneMinus, positionViewDirection, pow } from 'three/tsl';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
} from 'three/webgpu';

const SHELL_COLOR = 0x8f9bb3;
const SHELL_GLASS: GlassOptions = { rimPower: 3, rimGain: 0.32, fill: 0.012 };

export interface GlassOptions {
  /** Higher → thinner rim. */
  rimPower: number;
  rimGain: number;
  /** Faint fill so face-on regions are not a hole. */
  fill: number;
}

/** Glass: additive fresnel rim over a faint fill, no depth writes. */
export function glassMaterial(
  tint: Node<'vec3'> | Node<'color'> | number,
  o: GlassOptions,
  reveal: Node<'float'> | number = 1,
): MeshBasicNodeMaterial {
  const mat = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  const rim = pow(oneMinus(abs(dot(normalView, positionViewDirection))), o.rimPower);
  const c = typeof tint === 'number' ? color(tint) : tint;
  mat.colorNode = c.mul(rim.mul(o.rimGain).add(float(o.fill))).mul(reveal);
  return mat;
}

/** Neuropil shells as glass. `reveal` fades them in. */
export function shellsLayer(set: NeuropilSet, reveal: Node<'float'> | number = 1): Mesh {
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(set.pos, 3));
  geo.setIndex(new BufferAttribute(set.index, 1));
  geo.computeVertexNormals();

  const mesh = new Mesh(geo, glassMaterial(SHELL_COLOR, SHELL_GLASS, reveal));
  mesh.name = 'shells';
  return mesh;
}
