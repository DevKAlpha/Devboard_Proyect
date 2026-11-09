import { duckRects } from '../duck';

const RECTS = duckRects();

/** The pixel rubber duck (see design/duck.ts). Decorative unless `label` is given. */
export function PixelDuck({ size = 16, label }: { size?: number; label?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {RECTS.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}
