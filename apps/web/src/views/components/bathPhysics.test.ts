import { describe, expect, it } from 'vitest';
import { Bath, DUCK_RADIUS } from './bathPhysics';

/** Deterministic randomness, so the ducks paddle the same way every run. */
const seeded =
  (seed = 1) =>
  () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

const run = (bath: Bath, steps: number) => {
  for (let i = 0; i < steps; i++) bath.step();
};

const roughness = (bath: Bath) => {
  let sum = 0;
  for (let x = 0; x < bath.w; x++) sum += Math.abs(bath.surfaceAt(x) - bath.level);
  return sum;
};

describe('Bath', () => {
  it('a splash travels along the surface as a wave and then calms down', () => {
    const bath = new Bath(200, 100, 0.6, seeded());
    bath.splash(100, 4, 3);
    run(bath, 15);
    expect(Math.abs(bath.surfaceAt(112) - bath.level)).toBeGreaterThan(0.01);
    const early = roughness(bath);
    run(bath, 900);
    expect(roughness(bath)).toBeLessThan(early / 10);
  });

  it('new ducks drop in from above and end up floating at the surface', () => {
    const bath = new Bath(200, 100, 0.6, seeded());
    bath.sync([{ id: 'a', kind: 'user', self: true }]);
    const duck = bath.ducks[0]!;
    expect(duck.y).toBeLessThan(bath.level);
    run(bath, 600);
    expect(Math.abs(duck.y - bath.surfaceAt(duck.x))).toBeLessThan(4);
  });

  it('removes the ducks of people who left', () => {
    const bath = new Bath(200, 100, 0.6, seeded());
    bath.sync([
      { id: 'a', kind: 'user', self: true },
      { id: 'b', kind: 'agent', self: false },
    ]);
    bath.sync([{ id: 'b', kind: 'agent', self: false }]);
    expect(bath.ducks.map((d) => d.id)).toEqual(['b']);
  });

  it('floating ducks bump into each other instead of overlapping', () => {
    const bath = new Bath(200, 100, 0.6, seeded());
    bath.sync([
      { id: 'a', kind: 'user', self: false },
      { id: 'b', kind: 'user', self: false },
    ]);
    const [a, b] = bath.ducks as [(typeof bath.ducks)[0], (typeof bath.ducks)[0]];
    Object.assign(a, { x: 80, y: bath.level + 1, vx: 1, vy: 0 });
    Object.assign(b, { x: 110, y: bath.level + 1, vx: -1, vy: 0 });
    run(bath, 40);
    expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(DUCK_RADIUS * 2 - 1);
    expect(a.vx).toBeLessThan(0.5); // pushed back
    expect(b.vx).toBeGreaterThan(-0.5);
  });

  it('a duck thrown into the water splashes droplets and makes waves', () => {
    const bath = new Bath(200, 100, 0.6, seeded());
    bath.sync([{ id: 'a', kind: 'user', self: false }]);
    const duck = bath.ducks[0]!;
    Object.assign(duck, { x: 100, y: bath.level - 20, vx: 0, vy: 2.5 });
    let sprayed = false;
    for (let i = 0; i < 30; i++) {
      bath.step();
      sprayed ||= bath.drops.length > 0;
    }
    expect(sprayed).toBe(true);
    expect(roughness(bath)).toBeGreaterThan(1);
  });

  it('keeps ducks inside the tub', () => {
    const bath = new Bath(120, 80, 0.6, seeded());
    bath.sync([{ id: 'a', kind: 'user', self: false }]);
    const duck = bath.ducks[0]!;
    Object.assign(duck, { x: 110, y: bath.level, vx: 3, vy: 0 });
    run(bath, 30);
    expect(duck.x).toBeLessThanOrEqual(120 - DUCK_RADIUS);
  });
});
