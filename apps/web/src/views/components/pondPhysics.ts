/**
 * Bathtub physics for the home page duck pond (see DuckPond.tsx).
 *
 * Water: the classic two-buffer ripple simulation on a coarse grid (one cell
 * is one pixel-art pixel). Every cell moves towards the average of its
 * neighbours and remembers its last height, so a poke spreads as rings that
 * bounce off the tub walls and slowly die out.
 *
 * Ducks: round floating bodies. The water slope pushes them downhill (waves
 * carry them), they paddle around a little on their own, drag slows them,
 * they bounce off the walls and off each other, and every bump or fast swim
 * makes new ripples. Plain numbers only, no DOM: easy to test and to run at
 * a fixed 60 steps per second.
 */

export type DuckKind = 'user' | 'agent';

export interface PondDuck {
  id: string;
  kind: DuckKind;
  /** Our own duck (marked in the pond). */
  self: boolean;
  /** Center, in cells. */
  x: number;
  y: number;
  /** Velocity, in cells per step. */
  vx: number;
  vy: number;
  /** Which way the sprite looks (1 right, -1 left). */
  facing: 1 | -1;
  /** Slowly wandering paddle direction (radians). */
  heading: number;
  /** Held by the pointer: physics leaves it alone. */
  held: boolean;
}

/** Collision radius of a duck, in cells (the sprite is 16 cells wide). */
export const DUCK_RADIUS = 6;
/** More ducks than this would just be a crowd: the rest is shown as "+N". */
export const MAX_DUCKS = 12;

/** Ripple energy kept per step: < 1 so waves fade, close to 1 so they travel. */
const DAMPING = 0.975;
/** How strongly the water slope pushes a duck. */
const SLOPE_PUSH = 0.012;
/** Self-propulsion: gentle, so waves and bumps stay the main show. */
const PADDLE = 0.0035;
const DRAG = 0.965;
/** Bounciness of duck-duck and duck-wall hits. */
const RESTITUTION = 0.7;
/** Fastest a thrown duck may travel (cells per step). */
export const MAX_SPEED = 2;

export interface DuckSeed {
  id: string;
  kind: DuckKind;
  self: boolean;
}

export class Pond {
  readonly w: number;
  readonly h: number;
  /** Current and previous water heights (swapped every step). */
  private cur: Float32Array;
  private prev: Float32Array;
  ducks: PondDuck[] = [];

  constructor(
    w: number,
    h: number,
    private rand: () => number = Math.random,
  ) {
    this.w = Math.max(8, Math.floor(w));
    this.h = Math.max(8, Math.floor(h));
    this.cur = new Float32Array(this.w * this.h);
    this.prev = new Float32Array(this.w * this.h);
  }

  /** Water height at a cell (0 outside the tub). */
  height(x: number, y: number): number {
    const cx = Math.round(x);
    const cy = Math.round(y);
    if (cx < 0 || cy < 0 || cx >= this.w || cy >= this.h) return 0;
    return this.cur[cy * this.w + cx]!;
  }

  /** Pokes the water: a soft bump of `amount` that fades out over `radius` cells. */
  disturb(x: number, y: number, amount: number, radius = 2) {
    const r = Math.max(1, radius);
    for (let cy = Math.floor(y - r); cy <= Math.ceil(y + r); cy++) {
      if (cy < 1 || cy >= this.h - 1) continue;
      for (let cx = Math.floor(x - r); cx <= Math.ceil(x + r); cx++) {
        if (cx < 1 || cx >= this.w - 1) continue;
        const d = Math.hypot(cx - x, cy - y);
        if (d <= r) this.cur[cy * this.w + cx]! += amount * (1 - d / (r + 1));
      }
    }
  }

  /**
   * Matches the ducks to who is online: new ones drop in with a splash, the
   * ones that left hop out (another splash), the rest keep swimming.
   */
  sync(seeds: readonly DuckSeed[]) {
    const wanted = new Map(seeds.map((s) => [s.id, s]));
    for (const duck of this.ducks) {
      if (!wanted.has(duck.id)) this.disturb(duck.x, duck.y, 8, 3);
    }
    this.ducks = this.ducks.filter((d) => wanted.has(d.id));
    for (const duck of this.ducks) duck.kind = wanted.get(duck.id)!.kind;
    const known = new Set(this.ducks.map((d) => d.id));
    for (const seed of seeds) {
      if (known.has(seed.id)) continue;
      const { x, y } = this.freeSpot();
      const heading = this.rand() * Math.PI * 2;
      this.ducks.push({
        ...seed,
        x,
        y,
        vx: 0,
        vy: 0,
        facing: Math.cos(heading) >= 0 ? 1 : -1,
        heading,
        held: false,
      });
      this.disturb(x, y, 12, 3);
    }
  }

  /** The duck under a point, if any (for grabbing). */
  duckAt(x: number, y: number): PondDuck | undefined {
    // Last drawn is on top, so search from the end.
    for (let i = this.ducks.length - 1; i >= 0; i--) {
      const d = this.ducks[i]!;
      if (Math.hypot(d.x - x, d.y - 4 - y) <= DUCK_RADIUS + 3) return d;
    }
    return undefined;
  }

  /** Advances the water and the ducks by one fixed step (1/60 s). */
  step() {
    this.stepWater();
    for (const duck of this.ducks) if (!duck.held) this.stepDuck(duck);
    this.collide();
  }

  private stepWater() {
    const { w, h, cur, prev } = this;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        prev[i] =
          ((cur[i - 1]! + cur[i + 1]! + cur[i - w]! + cur[i + w]!) / 2 - prev[i]!) * DAMPING;
      }
    }
    this.cur = prev;
    this.prev = cur;
  }

  private stepDuck(d: PondDuck) {
    // Waves carry the duck downhill.
    d.vx -= (this.height(d.x + 1, d.y) - this.height(d.x - 1, d.y)) * SLOPE_PUSH;
    d.vy -= (this.height(d.x, d.y + 1) - this.height(d.x, d.y - 1)) * SLOPE_PUSH;
    // A lazy paddle in a slowly changing direction.
    d.heading += (this.rand() - 0.5) * 0.12;
    d.vx += Math.cos(d.heading) * PADDLE;
    d.vy += Math.sin(d.heading) * PADDLE * 0.6;
    d.vx *= DRAG;
    d.vy *= DRAG;
    d.x += d.vx;
    d.y += d.vy;

    // Tub walls: bounce back, splash, and paddle away from the wall.
    const r = DUCK_RADIUS;
    const hitX = d.x < r || d.x > this.w - r;
    const hitY = d.y < r + 4 || d.y > this.h - r;
    if (hitX) {
      d.x = Math.min(this.w - r, Math.max(r, d.x));
      this.bump(d.x, d.y, Math.abs(d.vx));
      d.vx = -d.vx * RESTITUTION;
      d.heading = Math.PI - d.heading;
    }
    if (hitY) {
      d.y = Math.min(this.h - r, Math.max(r + 4, d.y));
      this.bump(d.x, d.y, Math.abs(d.vy));
      d.vy = -d.vy * RESTITUTION;
      d.heading = -d.heading;
    }

    // A wake behind fast swimmers.
    const speed = Math.hypot(d.vx, d.vy);
    if (speed > 0.15) this.disturb(d.x - d.vx * 4, d.y - d.vy * 4, Math.min(3, speed * 2.5), 1.5);
    if (d.vx > 0.03) d.facing = 1;
    else if (d.vx < -0.03) d.facing = -1;
  }

  /** Duck-duck hits: push apart, swap momentum along the hit, splash. */
  private collide() {
    const min = DUCK_RADIUS * 2;
    for (let i = 0; i < this.ducks.length; i++) {
      for (let j = i + 1; j < this.ducks.length; j++) {
        const a = this.ducks[i]!;
        const b = this.ducks[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= min) continue;
        // Same spot: pick any direction instead of dividing by zero.
        const nx = dist > 0 ? dx / dist : 1;
        const ny = dist > 0 ? dy / dist : 0;
        const overlap = min - dist;
        // A held duck is an immovable object: the other one takes the whole push.
        const shareA = a.held ? 0 : b.held ? 1 : 0.5;
        const shareB = 1 - shareA;
        a.x -= nx * overlap * shareA;
        a.y -= ny * overlap * shareA;
        b.x += nx * overlap * shareB;
        b.y += ny * overlap * shareB;

        const closing = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (closing >= 0) continue; // already separating
        const impulse = (-(1 + RESTITUTION) * closing) / 2;
        if (!a.held) {
          a.vx -= impulse * nx * (b.held ? 2 : 1);
          a.vy -= impulse * ny * (b.held ? 2 : 1);
        }
        if (!b.held) {
          b.vx += impulse * nx * (a.held ? 2 : 1);
          b.vy += impulse * ny * (a.held ? 2 : 1);
        }
        this.bump(a.x + nx * DUCK_RADIUS, a.y + ny * DUCK_RADIUS, -closing);
      }
    }
  }

  /** A splash proportional to how hard something hit. */
  private bump(x: number, y: number, speed: number) {
    if (speed > 0.05) this.disturb(x, y, Math.min(10, speed * 14), 2);
  }

  /** A random place where a new duck does not land on another one. */
  private freeSpot(): { x: number; y: number } {
    const r = DUCK_RADIUS;
    let best = { x: this.w / 2, y: this.h / 2 };
    for (let tries = 0; tries < 20; tries++) {
      const x = r + this.rand() * (this.w - 2 * r);
      const y = r + 4 + this.rand() * Math.max(1, this.h - 2 * r - 4);
      best = { x, y };
      if (this.ducks.every((d) => Math.hypot(d.x - x, d.y - y) > r * 2.5)) break;
    }
    return best;
  }
}
