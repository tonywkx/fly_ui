import { ARENA_R } from '@fly/sim';
import { CircleGeometry, CylinderGeometry, Group, Mesh, RingGeometry, TorusGeometry } from 'three/webgpu';
import { glassMaterial } from '../layers/shells';
import { BONE, glow } from './materials';

/** Glass wall height, mm. */
export const WALL_H = 1.6;
/** Agar rings on the floor, mm. */
const AGAR = [4, 8];

/** The dish: bright rim ring (blooms), faint glass wall and floor, two agar rings; floor is y = 0. */
export function arena(): Group {
  const g = new Group();
  const rim = new Mesh(new TorusGeometry(ARENA_R, 0.045, 8, 256), glow(BONE, 1.4));
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = WALL_H;
  const foot = new Mesh(new TorusGeometry(ARENA_R, 0.03, 6, 256), glow(BONE, 0.35));
  foot.rotation.x = -Math.PI / 2;
  const wall = new Mesh(
    new CylinderGeometry(ARENA_R, ARENA_R, WALL_H, 192, 1, true),
    glassMaterial(BONE, { rimPower: 2.5, rimGain: 0.22, fill: 0.006 }),
  );
  wall.position.y = WALL_H / 2;
  const floor = new Mesh(new CircleGeometry(ARENA_R, 192).rotateX(-Math.PI / 2), glow(BONE, 0.004));
  g.add(floor, wall, foot, rim);
  for (const r of AGAR) {
    const ring = new Mesh(new RingGeometry(r - 0.02, r + 0.02, 256).rotateX(-Math.PI / 2), glow(BONE, 0.08));
    ring.position.y = 0.001;
    g.add(ring);
  }
  return g;
}
