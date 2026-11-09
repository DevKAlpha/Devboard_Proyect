/**
 * Pixel-art cursor sprites, drawn as text grids so they are easy to edit.
 *
 * Legend: `o` outline · `w` fill · `a` accent fill · `.` transparent.
 * Each grid cell is rendered as SCALE×SCALE screen pixels. Horizontal runs of
 * the same color are merged into one <rect>, which keeps the SVG tiny.
 */
import type { CursorVariant } from './resolveCursor';

export type SpriteName = Exclude<CursorVariant, 'text' | 'none'> | 'grabbing';

/** Screen pixels per sprite pixel. Integer on purpose: crisp edges, no blur. */
export const SCALE = 2;

interface Sprite {
  grid: readonly string[];
  /** Hotspot in grid cells: the point that sits exactly under the real pointer. */
  hotspot: readonly [number, number];
}

export const SPRITES: Record<SpriteName, Sprite> = {
  default: {
    hotspot: [0, 0],
    grid: [
      'o.........',
      'oo........',
      'owo.......',
      'owwo......',
      'owwwo.....',
      'owwwwo....',
      'owwwwwo...',
      'owwwwwwo..',
      'owwwwwwwo.',
      'owwwwoooo.',
      'owwowo....',
      'owo.owo...',
      'oo..owo...',
      'o....owo..',
      '.....owo..',
      '......o...',
    ],
  },
  pointer: {
    hotspot: [3, 0],
    grid: [
      '...oo......',
      '..owwo.....',
      '..owwo.....',
      '..owwooo...',
      '..owwowwoo.',
      'ooowwowwowo',
      'owwwwwwwwwo',
      'owwwwwwwwwo',
      '.owwwwwwwwo',
      '.owwwwwwwo.',
      '..owwwwwwo.',
      '..owwwwwwo.',
      '..oooooooo.',
    ],
  },
  grab: {
    hotspot: [6, 6],
    grid: [
      '..oo.oo.oo..',
      '.owwowwowwo.',
      '.owwowwowwoo',
      '.owwwwwwwwwo',
      'oowwwwwwwwwo',
      'owowwwwwwwwo',
      'owwwwwwwwwwo',
      '.owwwwwwwwwo',
      '.owwwwwwwwo.',
      '..owwwwwwwo.',
      '..owwwwwwwo.',
      '..ooooooooo.',
    ],
  },
  // Closed fist, filled with the accent color: "you are holding something".
  grabbing: {
    hotspot: [6, 6],
    grid: [
      '............',
      '............',
      '............',
      '..oooooooo..',
      '.oaaoaaoaao.',
      'ooaaaaaaaaao',
      'oaoaaaaaaaao',
      'oaaaaaaaaaao',
      '.oaaaaaaaaao',
      '.oaaaaaaaao.',
      '..oaaaaaaao.',
      '..ooooooooo.',
    ],
  },
};

const FILL: Record<string, string> = {
  o: 'var(--cursor-outline)',
  w: 'var(--cursor-fill)',
  a: 'var(--accent)',
};

/** Merges horizontal runs into [x, y, width, color] tuples. */
const toRuns = (grid: readonly string[]) =>
  grid.flatMap((row, y) => {
    const runs: Array<[number, number, number, string]> = [];
    for (let x = 0; x < row.length;) {
      const ch = row[x]!;
      let end = x + 1;
      while (row[end] === ch) end++;
      if (FILL[ch]) runs.push([x, y, end - x, FILL[ch]]);
      x = end;
    }
    return runs;
  });

export const RUNS = Object.fromEntries(
  Object.entries(SPRITES).map(([name, s]) => [name, toRuns(s.grid)]),
) as Record<SpriteName, ReturnType<typeof toRuns>>;
