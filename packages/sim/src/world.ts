import { type Action, eyes, type Senses } from './bridge';
import { mulberry32, type Rng } from './rng';

// Terrarium world (docs/TERRARIUM-SHAPE.md): a 2D dish, a fly, items and the visitor's hands.
// Units: mm, ms, rad (x right, y up, heading CCW from +x; bearing + = left, as in `eyes`).
// Walking is scripted (wander, wall, odor/sugar drift — labelled simplifications); the connectome
// only picks the action that `step` consumes.

export const ARENA_R = 12;
export const FLY_LEN = 2.5;
/** Head ahead of the body centre: taste and contact are measured from here. */
const HEAD = FLY_LEN / 2;
/** Body centre never goes past this radius. */
const WALL = ARENA_R - 0.5;

const WALK_V = 0.012; // mm/ms
const BACK_V = 0.006;
const COURT_V = 0.006;
/** Walking slows on a taste contact (flies stop to sample with their legs). */
const CONTACT_SLOW = 0.3;
/** Wander: Ornstein–Uhlenbeck turn rate, τ and stationary sd (rad/ms). */
const WANDER_TAU = 300;
const WANDER_SD = 0.0015;
/** Steering gains (rad/ms per unit sin(bearing)). */
const K_WALL = 0.006;
const K_ODOR = 0.005;
const K_SUGAR = 0.008;
const K_COURT = 0.004;
/** Puppet steering (arrow keys), rad/ms: ≈ 290°/s sim, a full circle in ≈ 7.5 s at ×1/6. */
const STEER = 0.005;
/** Wall steering starts this far from the rim. */
const WALL_ZONE = 2;
/** Sugar pulls within this head distance; a tasted crystal pulls again only after the fly leaves `SUGAR_FORGET`. */
const SUGAR_PULL = 3;
const SUGAR_FORGET = 5;

/** Head within this of an item centre = contact. */
const CONTACT = 1;
/** Female seen within this range and ±`FOV` of the heading. */
const FEMALE_RANGE = 6;
/** …and at full strength from this close (one eye at half strength is too weak to court, 8.5). */
const FEMALE_FULL = 3;
const FOV = (5 * Math.PI) / 6;
const FEMALE_V = 0.003;
const FEMALE_CIRCLE = 2;
const COURT_GAP = 2;

/** Disc angular size that counts as full loom. */
const LOOM_FULL = Math.PI / 3;
const SHADOW_R0 = 0.5;
const SHADOW_MAX = 8;
const SHADOW_GROW = 0.006; // mm/ms
const SHADOW_SHRINK = 0.012;
export const SWAT_MS = 120;
export const SWAT_R = 5;
/** Strikes farther than 4 fly lengths go unnoticed. */
const SWAT_REACH = 4 * FLY_LEN;
const HIT_R = 2.5;

export const AIR_MS = 400;
export const DOWN_MS = 1000;

export type ItemKind = 'sugar' | 'bitter' | 'odor' | 'female';
const SINGLE: ReadonlySet<ItemKind> = new Set(['odor', 'female']);

export interface Item {
  id: number;
  kind: ItemKind;
  x: number;
  y: number;
  /** Female only: walking direction. */
  heading: number;
}

export interface Fly {
  x: number;
  y: number;
  heading: number;
  /** Last action applied. */
  action: Action;
  /** ms left in the air after a jump (0 = on the floor). */
  air: number;
  /** ms left shattered after a hit (0 = whole). */
  down: number;
}

export interface Hands {
  shadow: { x: number; y: number; r: number; held: boolean } | null;
  swatter: { x: number; y: number; t: number } | null;
}

export interface WorldEvent {
  kind: 'takeoff' | 'land' | 'hit' | 'miss' | 'reassemble';
  t: number;
  x: number;
  y: number;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

const freshFly = (): Fly => ({ x: 0, y: 0, heading: 0, action: 'walk', air: 0, down: 0 });

export class World {
  fly: Fly = freshFly();
  items: Item[] = [];
  hands: Hands = { shadow: null, swatter: null };
  /** World time, ms. */
  t = 0;
  /** Visitor's steering while walking: +1 left, −1 right, 0 = the scripted wander. */
  steer: -1 | 0 | 1 = 0;
  private omega = 0;
  private nextId = 1;
  private readonly tasted = new Set<number>();

  private rng: Rng;

  /** `reset` reseeds, so a rerun with the same inputs retraces the first. */
  constructor(private readonly seed: number) {
    this.rng = mulberry32(seed);
  }

  /** Place an item; null when off the dish or a second odor / female. */
  add(kind: ItemKind, x: number, y: number): number | null {
    if (Math.hypot(x, y) > ARENA_R) return null;
    if (SINGLE.has(kind) && this.items.some((i) => i.kind === kind)) return null;
    const id = this.nextId++;
    this.items.push({ id, kind, x, y, heading: kind === 'female' ? femaleHeading(x, y) : 0 });
    return id;
  }

  remove(id: number): boolean {
    const n = this.items.length;
    this.items = this.items.filter((i) => i.id !== id);
    this.tasted.delete(id);
    return this.items.length < n;
  }

  /** Drag a placed item to a new point; false when off the dish or no such item. */
  move(id: number, x: number, y: number): boolean {
    const it = this.items.find((i) => i.id === id);
    if (!it || Math.hypot(x, y) > ARENA_R) return false;
    Object.assign(it, { x, y });
    if (it.kind === 'female') it.heading = femaleHeading(x, y);
    this.tasted.delete(id);
    return true;
  }

  /** Items, fly, hands and rng back to the start (operations live in the sim, not here). */
  reset(): void {
    this.rng = mulberry32(this.seed);
    this.fly = freshFly();
    this.items = [];
    this.hands = { shadow: null, swatter: null };
    this.t = 0;
    this.steer = 0;
    this.omega = 0;
    this.tasted.clear();
  }

  /** Hold the shadow at a point (it grows while held); null releases it (it withdraws). */
  shadow(x: number, y: number): void;
  shadow(p: null): void;
  shadow(x: number | null, y = 0): void {
    const s = this.hands.shadow;
    if (x === null) {
      if (s) s.held = false;
    } else if (s) Object.assign(s, { x, y, held: true });
    else this.hands.shadow = { x, y, r: SHADOW_R0, held: true };
  }

  /** Swing at a point; it lands `SWAT_MS` later. False while one is already in the air. */
  swat(x: number, y: number): boolean {
    if (this.hands.swatter) return false;
    this.hands.swatter = { x, y, t: 0 };
    return true;
  }

  /** What the fly senses now; nothing while airborne or shattered. */
  sense(): Senses {
    const s: Senses = { sugar: 0, bitter: 0, loom: { L: 0, R: 0 }, female: { L: 0, R: 0 } };
    const f = this.fly;
    if (f.air > 0 || f.down > 0) return s;
    const hx = f.x + HEAD * Math.cos(f.heading);
    const hy = f.y + HEAD * Math.sin(f.heading);
    for (const i of this.items) {
      if (i.kind === 'sugar' || i.kind === 'bitter') {
        if (Math.hypot(i.x - hx, i.y - hy) <= CONTACT) s[i.kind] = 1;
      } else if (i.kind === 'female') {
        const d = Math.hypot(i.x - f.x, i.y - f.y);
        const b = this.bearing(i.x, i.y);
        if (d < FEMALE_RANGE && Math.abs(b) < FOV)
          s.female = eyes(b, Math.min(1, (FEMALE_RANGE - d) / (FEMALE_RANGE - FEMALE_FULL)));
      }
    }
    let loom = 0;
    let at = 0;
    const disc = (x: number, y: number, r: number) => {
      const d = Math.hypot(x - f.x, y - f.y);
      const a = Math.min(1, (2 * Math.atan(r / Math.max(d, r))) / LOOM_FULL);
      if (a > loom) {
        loom = a;
        at = d > 1e-9 ? this.bearing(x, y) : 0;
      }
    };
    const { shadow: sh, swatter: sw } = this.hands;
    if (sh) disc(sh.x, sh.y, sh.r);
    if (sw && Math.hypot(sw.x - f.x, sw.y - f.y) <= SWAT_REACH) disc(sw.x, sw.y, (SWAT_R * sw.t) / SWAT_MS);
    if (loom > 0) s.loom = eyes(at, loom);
    return s;
  }

  /** Advance `dt` ms doing `action`; returns what happened on the way. */
  step(dt: number, action: Action): WorldEvent[] {
    const ev: WorldEvent[] = [];
    const f = this.fly;
    this.t += dt;
    const emit = (kind: WorldEvent['kind'], x = f.x, y = f.y) => ev.push({ kind, t: this.t, x, y });
    this.moveFemale(dt);
    this.moveHands(dt, emit);

    const prev = f.action;
    f.action = action;
    if (f.down > 0) {
      f.down -= dt;
      if (f.down <= 0) {
        f.down = 0;
        const a = 2 * Math.PI * this.rng();
        f.x = (ARENA_R - 1.5) * Math.cos(a);
        f.y = (ARENA_R - 1.5) * Math.sin(a);
        f.heading = wrap(a + Math.PI);
        this.omega = 0;
        emit('reassemble');
      }
      return ev;
    }
    if (f.air > 0) {
      f.air -= dt;
      if (f.air <= 0) {
        f.air = 0;
        const r = (ARENA_R - 2) * Math.sqrt(this.rng());
        const a = 2 * Math.PI * this.rng();
        f.x = r * Math.cos(a);
        f.y = r * Math.sin(a);
        f.heading = wrap(2 * Math.PI * this.rng());
        this.omega = 0;
        emit('land');
      }
      return ev;
    }
    if (action === 'jump') {
      if (prev !== 'jump') {
        f.air = AIR_MS;
        emit('takeoff');
      }
      return ev;
    }
    // Backing off ends with a turn away (scripted).
    if (prev === 'back' && action !== 'back') {
      const side = this.rng() < 0.5 ? -1 : 1;
      f.heading = wrap(f.heading + side * (Math.PI / 2 + (Math.PI / 2) * this.rng()));
    }
    if (action === 'walk') this.walk(dt);
    else if (action === 'back') this.advance(-BACK_V * dt);
    else if (action === 'court') this.court(dt);
    return ev;
  }

  private bearing(x: number, y: number): number {
    const f = this.fly;
    return wrap(Math.atan2(y - f.y, x - f.x) - f.heading);
  }

  private walk(dt: number): void {
    const f = this.fly;
    const n = (this.rng() + this.rng() + this.rng() - 1.5) * 2;
    const sigma = WANDER_SD * Math.sqrt(2 / WANDER_TAU);
    this.omega += (-this.omega / WANDER_TAU) * dt + sigma * Math.sqrt(dt) * n;
    let turn = this.omega;
    const hx = f.x + HEAD * Math.cos(f.heading);
    const hy = f.y + HEAD * Math.sin(f.heading);
    let v = WALK_V;
    for (const i of this.items) {
      const d = Math.hypot(i.x - hx, i.y - hy);
      if (i.kind === 'odor') turn += K_ODOR * Math.sin(this.bearing(i.x, i.y));
      if (i.kind === 'sugar' || i.kind === 'bitter') {
        if (d <= CONTACT) {
          v = WALK_V * CONTACT_SLOW;
          this.tasted.add(i.id);
        } else if (d > SUGAR_FORGET) this.tasted.delete(i.id);
        if (i.kind === 'sugar' && d < SUGAR_PULL && !this.tasted.has(i.id))
          turn += K_SUGAR * Math.sin(this.bearing(i.x, i.y));
      }
    }
    if (Math.hypot(f.x, f.y) > WALL - WALL_ZONE) {
      const b = this.bearing(0, 0);
      if (Math.abs(b) > Math.PI / 2 - 0.3) turn += K_WALL * Math.sign(b || 1);
    }
    // the visitor's hand replaces the wander and the pulls; contact still slows
    if (this.steer) {
      this.omega = 0;
      turn = STEER * this.steer;
    }
    f.heading = wrap(f.heading + turn * dt);
    this.advance(v * dt);
  }

  private court(dt: number): void {
    const f = this.fly;
    const g = this.items.find((i) => i.kind === 'female');
    if (!g) return;
    const b = this.bearing(g.x, g.y);
    f.heading = wrap(f.heading + Math.sign(b) * Math.min(Math.abs(b), K_COURT * dt));
    const d = Math.hypot(g.x - f.x, g.y - f.y);
    this.advance(Math.min(COURT_V, Math.max(0, d - COURT_GAP) * 0.003) * dt);
  }

  /** Move along the heading (negative = backwards), held inside the dish. */
  private advance(s: number): void {
    const f = this.fly;
    f.x += s * Math.cos(f.heading);
    f.y += s * Math.sin(f.heading);
    const r = Math.hypot(f.x, f.y);
    if (r > WALL) {
      f.x *= WALL / r;
      f.y *= WALL / r;
    }
  }

  private moveFemale(dt: number): void {
    for (const g of this.items) {
      if (g.kind !== 'female') continue;
      g.heading = wrap(g.heading + (FEMALE_V / FEMALE_CIRCLE) * dt);
      g.x += FEMALE_V * dt * Math.cos(g.heading);
      g.y += FEMALE_V * dt * Math.sin(g.heading);
    }
  }

  private moveHands(dt: number, emit: (k: WorldEvent['kind'], x?: number, y?: number) => void): void {
    const sh = this.hands.shadow;
    if (sh) {
      sh.r = sh.held ? Math.min(SHADOW_MAX, sh.r + SHADOW_GROW * dt) : sh.r - SHADOW_SHRINK * dt;
      if (sh.r <= 0) this.hands.shadow = null;
    }
    const sw = this.hands.swatter;
    if (!sw) return;
    sw.t += dt;
    if (sw.t < SWAT_MS) return;
    this.hands.swatter = null;
    const f = this.fly;
    const hit = f.air === 0 && f.down === 0 && Math.hypot(sw.x - f.x, sw.y - f.y) <= HIT_R;
    if (hit) f.down = DOWN_MS;
    emit(hit ? 'hit' : 'miss', sw.x, sw.y);
  }
}

/** Female circles counter-clockwise around a centre `FEMALE_CIRCLE` toward the dish centre, so she stays inside. */
function femaleHeading(x: number, y: number): number {
  const r = Math.hypot(x, y);
  const [ux, uy] = r > 1e-9 ? [-x / r, -y / r] : [0, 1];
  return Math.atan2(-ux, uy);
}
