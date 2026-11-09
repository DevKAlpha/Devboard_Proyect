import { describe, expect, it } from 'vitest';
import type { Stroke } from '../../controllers/sketchController';
import { constrainEnd, hitsStroke, outline, smoothTowards } from './geometry';

const stroke = (tool: Stroke['tool'], points: number[], size = 4): Stroke => ({
  id: 's',
  tool,
  color: 'ink',
  size,
  points,
});

describe('sketch geometry', () => {
  it('smooths toward the pointer without overshooting', () => {
    expect(smoothTowards({ x: 0, y: 0 }, { x: 10, y: 0 }, 0)).toEqual({ x: 10, y: 0 });
    expect(smoothTowards({ x: 0, y: 0 }, { x: 10, y: 0 }, 0.5)).toEqual({ x: 5, y: 0 });
  });

  it('constrains shapes with Shift: squares and 45° arrows', () => {
    expect(constrainEnd('rect', 0, 0, 30, -10)).toEqual({ x: 30, y: -30 });
    const end = constrainEnd('arrow', 0, 0, 100, 8);
    expect(end.x).toBeCloseTo(Math.hypot(100, 8));
    expect(end.y).toBeCloseTo(0);
  });

  it('hits a freehand line near its ink only', () => {
    const line = stroke('pen', [0, 0, 100, 0]);
    expect(hitsStroke(line, 50, 10, 8)).toBe(true);
    expect(hitsStroke(line, 50, 30, 8)).toBe(false);
  });

  it('hits a rectangle on its border, not in its empty middle', () => {
    const rect = stroke('rect', [0, 0, 200, 100]);
    expect(hitsStroke(rect, 200, 50, 5)).toBe(true);
    expect(hitsStroke(rect, 100, 50, 5)).toBe(false);
  });

  it('samples an ellipse outline', () => {
    const pts = outline(stroke('ellipse', [0, 0, 100, 50]));
    expect(pts.length).toBeGreaterThan(40);
    expect(pts[0]).toBeCloseTo(100);
    expect(pts[1]).toBeCloseTo(25);
  });

  it('counts the wider marker ink', () => {
    const marker = stroke('marker', [0, 0, 100, 0], 6);
    expect(hitsStroke(marker, 50, 10, 2)).toBe(true);
  });
});
