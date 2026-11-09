/**
 * Bathtub physics for the home page scene (see BathScene.tsx), seen from the
 * front, in 2D: a tiled wall, water at the bottom, rubber ducks floating on top.
 *
 * Water surface: a row of springs, one per pixel column (the classic 2D
 * "spring water"). Each column is pulled back to the rest level and tugs its
 * neighbours, so a poke travels left and right as a wave and slowly dies out.
 *
 * Ducks: floating bodies with gravity and buoyancy. They bob on the waves, are
 * carried along the slope, paddle a little on their own, bounce off the tub
 * sides and off each other, and a duck thrown in the air falls back with a
 * splash (a dip in the surface plus flying droplets). Bubbles rise from the
 * bottom and pop at the surface.
 *
 * Units are pixel-art cells and fixed steps (60 per second). No DOM here.
 */

export type DuckKind = 'user' | 'agent';

export interface BathDuck {
  id: string;
  kind: DuckKind;
  /** Our own duck (marked in the scene). */
  self: boolean;
  /** Center of the duck's waterline, in cells. */
  x: number;
  y: number;
  /** Velocity, in cells per step. */
  vx: number;
  vy: number;
  /** Which way the sprite looks (1 right, -1 left). */
  facing: 1 | -1;
  /** Paddle direction; flips now and then. */
  paddle: 1 | -1;
  /** Held by the pointer: physics leaves it alone. */
  held: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface DuckSeed {
  id: string;
  kind: DuckKind;
  self: boolean;
}

/** Half the width of a duck's body, in cells (the sprite is 16 cells wide). */
export const DUCK_RADIUS = 7;
/** More ducks than this would just be a crowd: the rest is shown as "+N". */
export const MAX_DUCKS = 12;
/** Fastest a thrown duck may travel (cells per step). */
export const MAX_SPEED = 3;

const SPRING = 0.02;
const SPRING_DAMPING = 0.03;
/** How much each column tugs its neighbours (wave speed). */
const SPREAD = 0.22;
const GRAVITY = 0.09;
/** Buoyancy per cell under water: a duck rests about 1.5 cells deep. */
const BUOYANCY = 0.06;
const PADDLE = 0.004;
/** How strongly the surface slope carries a duck. */
const SLOPE_PUSH = 0.03;
const RESTITUTION = 0.6;
const MAX_BUBBLES = 14;

export class Bath {
  readonly w: number;
  readonly h: number;
  /** Rest height of the water surface (cells from the top). */
  readonly level: number;
  /** Surface offset (+ is lower) and its speed, per column. */
  private surf: Float32Array;
  private speed: Float32Array;
  ducks: BathDuck[] = [];
  drops: Particle[] = [];
  bubbles: Particle[] = [];

  constructor(
    w: number,
    h: number,
    levelRatio = 0.68,
    private rand: () => number = Math.random,
  ) {
    this.w = Math.max(16, Math.floor(w));
    this.h = Math.max(16, Math.floor(h));
    this.level = Math.round(this.h * levelRatio);
    this.surf = new Float32Array(this.w);
    this.speed = new Float32Array(this.w);
  }

  /** Height of the water surface at a column (cells from the top). */
  surfaceAt(x: number): number {
    const i = Math.min(this.w - 1, Math.max(0, Math.round(x)));
    return this.level + this.surf[i]!;
  }

  /** Pushes the surface down (positive force) around `x`, fading over `width` columns. */
  splash(x: number, force: number, width = 4) {
    for (let i = Math.floor(x - width); i <= Math.ceil(x + width); i++) {
      if (i < 0 || i >= this.w) continue;
      this.speed[i]! += force * (1 - Math.abs(i - x) / (width + 1));
    }
  }

  /** Throws `count` droplets up from the surface at `x`. */
  spray(x: number, count: number, power = 1) {
    for (let i = 0; i < count; i++) {
      this.drops.push({
        x: x + (this.rand() - 0.5) * 10,
        y: this.surfaceAt(x) - 1,
        vx: (this.rand() - 0.5) * 1.6 * power,
        vy: -(0.8 + this.rand() * 1.4) * power,
      });
    }
  }

  /**
   * Matches the ducks to who is online: new ones drop in from above with a
   * splash, the ones that left hop out (another splash), the rest keep floating.
   */
  sync(seeds: readonly DuckSeed[]) {
    const wanted = new Map(seeds.map((s) => [s.id, s]));
    for (const duck of this.ducks) {
      if (!wanted.has(duck.id)) {
        this.splash(duck.x, -1.5, 6);
        this.spray(duck.x, 6);
      }
    }
    this.ducks = this.ducks.filter((d) => wanted.has(d.id));
    for (const duck of this.ducks) duck.kind = wanted.get(duck.id)!.kind;
    const known = new Set(this.ducks.map((d) => d.id));
    for (const seed of seeds) {
      if (known.has(seed.id)) continue;
      const paddle = this.rand() < 0.5 ? 1 : -1;
      this.ducks.push({
        ...seed,
        x: this.freeX(),
        y: this.level - 30 - this.rand() * 20,
        vx: 0,
        vy: 0,
        facing: paddle,
        paddle,
        held: false,
      });
    }
  }

  /** The duck under a point, if any (for grabbing). */
  duckAt(x: number, y: number): BathDuck | undefined {
    for (let i = this.ducks.length - 1; i >= 0; i--) {
      const d = this.ducks[i]!;
      // The body spans about 12 cells above the waterline and 3 below.
      if (Math.abs(d.x - x) <= DUCK_RADIUS + 1 && y >= d.y - 13 && y <= d.y + 4) return d;
    }
    return undefined;
  }

  /** Advances the water, ducks, droplets and bubbles by one fixed step (1/60 s). */
  step() {
    this.stepSurface();
    for (const duck of this.ducks) if (!duck.held) this.stepDuck(duck);
    this.collide();
    this.stepDrops();
    this.stepBubbles();
  }

  private stepSurface() {
    const { surf, speed, w } = this;
    for (let i = 0; i < w; i++) {
      speed[i]! += -SPRING * surf[i]! - SPRING_DAMPING * speed[i]!;
      surf[i]! += speed[i]!;
    }
    // A few passes of neighbours tugging each other make the waves travel.
    const delta = new Float32Array(w);
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 0; i < w; i++) {
        if (i > 0) delta[i]! += SPREAD * (surf[i - 1]! - surf[i]!);
        if (i < w - 1) delta[i]! += SPREAD * (surf[i + 1]! - surf[i]!);
      }
      for (let i = 0; i < w; i++) {
        speed[i]! += delta[i]! * 0.5;
        surf[i]! += delta[i]! * 0.5;
        delta[i] = 0;
      }
    }
  }

  private stepDuck(d: BathDuck) {
    const surface = this.surfaceAt(d.x);
    const depth = d.y - surface;
    const wasInAir = depth < -0.5;
    d.vy += GRAVITY;
    if (depth > 0) {
      // Floating: buoyancy, water drag, and the waves carry it along.
      d.vy -= BUOYANCY * depth;
      d.vy *= 0.86;
      d.vx -= (this.surfaceAt(d.x + 3) - this.surfaceAt(d.x - 3)) * SLOPE_PUSH;
      if (this.rand() < 0.004) d.paddle = d.paddle === 1 ? -1 : 1;
      d.vx += d.paddle * PADDLE;
      d.vx *= 0.97;
      // A floating duck rocks the water a little as it bobs.
      this.splash(d.x, d.vy * 0.05, 5);
    } else {
      d.vx *= 0.995;
    }
    d.x += d.vx;
    d.y += d.vy;

    // Hitting the water from the air: a dip and a spray, proportional to the speed.
    if (wasInAir && d.y >= this.surfaceAt(d.x) && d.vy > 0.6) {
      this.splash(d.x, Math.min(4, d.vy * 1.4), 7);
      this.spray(d.x, Math.min(14, Math.round(d.vy * 4)), Math.min(1.6, d.vy / 2));
      d.vy *= 0.35;
    }

    // Tub sides: bounce back, and a small splash if it happens in the water.
    const r = DUCK_RADIUS;
    if (d.x < r || d.x > this.w - r) {
      d.x = Math.min(this.w - r, Math.max(r, d.x));
      if (Math.abs(d.vx) > 0.3) this.splash(d.x, Math.abs(d.vx) * 0.8, 4);
      d.vx = -d.vx * RESTITUTION;
      d.paddle = d.x < this.w / 2 ? 1 : -1;
    }
    // Never below the bottom of the tub, never out of the top of the screen.
    d.y = Math.min(this.h - 2, Math.max(14, d.y));

    if (d.vx > 0.04) d.facing = 1;
    else if (d.vx < -0.04) d.facing = -1;
  }

  /** Duck-duck hits: push apart, swap momentum along the hit, splash. */
  private collide() {
    const min = DUCK_RADIUS * 2;
    for (let i = 0; i < this.ducks.length; i++) {
      for (let j = i + 1; j < this.ducks.length; j++) {
        const a = this.ducks[i]!;
        const b = this.ducks[j]!;
        const dx = b.x - a.x;
        // Bodies are wider than tall: vertical distance counts double.
        const dy = (b.y - a.y) * 1.4;
        const dist = Math.hypot(dx, dy);
        if (dist >= min) continue;
        const nx = dist > 0 ? dx / dist : 1;
        const ny = dist > 0 ? dy / dist : 0;
        const overlap = min - dist;
        // A held duck is an immovable object: the other one takes the whole push.
        const shareA = a.held ? 0 : b.held ? 1 : 0.5;
        const shareB = 1 - shareA;
        a.x -= nx * overlap * shareA;
        a.y -= (ny * overlap * shareA) / 1.4;
        b.x += nx * overlap * shareB;
        b.y += (ny * overlap * shareB) / 1.4;

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
        // A bump between floating ducks sends a ripple out from between them.
        const mid = (a.x + b.x) / 2;
        if (-closing > 0.2 && a.y >= this.surfaceAt(mid) - 2) {
          this.splash(mid, Math.min(2.5, -closing * 1.5), 4);
          this.spray(mid, Math.min(5, Math.round(-closing * 3)), 0.6);
        }
      }
    }
  }

  private stepDrops() {
    this.drops = this.drops.filter((p) => {
      p.vy += GRAVITY;
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x >= this.w) return false;
      if (p.vy > 0 && p.y >= this.surfaceAt(p.x)) {
        this.splash(p.x, 0.15, 1); // each droplet lands with a tiny ripple
        return false;
      }
      return true;
    });
  }

  private stepBubbles() {
    if (this.bubbles.length < MAX_BUBBLES && this.rand() < 0.04) {
      this.bubbles.push({
        x: 4 + this.rand() * (this.w - 8),
        y: this.h - 2,
        vx: 0,
        vy: -(0.12 + this.rand() * 0.18),
      });
    }
    this.bubbles = this.bubbles.filter((b) => {
      b.y += b.vy;
      b.x += Math.sin(b.y * 0.25) * 0.15; // wobble on the way up
      if (b.y <= this.surfaceAt(b.x) + 1) {
        this.splash(b.x, -0.25, 1); // pop
        return false;
      }
      return true;
    });
  }

  /** Where a new duck can drop without landing on another one. */
  private freeX(): number {
    const r = DUCK_RADIUS;
    let x = this.w / 2;
    for (let tries = 0; tries < 20; tries++) {
      x = r * 2 + this.rand() * (this.w - r * 4);
      if (this.ducks.every((d) => Math.abs(d.x - x) > r * 3)) break;
    }
    return x;
  }
}
