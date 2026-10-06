import { uniform } from 'three/tsl';
import {
  AdditiveBlending,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  EllipseCurve,
  Group,
  Matrix4,
  Mesh,
  MeshBasicNodeMaterial,
  Path,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Vector3,
} from 'three/webgpu';
import type { FlyPose } from '../behavior';
import { type GlassOptions, glassMaterial } from '../layers/shells';

// Stylized fly in body units (≈2.6 long): x forward (head +x), y up, z toward the camera.

const BONE = new Color(0xb8c4dc);
const HOT = new Color(0xffb829);
const GLASS: GlassOptions = { rimPower: 2.2, rimGain: 0.85, fill: 0.04 };
// flat wings have no rim to speak of: a faint membrane plus an outline
const WING_GLASS: GlassOptions = { rimPower: 1.2, rimGain: 0.2, fill: 0.03 };
const OUTLINE = 0.8;
const EDGE = 0.02;

/** Body height while standing (thorax underside to the ground). */
const STAND = 0;
/** Share of the jump spent pushing off with the mid legs; the rest is flight out of the frame. */
const PUSH = 0.12;
const PUSH_RISE = 0.3;
/** Flight path (body units / rad) over the whole flight part of the jump. */
const FLIGHT = { up: 5, forward: 1.6, pitch: 0.6, roll: 1.2 };
/** A new fly is set down from this high (body units). */
const DROP = 1.5;
/** Proboscis: folded back under the head … pointing forward-down at the food, and its length. */
const PROBOSCIS = { fold: -0.95, out: 0.35, len0: 0.7, len1: 1.25 };
/** Far wing yaw: folded over the abdomen … held out to the side (song, up the frame); flick lifts the tip. */
const WING = { fold: 0.12, out: 1.3, flick: 0.55 };

const FEMUR = 0.42;
const TIBIA = 0.58;
const LEG_R = 0.022;
/** Hip (thorax underside) and resting foot, per segment; mirrored in z. */
const LEGS = [
  { hip: [0.28, 0.42, 0.14], foot: [0.78, 0, 0.42] },
  { hip: [0.02, 0.4, 0.16], foot: [0.06, 0, 0.6], jump: true },
  { hip: [-0.22, 0.42, 0.14], foot: [-0.7, 0, 0.48] },
] as const;

function part(geo: SphereGeometry | CapsuleGeometry | ShapeGeometry, mat: MeshBasicNodeMaterial) {
  return new Mesh(geo, mat);
}

function ellipsoid(mat: MeshBasicNodeMaterial, at: [number, number, number], r: [number, number, number]) {
  const m = part(new SphereGeometry(1, 32, 20), mat);
  m.position.set(...at);
  m.scale.set(...r);
  return m;
}

/** A tinted glass material (and a matching outline one) whose tint moves from bone to saffron with `heat`. */
function heated(o: GlassOptions) {
  const tint = uniform(BONE.clone());
  const mat = glassMaterial(tint, o);
  const line = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  line.colorNode = tint.mul(OUTLINE);
  return {
    mat,
    line,
    heat(h: number) {
      tint.value.copy(BONE).lerp(HOT, Math.min(1, Math.max(0, h)));
    },
  };
}

interface Leg {
  hip: Vector3;
  /** Foot in the world while it is on the ground. */
  rest: Vector3;
  femur: Mesh;
  tibia: Mesh;
}

/** Points the unit cylinder `m` (y axis, length 1) from `a` to `b`. */
const UP = new Vector3(0, 1, 0);
const d = new Vector3();
function span(m: Mesh, a: Vector3, b: Vector3) {
  d.subVectors(b, a);
  const len = d.length();
  m.position.addVectors(a, b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, d.multiplyScalar(1 / len));
  m.scale.set(1, len, 1);
}

/**
 * Glass fly posed by `FlyPose`: the mid legs push off and it leaves the frame (jump), the proboscis
 * swings forward and lengthens, the far wing swings out and flicks per wing-MN spike. A driven
 * part glows saffron.
 */
export class FlyModel {
  readonly root = new Group();
  private readonly body = new Group();
  private readonly proboscis = new Group();
  private readonly wingYaw = new Group();
  private readonly wingFlap = new Group();
  private readonly shadow: Mesh;
  private readonly legs: Leg[] = [];
  private readonly skin = heated(GLASS);
  private readonly legHeat = heated(GLASS);
  private readonly mouthHeat = heated(GLASS);
  private readonly wingHeat = heated(WING_GLASS);
  private readonly inv = new Matrix4();
  private readonly foot = new Vector3();
  private readonly bend = new Vector3();
  private readonly knee = new Vector3();

  constructor() {
    const skin = this.skin.mat;
    this.body.add(
      ellipsoid(skin, [0, 0.66, 0], [0.5, 0.36, 0.34]),
      ellipsoid(skin, [0.6, 0.7, 0], [0.22, 0.28, 0.32]),
      ellipsoid(skin, [0.64, 0.74, 0.22], [0.15, 0.21, 0.12]),
      ellipsoid(skin, [0.64, 0.74, -0.22], [0.15, 0.21, 0.12]),
    );
    const abdomen = ellipsoid(skin, [-0.92, 0.56, 0], [0.7, 0.33, 0.33]);
    abdomen.rotation.z = 0.12;
    this.body.add(abdomen);

    // proboscis: pivot under the head, segments hang along −y
    this.proboscis.position.set(0.66, 0.46, 0);
    const rostrum = part(new CapsuleGeometry(0.06, 0.2, 4, 12), this.mouthHeat.mat);
    rostrum.position.y = -0.16;
    const labellum = ellipsoid(this.mouthHeat.mat, [0, -0.34, 0], [0.09, 0.06, 0.1]);
    this.proboscis.add(rostrum, labellum);
    this.body.add(this.proboscis);

    // wings: a flat ellipse trailing the hinge along −x, outlined by a thin ring of triangles
    const ellipse = (inset: number) =>
      new EllipseCurve(-0.72, 0, 0.72 - inset, 0.21 - inset, 0, Math.PI * 2, false, 0).getPoints(48);
    const wingGeo = new ShapeGeometry(new Shape(ellipse(0))).rotateX(-Math.PI / 2);
    const ring = new Shape(ellipse(0));
    ring.holes.push(new Path(ellipse(EDGE)));
    const edgeGeo = new ShapeGeometry(ring).rotateX(-Math.PI / 2);
    const wing = (h: ReturnType<typeof heated>) => [part(wingGeo, h.mat), part(edgeGeo, h.line)];
    const near = new Group();
    near.position.set(0.05, 0.94, 0.16);
    near.rotation.y = WING.fold;
    near.add(...wing(heated(WING_GLASS)));
    this.wingFlap.add(...wing(this.wingHeat));
    this.wingYaw.position.set(0.05, 0.96, -0.16);
    this.wingYaw.add(this.wingFlap);
    this.body.add(near, this.wingYaw);

    const cyl = new CylinderGeometry(LEG_R, LEG_R, 1, 6, 1, true);
    for (const l of LEGS) {
      for (const side of [1, -1]) {
        const mat = 'jump' in l ? this.legHeat.mat : skin;
        const leg: Leg = {
          hip: new Vector3(l.hip[0], l.hip[1], l.hip[2] * side),
          rest: new Vector3(l.foot[0], l.foot[1], l.foot[2] * side),
          femur: new Mesh(cyl, mat),
          tibia: new Mesh(cyl, mat),
        };
        this.legs.push(leg);
        this.body.add(leg.femur, leg.tibia);
      }
    }

    this.shadow = part(
      new ShapeGeometry(new Shape(new EllipseCurve(0, 0, 1.3, 0.5).getPoints(48))).rotateX(-Math.PI / 2),
      heated({ rimPower: 1, rimGain: 0, fill: 0.035 }).mat,
    );
    this.shadow.position.set(-0.2, 0.001, 0);
    this.root.add(this.shadow, this.body);
    this.pose({
      jumpAt: null,
      firstJumpAt: null,
      jumps: 0,
      lift: 0,
      drop: 0,
      proboscis: 0,
      wing: 0,
      flick: 0,
    });
  }

  pose(p: FlyPose): void {
    const push = Math.min(1, p.lift / PUSH);
    const fly = Math.max(0, (p.lift - PUSH) / (1 - PUSH));
    const b = this.body;
    // ease-in fall: slow at the top, lands with a little speed
    const drop = DROP * p.drop * p.drop;
    b.position.set(FLIGHT.forward * fly, STAND + PUSH_RISE * push + FLIGHT.up * fly + drop, 0);
    b.rotation.set(FLIGHT.roll * fly, 0, FLIGHT.pitch * fly);
    b.visible = p.lift < 1;
    this.shadow.scale.setScalar(1 / (1 + b.position.y));

    const k = p.proboscis;
    this.proboscis.rotation.z = PROBOSCIS.fold + (PROBOSCIS.out - PROBOSCIS.fold) * k;
    this.proboscis.scale.y = PROBOSCIS.len0 + (PROBOSCIS.len1 - PROBOSCIS.len0) * k;

    this.wingYaw.rotation.y = -(WING.fold + (WING.out - WING.fold) * p.wing);
    this.wingFlap.rotation.z = -WING.flick * p.flick;

    this.skin.heat(0);
    this.legHeat.heat(p.jumpAt === null ? 0 : 1 - p.lift);
    this.mouthHeat.heat(k);
    this.wingHeat.heat(Math.max(0.6 * p.wing, p.flick));

    b.updateMatrix();
    this.inv.copy(b.matrix).invert();
    for (const l of this.legs) this.place(l);
  }

  /** Two-bone leg: the foot stays planted until the leg is straight, then hangs from the hip. */
  private place(l: Leg) {
    const f = this.foot.copy(l.rest).applyMatrix4(this.inv);
    d.subVectors(f, l.hip);
    const reach = FEMUR + TIBIA;
    let dist = d.length();
    if (dist > reach * 0.999) {
      dist = reach * 0.999;
      f.copy(l.hip).addScaledVector(d.normalize(), dist);
    }
    // knee: up and out of the hip–foot line (law of cosines)
    const a = (FEMUR * FEMUR - TIBIA * TIBIA + dist * dist) / (2 * dist);
    const h = Math.sqrt(Math.max(0, FEMUR * FEMUR - a * a));
    const axis = d.subVectors(f, l.hip).normalize();
    const out = this.bend.set(0, 1, 0).addScaledVector(axis, -axis.y).normalize();
    const knee = this.knee.copy(l.hip).addScaledVector(axis, a).addScaledVector(out, h);
    span(l.femur, l.hip, knee);
    span(l.tibia, knee, f);
  }
}
