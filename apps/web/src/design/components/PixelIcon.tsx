/**
 * 16×16 pixel icons drawn with rects (crisp at any size, no icon font).
 * Each icon is a list of [x, y, width, height] in grid units.
 */
import type { SVGProps } from 'react';

type Rect = readonly [number, number, number, number];

const ICONS = {
  plus: [
    [7, 2, 2, 12],
    [2, 7, 12, 2],
  ],
  close: [
    [3, 3, 2, 2],
    [5, 5, 2, 2],
    [7, 7, 2, 2],
    [9, 9, 2, 2],
    [11, 11, 2, 2],
    [11, 3, 2, 2],
    [9, 5, 2, 2],
    [5, 9, 2, 2],
    [3, 11, 2, 2],
  ],
  trash: [
    [2, 3, 12, 2],
    [6, 1, 4, 2],
    [3, 5, 2, 9],
    [11, 5, 2, 9],
    [3, 13, 10, 2],
    [7, 6, 2, 6],
  ],
  edit: [
    [11, 2, 3, 3],
    [9, 4, 3, 3],
    [7, 6, 3, 3],
    [5, 8, 3, 3],
    [3, 10, 3, 3],
    [2, 13, 3, 1],
  ],
  grip: [
    [5, 3, 2, 2],
    [9, 3, 2, 2],
    [5, 7, 2, 2],
    [9, 7, 2, 2],
    [5, 11, 2, 2],
    [9, 11, 2, 2],
  ],
  sun: [
    [6, 6, 4, 4],
    [7, 1, 2, 3],
    [7, 12, 2, 3],
    [1, 7, 3, 2],
    [12, 7, 3, 2],
    [3, 3, 2, 2],
    [11, 3, 2, 2],
    [3, 11, 2, 2],
    [11, 11, 2, 2],
  ],
  moon: [
    [6, 2, 4, 2],
    [4, 4, 2, 2],
    [3, 6, 2, 4],
    [4, 10, 2, 2],
    [6, 12, 4, 2],
    [10, 10, 3, 2],
    [8, 4, 2, 6],
  ],
  board: [
    [1, 2, 14, 2],
    [1, 4, 2, 10],
    [13, 4, 2, 10],
    [1, 13, 14, 2],
    [6, 4, 1, 9],
    [9, 4, 1, 9],
  ],
  check: [
    [2, 8, 2, 2],
    [4, 10, 2, 2],
    [6, 12, 2, 2],
    [8, 10, 2, 2],
    [10, 8, 2, 2],
    [12, 6, 2, 2],
    [14, 4, 1, 2],
  ],
  calendar: [
    [2, 3, 12, 2],
    [2, 5, 2, 9],
    [12, 5, 2, 9],
    [2, 13, 12, 1],
    [4, 1, 2, 3],
    [10, 1, 2, 3],
    [5, 8, 2, 2],
    [9, 8, 2, 2],
  ],
} satisfies Record<string, readonly Rect[]>;

export type IconName = keyof typeof ICONS;

export interface PixelIconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  /** Rendered size in px. Use multiples of 16 for perfectly crisp pixels. */
  size?: number;
  /** Accessible label. Omit for decorative icons (then aria-hidden). */
  label?: string;
}

export function PixelIcon({ name, size = 16, label, ...rest }: PixelIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="currentColor"
      shapeRendering="crispEdges"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...rest}
    >
      {ICONS[name].map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} />
      ))}
    </svg>
  );
}
