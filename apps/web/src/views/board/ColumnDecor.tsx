/**
 * Column decorations: a GitHub-style status ring and an animated pixel sprite
 * per column kind (sparkle, snowflake + snowfall, box stack, flag, gear,
 * magnifier, trophy). Sprites are tiny grids rendered once as SVG <rect>s;
 * motion is CSS (transform/opacity, steps()) and stops in lite mode.
 */
import { memo, type ReactElement } from 'react';
import { KIND_COLOR, type ColumnKind } from './columnKind';
import './columns.css';

type Palette = Record<string, string>;

/** Merges horizontal runs of the same color into one rect (fewer DOM nodes). */
function Sprite({
  grid,
  palette,
  size = 2,
}: {
  grid: readonly string[];
  palette: Palette;
  size?: number;
}) {
  const w = Math.max(...grid.map((r) => r.length));
  const rects: ReactElement[] = [];
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const ch = row[x]!;
      let end = x + 1;
      while (row[end] === ch) end++;
      const fill = palette[ch];
      if (fill)
        rects.push(<rect key={`${x},${y}`} x={x} y={y} width={end - x} height={1} fill={fill} />);
      x = end;
    }
  });
  return (
    <svg
      width={w * size}
      height={grid.length * size}
      viewBox={`0 0 ${w} ${grid.length}`}
      shapeRendering="crispEdges"
    >
      {rects}
    </svg>
  );
}

const RING = ['..ccc..', '.c...c.', 'c.....c', 'c.....c', 'c.....c', '.c...c.', '..ccc..'];

/** GitHub Projects-style status circle, in the column's kind color. */
export function StatusRing({ kind }: { kind: ColumnKind }) {
  return (
    <span className="col-ring" aria-hidden>
      <Sprite grid={RING} palette={{ c: `var(--label-${KIND_COLOR[kind]}-ink)` }} />
    </span>
  );
}

const SPRITES: Partial<Record<ColumnKind, { grid: string[]; palette: Palette; alt?: string[] }>> = {
  new: {
    grid: ['...y...', '...y...', '..yYy..', 'yyYWYyy', '..yYy..', '...y...', '...y...'],
    palette: { y: '#f5b82e', Y: '#ffe08a', W: '#ffffff' },
  },
  icebox: {
    grid: ['b..b..b', '.b.b.b.', '..bbb..', 'bbbWbbb', '..bbb..', '.b.b.b.', 'b..b..b'],
    palette: { b: '#5aaef0', W: '#ffffff' },
  },
  backlog: {
    grid: ['.rrrrr.', '.rRRRr.', '.rrrrr.', 'rrrrrrr', 'rRRRRRr', 'rRRRRRr', 'rrrrrrr'],
    palette: { r: '#d0577a', R: '#f4a6bd' },
  },
  sprint: {
    grid: ['pFFFF..', 'pFFFFF.', 'pFFFF..', 'p......', 'p......', 'p......', 'pp.....'],
    alt: ['p.FFF..', 'pFFFFF.', 'pFFFFF.', 'p.FF...', 'p......', 'p......', 'pp.....'],
    palette: { p: '#8a8a91', F: '#e5484d' },
  },
  progress: {
    grid: ['.g.g.g.', 'ggggggg', '.gg.gg.', 'gg...gg', '.gg.gg.', 'ggggggg', '.g.g.g.'],
    palette: { g: '#d29922' },
  },
  review: {
    grid: ['.mmm...', 'm...m..', 'm.W.m..', 'm...m..', '.mmm...', '....mm.', '.....mm'],
    palette: { m: '#8e6bd6', W: '#d9ccff' },
  },
  done: {
    grid: ['ttttttt', 'tTTTTTt', '.tTTTt.', '..tTt..', '...t...', '..ttt..', '.ttttt.'],
    palette: { t: '#e0812e', T: '#ffc46b' },
  },
};

/** Animated sprite for the column header (decorative). */
export const ColumnSprite = memo(function ColumnSprite({ kind }: { kind: ColumnKind }) {
  const sprite = SPRITES[kind];
  if (!sprite) return null;
  return (
    <span className={`col-sprite col-sprite-${kind}`} aria-hidden>
      {sprite.alt ? (
        <>
          <span className="col-frame-a">
            <Sprite grid={sprite.grid} palette={sprite.palette} />
          </span>
          <span className="col-frame-b">
            <Sprite grid={sprite.alt} palette={sprite.palette} />
          </span>
        </>
      ) : (
        <Sprite grid={sprite.grid} palette={sprite.palette} />
      )}
      {kind === 'done' && <span className="col-shine" />}
    </span>
  );
});

/** Slow pixel snowfall inside icebox columns (6 flakes, transform-only). */
export const Snowfall = memo(function Snowfall() {
  return (
    <span className="col-snow" aria-hidden>
      {[8, 23, 41, 57, 72, 88].map((left, i) => (
        <span
          key={left}
          className="col-snow-flake"
          style={{
            left: `${left}%`,
            animationDelay: `${i * -1.3}s`,
            animationDuration: `${7 + (i % 3)}s`,
          }}
        />
      ))}
    </span>
  );
});
