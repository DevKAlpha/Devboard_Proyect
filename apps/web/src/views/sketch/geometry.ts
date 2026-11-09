/**
 * Pure whiteboard geometry: input smoothing, shape constraints, eraser hit
 * tests and path tracing. No DOM state, so it is unit-tested directly.
 */
import type { Stroke, StrokeTool } from '../../controllers/sketchController';

/** Freehand tools follow the hand; the rest are shapes defined by two points. */
export const isFreehand = (tool: StrokeTool) => tool === 'pen' || tool === 'marker';

/** Rounds to the stored precision (whole sheet units keep the CRDT small). */
export const snap = (v: number) => Math.round(v);

/**
 * "Lazy brush" smoothing: the ink moves part of the way toward the pointer
 * each sample. It removes mouse jitter without a visible lag. `amount` is
 * 0 (raw) to 1 (very smooth).
 */
export function smoothTowards(
  prev: { x: number; y: number },
  raw: { x: number; y: number },
  amount: number,
) {
  const k = 1 - amount;
  return { x: prev.x + (raw.x - prev.x) * k, y: prev.y + (raw.y - prev.y) * k };
}

/**
 * Shift-constrained shapes: square rects and circles, and arrows snapped to
 * 45° steps. Returns the adjusted end point.
 */
export function constrainEnd(tool: StrokeTool, x0: number, y0: number, x: number, y: number) {
  const dx = x - x0;
  const dy = y - y0;
  if (tool === 'rect' || tool === 'ellipse') {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    return { x: x0 + Math.sign(dx || 1) * side, y: y0 + Math.sign(dy || 1) * side };
  }
  const len = Math.hypot(dx, dy);
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return { x: x0 + Math.cos(angle) * len, y: y0 + Math.sin(angle) * len };
}

/** Polyline that follows the visible stroke (shapes are sampled), for hit tests. */
export function outline(stroke: Stroke): number[] {
  const p = stroke.points;
  if (isFreehand(stroke.tool) || p.length < 4) return [...p];
  const [x0, y0, x1, y1] = p as [number, number, number, number];
  if (stroke.tool === 'rect') return [x0, y0, x1, y0, x1, y1, x0, y1, x0, y0];
  if (stroke.tool === 'ellipse') {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const rx = Math.abs(x1 - x0) / 2;
    const ry = Math.abs(y1 - y0) / 2;
    const out: number[] = [];
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      out.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
    }
    return out;
  }
  return [x0, y0, x1, y1, ...arrowHead(x0, y0, x1, y1, stroke.size)];
}

/** Distance from point P to segment AB. */
function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Width actually painted (the marker is drawn wider than its nominal size). */
export const paintedWidth = (stroke: Stroke) =>
  stroke.tool === 'marker' ? stroke.size * 3 : stroke.size;

/** True when a circle of `radius` at (x, y) touches the stroke's ink. */
export function hitsStroke(stroke: Stroke, x: number, y: number, radius: number): boolean {
  const line = outline(stroke);
  const reach = radius + paintedWidth(stroke) / 2;
  if (line.length === 2) return Math.hypot(x - line[0]!, y - line[1]!) <= reach;
  for (let i = 0; i + 3 < line.length; i += 2) {
    if (segmentDistance(x, y, line[i]!, line[i + 1]!, line[i + 2]!, line[i + 3]!) <= reach)
      return true;
  }
  return false;
}

/** The two barb end points of an arrow ending at (x1, y1). */
export function arrowHead(x0: number, y0: number, x1: number, y1: number, size: number) {
  const angle = Math.atan2(y1 - y0, x1 - x0);
  const len = Math.max(16, size * 4);
  const spread = Math.PI / 7;
  return [
    x1 - Math.cos(angle - spread) * len,
    y1 - Math.sin(angle - spread) * len,
    x1 - Math.cos(angle + spread) * len,
    y1 - Math.sin(angle + spread) * len,
  ];
}

/**
 * Traces the stroke into a canvas path (CanvasRenderingContext2D or Path2D).
 * Freehand strokes use quadratic curves through the midpoints of consecutive
 * samples: the line passes smoothly near every point, with no sharp kinks.
 */
export function tracePath(path: CanvasPath, stroke: Stroke) {
  const p = stroke.points;
  if (p.length < 2) return;
  if (isFreehand(stroke.tool) || p.length < 4) {
    path.moveTo(p[0]!, p[1]!);
    if (p.length === 2) {
      // A single tap still leaves a dot (round caps draw it).
      path.lineTo(p[0]! + 0.01, p[1]!);
      return;
    }
    for (let i = 2; i + 3 < p.length; i += 2) {
      path.quadraticCurveTo(p[i]!, p[i + 1]!, (p[i]! + p[i + 2]!) / 2, (p[i + 1]! + p[i + 3]!) / 2);
    }
    path.lineTo(p[p.length - 2]!, p[p.length - 1]!);
    return;
  }
  const [x0, y0, x1, y1] = p as [number, number, number, number];
  if (stroke.tool === 'rect') {
    path.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
  } else if (stroke.tool === 'ellipse') {
    path.moveTo(Math.max(x0, x1), (y0 + y1) / 2);
    path.ellipse(
      (x0 + x1) / 2,
      (y0 + y1) / 2,
      Math.abs(x1 - x0) / 2,
      Math.abs(y1 - y0) / 2,
      0,
      0,
      Math.PI * 2,
    );
  } else {
    path.moveTo(x0, y0);
    path.lineTo(x1, y1);
    const [ax, ay, bx, by] = arrowHead(x0, y0, x1, y1, stroke.size) as [
      number,
      number,
      number,
      number,
    ];
    path.moveTo(ax, ay);
    path.lineTo(x1, y1);
    path.lineTo(bx, by);
  }
}
