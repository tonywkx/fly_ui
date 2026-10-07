import { type Item, mulberry32 } from '@fly/sim';
import {
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  type Object3D,
  OctahedronGeometry,
  SphereGeometry,
  Vector3,
} from 'three/webgpu';
import { glassMaterial } from '../layers/shells';
import { FlyView } from './fly';
import { glow, MIST, SAFFRON, TEAL } from './materials';

/** Odor plume: particles, the cycle of one (sim ms), how far it drifts (mm). */
const PLUME_N = 48;
const PLUME_MS = 3000;
const PLUME_REACH = 3;

/** A placed item's look; `update` moves what moves (plume particles, the female). */
export interface ItemView {
  root: Object3D;
  update(it: Item, t: number): void;
}

const at = (o: Object3D, it: Item) => o.position.set(it.x, 0, -it.y);

/** Sugar: a cluster of 5–7 saffron crystals (layout seeded by the item id). */
function sugar(id: number): ItemView {
  const rng = mulberry32(id * 7919);
  const root = new Group();
  const geo = new OctahedronGeometry(1, 0);
  const mat = glow(SAFFRON, 1.25);
  const n = 5 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const r = 0.13 + 0.1 * rng();
    const m = new Mesh(geo, mat);
    const a = 2 * Math.PI * rng();
    const d = i === 0 ? 0 : 0.2 + 0.25 * rng();
    m.position.set(d * Math.cos(a), r * 1.2, d * Math.sin(a));
    m.scale.set(r, r * 1.4, r);
    m.rotation.set(rng() * 0.6, rng() * Math.PI, rng() * 0.6);
    root.add(m);
  }
  return { root, update: (it) => at(root, it) };
}

/** Bitter: a teal acid lens with an inner glow. */
function bitter(): ItemView {
  const root = new Group();
  const lens = new Mesh(
    new SphereGeometry(0.6, 32, 16),
    glassMaterial(TEAL, { rimPower: 1.6, rimGain: 1.4, fill: 0.08 }),
  );
  lens.scale.y = 0.32;
  const core = new Mesh(new SphereGeometry(0.22, 16, 8), glow(TEAL, 1.3));
  core.scale.y = 0.5;
  root.add(lens, core);
  return { root, update: (it) => at(root, it) };
}

/** Banana odor: a small source point and mist particles drifting up and out of it. */
function odor(): ItemView {
  const root = new Group();
  root.add(new Mesh(new SphereGeometry(0.09, 12, 6), glow(MIST, 1.2)));
  const plume = new InstancedMesh(new OctahedronGeometry(0.07, 0), glow(MIST, 1.1), PLUME_N);
  root.add(plume);
  const rng = mulberry32(17);
  const dirs = Array.from({ length: PLUME_N }, () => {
    const a = 2 * Math.PI * rng();
    return { a, k: 0.6 + 0.4 * rng(), off: rng() };
  });
  const m = new Matrix4();
  const p = new Vector3();
  const s = new Vector3();
  return {
    root,
    update(it, t) {
      at(root, it);
      dirs.forEach((d, i) => {
        const age = (t / PLUME_MS + d.off) % 1;
        const r = PLUME_REACH * d.k * age;
        const sway = 0.3 * Math.sin(t / 400 + i);
        p.set(r * Math.cos(d.a + sway * age), 0.15 + 0.9 * age, r * Math.sin(d.a + sway * age));
        s.setScalar(1 - age);
        m.compose(p, root.quaternion, s);
        plume.setMatrixAt(i, m);
      });
      plume.instanceMatrix.needsUpdate = true;
    },
  };
}

/** The female: a second glass fly, a touch larger, walking her circles. */
function female(): ItemView {
  const fly = new FlyView(1.1);
  return { root: fly.root, update: (it, t) => fly.update(it, 'walk', t) };
}

export function itemView(it: Item): ItemView {
  switch (it.kind) {
    case 'sugar':
      return sugar(it.id);
    case 'bitter':
      return bitter();
    case 'odor':
      return odor();
    case 'female':
      return female();
  }
}
