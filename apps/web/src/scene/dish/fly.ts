import { type Action, FLY_LEN } from '@fly/sim';
import { FlyModel } from '../flycam/model';
import { feet, STRIDE } from './gait';

/** FlyModel body length in its own units → world mm. */
const BODY_UNITS = 2.6;
/** Takeoff out of view and the drop-in after landing, sim ms. */
const LIFT_MS = 300;
const DROP_MS = 150;
/** Proboscis / wing travel per sim ms. */
const PROBOSCIS_RATE = 1 / 80;
const WING_RATE = 1 / 60;
/** Song pulse period, sim ms (wing flicks while courting). */
const SONG_MS = 35;
/** Turning in place still steps: body units of foot travel per radian. */
const TURN_STEP = 0.4;

export interface Placed {
  x: number;
  y: number;
  heading: number;
}

const approach = (v: number, to: number, d: number) => (v < to ? Math.min(to, v + d) : Math.max(to, v - d));

/**
 * The glass fly on the dish: world mm/rad → scene (x, −y on the floor), tripod gait from the
 * distance walked, proboscis on `eat`, wing out and flicking on `court`, lift-off and drop-in.
 */
export class FlyView {
  readonly model = new FlyModel();
  readonly root = this.model.root;
  private readonly scale: number;
  private phase = 0;
  private last: Placed | null = null;
  private t = 0;
  private proboscis = 0;
  private wing = 0;
  private takeoff: number | null = null;
  private landed = -Infinity;

  constructor(size = 1) {
    this.scale = (FLY_LEN / BODY_UNITS) * size;
    this.root.scale.setScalar(this.scale);
  }

  takeoffAt(t: number): void {
    this.takeoff = t;
  }

  landAt(t: number): void {
    this.takeoff = null;
    this.landed = t;
    this.last = null;
  }

  /** Back on the floor at t = 0 (dish reset). */
  reset(): void {
    Object.assign(this, { takeoff: null, landed: -Infinity, last: null, t: 0, proboscis: 0, wing: 0 });
  }

  /** Pose at sim time `t`; `hidden` = shattered. Position is kept while airborne (she leaves from there). */
  update(p: Placed, action: Action, t: number, hidden = false): void {
    const dt = Math.max(0, t - this.t);
    this.t = t;
    this.root.visible = !hidden;
    const air = this.takeoff !== null;
    if (!air) {
      if (this.last) {
        const along = (p.x - this.last.x) * Math.cos(p.heading) + (p.y - this.last.y) * Math.sin(p.heading);
        const turn = Math.abs(
          Math.atan2(Math.sin(p.heading - this.last.heading), Math.cos(p.heading - this.last.heading)),
        );
        this.phase += (along / this.scale + Math.sign(along || 1) * turn * TURN_STEP) / STRIDE;
      }
      this.last = { ...p };
      this.root.position.set(p.x, 0, -p.y);
      this.root.rotation.y = p.heading;
    }
    this.proboscis = approach(this.proboscis, action === 'eat' ? 1 : 0, PROBOSCIS_RATE * dt);
    this.wing = approach(this.wing, action === 'court' ? 1 : 0, WING_RATE * dt);
    const lift = air ? Math.min(1, (t - (this.takeoff as number)) / LIFT_MS) : 0;
    const drop = Math.max(0, 1 - (t - this.landed) / DROP_MS);
    this.model.gait(air || drop > 0 ? null : feet(this.phase));
    this.model.pose({
      jumpAt: this.takeoff,
      firstJumpAt: null,
      jumps: 0,
      lift,
      drop,
      proboscis: this.proboscis,
      wing: this.wing,
      flick: this.wing * (0.5 + 0.5 * Math.sin((2 * Math.PI * t) / SONG_MS)),
    });
  }
}
