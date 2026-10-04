import gsap from 'gsap';
import { reaction } from 'mobx';
import { Vector3 } from 'three/webgpu';
import { app } from '@/state/app';
import { experiment } from '@/state/experiment';
import { playback } from '@/state/playback';
import type { Engine } from './engine';
import { activityFront } from './front';

/** Follow lag: each frame re-aims a strong ease-out of this length at the front (≈ 0.4 s time constant). */
const FOLLOW_S = 1.2;
/** Closest framing, as a share of the whole-CNS distance: a single soma is not filled to the edges. */
const MIN_DIST = 0.25;
/** Reduced motion cuts instead of following: when the front left the frame this far, at most this often. */
const CUT_SHIFT = 0.5;
const CUT_MS = 1500;

/**
 * Director camera (`app.director`): the orbit target and distance follow the activity front (recent
 * spikes, `activityFront`) with GSAP, back to the whole CNS when the activity fades, under a slow
 * turntable. The user's orbit / zoom or a fly-to hands the camera back. Snaps aim instantly;
 * reduced motion cuts between shots. Runs after the intro.
 */
export function startDirector(
  engine: Engine,
  /** Per row centre + radius in source units (`rowBounds`). */
  bounds: Float32Array,
): (() => void)[] {
  const instant = app.params.snap;
  const shot = { x: 0, y: 0, z: 0, d: 1 };
  const to = (['x', 'y', 'z', 'd'] as const).map((k) =>
    gsap.quickTo(shot, k, { duration: FOLLOW_S, ease: 'power3.out' }),
  );
  const aim = new Vector3();
  const c = new Vector3();
  let lastCut = Number.NEGATIVE_INFINITY;
  let on = false;

  const start = () => {
    gsap.killTweensOf(shot);
    const t = engine.target;
    Object.assign(shot, { x: t.x, y: t.y, z: t.z, d: engine.distance });
    lastCut = Number.NEGATIVE_INFINITY;
    on = true;
    engine.setAutoRotate(true);
  };
  const stop = () => {
    gsap.killTweensOf(shot);
    on = false;
    engine.setAutoRotate(false);
  };

  return [
    reaction(
      () => app.director && app.introPhase === 'done',
      (v) => (v ? start() : stop()),
      { fireImmediately: true },
    ),
    stop,
    engine.onUserInput(() => app.setDirector(false)),
    reaction(
      () => experiment.fly,
      (f) => f && app.setDirector(false),
    ),
    engine.onFrame((now) => {
      if (!on) return;
      const rest = engine.restPose.radius;
      const log = playback.log;
      const f = log && activityFront(log, playback.clock.t, bounds);
      let d = rest;
      if (f) {
        engine.world.localToWorld(c.fromArray(f.center));
        d = Math.max(rest * MIN_DIST, engine.frameRadius(f.radius * engine.world.scale.x));
      } else c.set(0, 0, 0);

      if (instant) {
        engine.aim(c, d);
        return;
      }
      if (app.reducedMotion) {
        const away =
          c.distanceTo(engine.target) > CUT_SHIFT * engine.distance ||
          Math.abs(Math.log(d / engine.distance)) > 0.7;
        if (away && now - lastCut >= CUT_MS) {
          lastCut = now;
          engine.aim(c, d);
        }
        return;
      }
      to[0]?.(c.x);
      to[1]?.(c.y);
      to[2]?.(c.z);
      to[3]?.(d);
      engine.aim(aim.set(shot.x, shot.y, shot.z), shot.d);
    }),
  ];
}
