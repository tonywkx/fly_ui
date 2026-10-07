import { FLY_LEN, type ItemKind, type World } from '@fly/sim';
import { reaction } from 'mobx';
import { dish, type Hand } from '@/state/dish';
import type { DishScene } from './DishScene';
import { ahead, inDish, itemAt, type Spot } from './place';

/** Keys 1–4 place, 5–6 pick up a hand (TERRARIUM-SHAPE §Layout). */
export const ITEM_KEYS: readonly ItemKind[] = ['sugar', 'bitter', 'odor', 'female'];
export const HAND_KEYS: readonly Hand[] = ['shadow', 'swatter'];
/** A palette press that moves less than this (px) is a tap: place ahead of the fly. */
const TAP_PX = 6;
/** A floor point this close to the fly (mm) is on her. */
const FLY_HIT = 0.6 * FLY_LEN;

const svgCursor = (svg: string, hot: number) =>
  `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hot} ${hot}, crosshair`;
/** Cursor = the tool glyph. */
const CURSOR: Record<Hand, string> = {
  shadow: svgCursor(
    '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="10" fill="#000" fill-opacity=".7" stroke="#fff" stroke-opacity=".8"/></svg>',
    14,
  ),
  swatter: svgCursor(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" stroke="#fff" stroke-opacity=".9"><rect x="13" y="2" width="16" height="16" rx="3" transform="rotate(45 21 10)"/><path d="M15 17 5 27"/><circle cx="4" cy="28" r="2" fill="#fff"/></svg>',
    4,
  ),
};

/**
 * Terrarium input: drag items in the dish (off the dish = remove), the shadow (hold) and the
 * swatter (click), keys 1–6 / Esc / R / Space, and drags or taps from the palette. Listens in the
 * capture phase on the host so a press it takes never reaches the orbit controls.
 */
export class DishInput {
  /** Item under the cursor (its × shows), or null. */
  hover: number | null = null;
  private pointer: { x: number; y: number } | null = null;
  private drag: { pid: number; id: number; off: boolean } | null = null;
  private shading: number | null = null;
  private readonly off: (() => void)[] = [];

  constructor(
    private readonly host: HTMLElement,
    private readonly scene: DishScene,
    private readonly world: World,
    private readonly run: { reset(): void; togglePause(): void; dive(): void; readonly zooming: boolean },
  ) {
    this.listen(host, 'pointerdown', (e) => this.down(e), true);
    this.listen(host, 'pointermove', (e) => this.move(e));
    this.listen(host, 'pointerup', (e) => this.up(e));
    this.listen(host, 'pointercancel', (e) => this.up(e));
    this.listen(host, 'pointerleave', () => {
      this.pointer = null;
      if (!this.drag) this.scene.aim(null);
    });
    this.listen(host, 'contextmenu', (e) => {
      if (!dish.hand) return;
      e.preventDefault();
      dish.putDown();
    });
    this.listen(window, 'keydown', (e) => this.key(e));
    this.off.push(
      reaction(
        () => dish.hand,
        (h) => {
          this.scene.canvas.style.cursor = h ? CURSOR[h] : '';
          if (h) this.hover = null;
          if (h !== 'shadow') this.releaseShadow();
          if (!h) this.scene.aim(null);
        },
        { fireImmediately: true },
      ),
    );
    this.changed();
  }

  /** Place `kind` at a floor point, or ahead of the fly; false when the dish refuses it. */
  place(kind: ItemKind, p: Spot | null = null): boolean {
    const at = p && inDish(p) ? p : ahead(this.world.fly, this.world.items);
    const ok = this.world.add(kind, at.x, at.y) !== null;
    this.changed();
    return ok;
  }

  remove(id: number): void {
    this.world.remove(id);
    if (this.hover === id) this.hover = null;
    this.changed();
  }

  /** Empty the dish and restart the brain (`R`). */
  reset(): void {
    this.run.reset();
    this.hover = null;
    this.changed();
  }

  private changed(): void {
    dish.setEmpty(this.world.items.length === 0);
  }

  /**
   * A press on a palette row: dragging shows a ghost and drops into the dish on release; a tap
   * places ahead of the fly. Pointer capture keeps the moves coming to the row.
   */
  dragNew(kind: ItemKind, e: PointerEvent): void {
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const x0 = e.clientX;
    const y0 = e.clientY;
    let moved = false;
    const spot = (ev: PointerEvent) => {
      const p = this.scene.pick(ev.clientX, ev.clientY);
      return p && inDish(p) ? p : null;
    };
    const mv = (ev: PointerEvent) => {
      moved ||= Math.hypot(ev.clientX - x0, ev.clientY - y0) > TAP_PX;
      if (moved) this.scene.aim(spot(ev), kind);
    };
    const end = (ev: PointerEvent) => {
      el.removeEventListener('pointermove', mv);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
      this.scene.aim(null);
      if (ev.type === 'pointercancel') return;
      if (!moved) this.place(kind);
      else {
        const p = spot(ev);
        if (p) this.place(kind, p);
      }
    };
    el.addEventListener('pointermove', mv);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  dispose(): void {
    for (const f of this.off) f();
    this.releaseShadow();
  }

  private listen<K extends keyof WindowEventMap>(
    t: HTMLElement | Window,
    type: K,
    fn: (e: WindowEventMap[K]) => void,
    capture = false,
  ): void {
    t.addEventListener(type, fn as EventListener, capture);
    this.off.push(() => t.removeEventListener(type, fn as EventListener, capture));
  }

  private onCanvas(e: Event): boolean {
    return e.target === this.scene.canvas;
  }

  private down(e: PointerEvent): void {
    if (!this.onCanvas(e) || e.button !== 0) return;
    if (this.run.zooming) {
      e.stopPropagation();
      return;
    }
    const p = this.scene.pick(e.clientX, e.clientY);
    const hand = dish.hand;
    if (hand) {
      e.stopPropagation();
      if (!p || !inDish(p)) return;
      if (hand === 'swatter') this.world.swat(p.x, p.y);
      else {
        this.shading = e.pointerId;
        this.host.setPointerCapture(e.pointerId);
        this.world.shadow(p.x, p.y);
      }
      return;
    }
    const it = p && itemAt(this.world.items, p.x, p.y);
    if (!it) {
      if (!this.onFly(p)) return;
      e.stopPropagation();
      this.hover = null;
      this.scene.canvas.style.cursor = '';
      this.run.dive();
      return;
    }
    e.stopPropagation();
    this.host.setPointerCapture(e.pointerId);
    this.drag = { pid: e.pointerId, id: it.id, off: false };
    this.hover = null;
    this.scene.canvas.style.cursor = 'grabbing';
  }

  private move(e: PointerEvent): void {
    this.pointer = { x: e.clientX, y: e.clientY };
    const p = this.scene.pick(e.clientX, e.clientY);
    const d = this.drag;
    if (d && d.pid === e.pointerId) {
      d.off = !p || !this.world.move(d.id, p.x, p.y);
      this.scene.aim(d.off ? null : p);
      return;
    }
    if (this.shading === e.pointerId) {
      if (p && inDish(p)) this.world.shadow(p.x, p.y);
    }
    if (dish.hand) {
      this.scene.aim(p && inDish(p) ? p : null);
      return;
    }
    if (!this.onCanvas(e) || this.run.zooming) return;
    const it = p && itemAt(this.world.items, p.x, p.y);
    if (it) this.hover = it.id;
    else if (this.hover !== null && !this.near(this.hover, p)) this.hover = null;
    this.scene.canvas.style.cursor = it ? 'grab' : this.onFly(p) ? 'zoom-in' : '';
  }

  /** The point is on the fly standing in the dish (a click there dives into her head). */
  private onFly(p: Spot | null): boolean {
    const f = this.world.fly;
    return !!p && f.air === 0 && f.down === 0 && Math.hypot(p.x - f.x, p.y - f.y) < FLY_HIT;
  }

  private up(e: PointerEvent): void {
    if (this.shading === e.pointerId) this.releaseShadow();
    const d = this.drag;
    if (!d || d.pid !== e.pointerId) return;
    this.drag = null;
    this.scene.aim(null);
    this.scene.canvas.style.cursor = '';
    if (d.off) this.remove(d.id);
  }

  private key(e: KeyboardEvent): void {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || this.run.zooming) return;
    if ((e.target as HTMLElement).closest('input, textarea, [contenteditable]')) return;
    const n = Number(e.key);
    const kind = ITEM_KEYS[n - 1];
    const hand = HAND_KEYS[n - 5];
    if (kind) {
      const p = this.pointer && this.scene.pick(this.pointer.x, this.pointer.y);
      this.place(kind, p);
    } else if (hand) dish.toggleHand(hand);
    else if (e.key === 'Escape' && dish.hand) dish.putDown();
    else if (e.code === 'KeyR') this.reset();
    else if (e.code === 'Space') this.run.togglePause();
    else return;
    e.preventDefault();
  }

  /** Hover holds while the cursor stays near the item (on its way to the ×). */
  private near(id: number, p: Spot | null): boolean {
    const it = this.world.items.find((i) => i.id === id);
    return !!it && !!p && Math.hypot(it.x - p.x, it.y - p.y) < 2;
  }

  private releaseShadow(): void {
    if (this.shading === null) return;
    if (this.host.hasPointerCapture(this.shading)) this.host.releasePointerCapture(this.shading);
    this.shading = null;
    this.world.shadow(null);
  }
}
