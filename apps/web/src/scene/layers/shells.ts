import type { NeuropilSet } from '@fly/data';
import { abs, color, dot, float, normalView, oneMinus, positionViewDirection, pow } from 'three/tsl';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Mesh,
  MeshBasicNodeMaterial,
} from 'three/webgpu';

const SHELL_COLOR = 0x8f9bb3;
/** Higher → thinner rim. */
const RIM_POWER = 3;
const RIM_GAIN = 0.32;
/** Faint fill so face-on regions are not a hole. */
const FILL = 0.012;

/** Neuropil shells as glass: additive fresnel rim, no fill, no depth writes. */
export function shellsLayer(set: NeuropilSet): Mesh {
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(set.pos, 3));
  geo.setIndex(new BufferAttribute(set.index, 1));
  geo.computeVertexNormals();

  const mat = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  const rim = pow(oneMinus(abs(dot(normalView, positionViewDirection))), RIM_POWER);
  mat.colorNode = color(SHELL_COLOR).mul(rim.mul(RIM_GAIN).add(float(FILL)));

  const mesh = new Mesh(geo, mat);
  mesh.name = 'shells';
  return mesh;
}
