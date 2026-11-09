import { describe, expect, it } from 'vitest';
import { DUCK_RADIUS, Pond } from './pondPhysics';

/** Deterministic randomness, so the ducks paddle the same way every run. */
const seeded =
  (seed = 1) =>
  () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

const energy = (pond: Pond) => {
  let sum = 0;
  for (let y = 0; y < pond.h; y++)
    for (let x = 0; x < pond.w; x++) sum += Math.abs(pond.height(x, y));
  return sum;
};

describe('Pond', () => {
  it('ripples spread from a splash and then calm down', () => {
    const pond = new Pond(60, 40, seeded());
    pond.disturb(30, 20, 10, 3);
    for (let i = 0; i < 6; i++) pond.step();
    expect(Math.abs(pond.height(38, 20))).toBeGreaterThan(0.01); // the ring reached here
    const early = energy(pond);
    for (let i = 0; i < 600; i++) pond.step();
    expect(energy(pond)).toBeLessThan(early / 10);
  });

  it('adds a duck per participant and removes the ones that left', () => {
    const pond = new Pond(120, 60, seeded());
    pond.sync([
      { id: 'a', kind: 'user', self: true },
      { id: 'b', kind: 'agent', self: false },
    ]);
    expect(pond.ducks.map((d) => d.id)).toEqual(['a', 'b']);
    pond.sync([{ id: 'b', kind: 'agent', self: false }]);
    expect(pond.ducks.map((d) => d.id)).toEqual(['b']);
  });

  it('ducks bump into each other instead of overlapping', () => {
    const pond = new Pond(120, 60, seeded());
    pond.sync([
      { id: 'a', kind: 'user', self: false },
      { id: 'b', kind: 'user', self: false },
    ]);
    const [a, b] = pond.ducks as [(typeof pond.ducks)[0], (typeof pond.ducks)[0]];
    Object.assign(a, { x: 40, y: 30, vx: 1, vy: 0 });
    Object.assign(b, { x: 60, y: 30, vx: -1, vy: 0 });
    for (let i = 0; i < 40; i++) pond.step();
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(DUCK_RADIUS * 2 - 0.5);
    expect(a.vx).toBeLessThan(0); // bounced back
    expect(b.vx).toBeGreaterThan(0);
  });

  it('keeps ducks inside the tub', () => {
    const pond = new Pond(80, 40, seeded());
    pond.sync([{ id: 'a', kind: 'user', self: false }]);
    const duck = pond.ducks[0]!;
    Object.assign(duck, { x: 70, y: 20, vx: 2, vy: 0 });
    for (let i = 0; i < 30; i++) pond.step();
    expect(duck.x).toBeLessThanOrEqual(80 - DUCK_RADIUS);
  });

  it('waves push a floating duck away from the splash', () => {
    const pond = new Pond(120, 60, () => 0.5); // 0.5: no random paddle turn
    pond.sync([{ id: 'a', kind: 'user', self: false }]);
    const duck = pond.ducks[0]!;
    Object.assign(duck, { x: 60, y: 30, vx: 0, vy: 0, heading: Math.PI / 2 });
    pond.disturb(54, 30, 20, 4);
    for (let i = 0; i < 20; i++) pond.step();
    expect(duck.x).toBeGreaterThan(60);
  });
});
