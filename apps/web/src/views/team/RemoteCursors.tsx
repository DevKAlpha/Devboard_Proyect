/**
 * Teammates' cursors over the board, Figma-style: the same pixel arrow as the
 * local cursor, tinted with each person's color and labelled with their name.
 *
 * Positions are in board-content coordinates (scroll included), so a cursor
 * points at the same card for everyone, whatever their scroll position.
 */
import { useCollab } from '../../controllers/collabController';
import { SCALE, SPRITES } from '../cursor/sprites';

const ARROW = SPRITES.default.grid;

export function TintedArrow({ color }: { color: string }) {
  const w = Math.max(...ARROW.map((r) => r.length));
  return (
    <svg
      width={w * SCALE}
      height={ARROW.length * SCALE}
      viewBox={`0 0 ${w} ${ARROW.length}`}
      shapeRendering="crispEdges"
      aria-hidden
    >
      {ARROW.flatMap((row, y) =>
        [...row].map((ch, x) =>
          ch === '.' ? null : (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={1}
              height={1}
              fill={ch === 'o' ? '#141416' : color}
            />
          ),
        ),
      )}
    </svg>
  );
}

export function RemoteCursors() {
  const peers = useCollab((s) => s.peers);
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-visible" aria-hidden>
      {Object.entries(peers).map(([id, p]) =>
        p.cursor ? (
          <div
            key={id}
            className="absolute top-0 left-0 transition-transform duration-75 ease-linear"
            style={{ transform: `translate(${p.cursor.x}px, ${p.cursor.y}px)` }}
          >
            <TintedArrow color={p.color} />
            <span
              className="mt-0.5 ml-3 inline-block rounded-md px-1.5 py-0.5 font-pixel text-[11px] whitespace-nowrap text-white shadow-card"
              style={{ background: p.color }}
            >
              {p.name}
            </span>
          </div>
        ) : null,
      )}
    </div>
  );
}
