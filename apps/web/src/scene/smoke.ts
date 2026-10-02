import type { Manifest } from '@fly/data';
import {
  Box3,
  Box3Helper,
  BufferAttribute,
  BufferGeometry,
  type Object3D,
  Points,
  PointsMaterial,
  Vector3,
} from 'three/webgpu';

/** Temporary 2.2 proof that data arrives and the camera frames the CNS; replaced by 2.3 layers. */
export function smokeContent(m: Manifest, cloud: Float32Array): Object3D[] {
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(cloud, 3));
  const points = new Points(
    geo,
    new PointsMaterial({ color: 0x9a9a9a, transparent: true, opacity: 0.4, depthWrite: false }),
  );
  const box = new Box3(new Vector3().fromArray(m.bbox.min), new Vector3().fromArray(m.bbox.max));
  return [points, new Box3Helper(box, 0x3a3a3a)];
}
