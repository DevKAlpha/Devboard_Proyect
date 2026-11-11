/**
 * "Recorrido": how the board's cards have travelled between columns.
 *
 * Top: a pixel flow diagram. Columns are stations on a line; each bracket
 * joins two columns with the number of cards that went that way: forward
 * moves above the line (accent), moves back below it (red). Below: every card
 * that moved, with the stops of its journey and how long it stayed in each.
 */
import { useMemo } from 'react';
import type { Board } from '@devbord/shared';
import { Modal } from '../../design';
import { KIND_COLOR, columnKind } from './columnKind';
import { boardJourney, formatStay, type Transition } from './journey';

/** Width of one station in the diagram (px). */
const STATION = 120;
/** Vertical gap between stacked brackets (px). */
const LANE = 10;
/** Cards listed below the diagram; the rest is summarized. */
const MAX_ROWS = 40;

const dateFmt = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** Ring color of a column, the same one its header shows. */
const columnColor = (board: Board, i: number) => {
  const col = board.columns[i];
  if (!col) return 'var(--faint)';
  const kind = columnKind(col.title, i === board.columns.length - 1);
  return `var(--label-${KIND_COLOR[kind]}-ink)`;
};

/** Short spans get the lanes nearest the line, so brackets nest instead of crossing. */
const byLane = (list: Transition[]) =>
  [...list].sort((a, b) => Math.abs(a.to - a.from) - Math.abs(b.to - b.from) || a.from - b.from);

function FlowDiagram({ board, transitions }: { board: Board; transitions: Transition[] }) {
  const n = board.columns.length;
  const forward = byLane(transitions.filter((t) => t.to > t.from));
  const back = byLane(transitions.filter((t) => t.to < t.from));
  const top = 30; // column titles
  const line = top + 18 + forward.length * LANE;
  const height = line + 18 + back.length * LANE + 8;
  const width = n * STATION;
  const cx = (i: number) => i * STATION + STATION / 2;
  const max = Math.max(1, ...transitions.map((t) => t.count));
  const thickness = (count: number) => 2 + Math.round((count / max) * 3);

  const bracket = (t: Transition, lane: number, up: boolean) => {
    const dir = up ? -1 : 1;
    // Start and end a little apart from the station so arrows stay readable.
    const x1 = cx(t.from) + (up ? 4 : -4);
    const x2 = cx(t.to) + (up ? -4 : 4);
    const y = line + dir * (14 + lane * LANE);
    const y0 = line + dir * 7;
    const color = up ? 'var(--accent)' : 'var(--label-red-ink)';
    const w = thickness(t.count);
    return (
      <g key={`${t.from}>${t.to}`}>
        <path
          d={`M${x1} ${y0} V${y} H${x2} V${y0}`}
          fill="none"
          stroke={color}
          strokeWidth={w}
          strokeLinejoin="miter"
        />
        {/* Pixel arrowhead pointing at the destination station. */}
        <rect x={x2 - 4} y={up ? y0 - 5 : y0 + 3} width={8} height={2} fill={color} />
        <rect x={x2 - 2} y={up ? y0 - 3 : y0 + 1} width={4} height={2} fill={color} />
        <rect x={x2 - 1} y={up ? y0 - 1 : y0 - 1} width={2} height={2} fill={color} />
        <text
          x={(x1 + x2) / 2}
          y={y + (up ? -6 : 14)}
          textAnchor="middle"
          className="fill-ink font-pixel text-[11px]"
        >
          {t.count}
        </text>
      </g>
    );
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-line-soft bg-surface-2 p-2">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Diagrama de movimientos entre columnas"
        shapeRendering="crispEdges"
        className="block"
      >
        {board.columns.map((col, i) => (
          <g key={col.id}>
            <text x={cx(i)} y={14} textAnchor="middle" className="fill-ink font-pixel text-[12px]">
              {col.title.length > 14 ? col.title.slice(0, 13) + '…' : col.title}
            </text>
            <text x={cx(i)} y={27} textAnchor="middle" className="fill-faint text-[10px]">
              {col.cards.length} {col.cards.length === 1 ? 'tarjeta' : 'tarjetas'}
            </text>
          </g>
        ))}
        {/* The line through every station. */}
        <rect x={cx(0)} y={line - 1} width={cx(n - 1) - cx(0)} height={2} fill="var(--line)" />
        {forward.map((t, lane) => bracket(t, lane, true))}
        {back.map((t, lane) => bracket(t, lane, false))}
        {board.columns.map((col, i) => (
          <rect
            key={col.id}
            x={cx(i) - 6}
            y={line - 6}
            width={12}
            height={12}
            fill={columnColor(board, i)}
            stroke="var(--surface-2)"
            strokeWidth={2}
          />
        ))}
      </svg>
    </div>
  );
}

export function JourneyModal({
  board,
  open,
  onClose,
}: {
  board: Board;
  open: boolean;
  onClose: () => void;
}) {
  const journey = useMemo(() => (open ? boardJourney(board) : null), [board, open]);

  return (
    <Modal open={open} title="Recorrido de las tarjetas" onClose={onClose} size="lg">
      {journey && (
        <div className="flex min-w-0 flex-col gap-4">
          <p className="text-sm text-muted">
            <span className="text-ink tabular-nums">{journey.moves}</span>{' '}
            {journey.moves === 1 ? 'cambio de columna' : 'cambios de columna'}
            {journey.backward > 0 && (
              <>
                {' · '}
                <span className="text-[var(--label-red-ink)] tabular-nums">
                  {journey.backward}
                </span>{' '}
                {journey.backward === 1 ? 'vuelta atrás' : 'vueltas atrás'}
              </>
            )}
            {' · '}
            <span className="tabular-nums">{journey.still}</span> sin moverse todavía
          </p>

          {journey.moves === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
              Aún no hay recorridos. Mueve una tarjeta de columna y aparecerá aquí.
            </p>
          ) : (
            <>
              <FlowDiagram board={board} transitions={journey.transitions} />
              <p className="-mt-2 text-xs text-faint">
                Arriba, lo que avanzó; abajo, lo que volvió atrás. Cuanto más grueso, más tarjetas.
              </p>
              <ol className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto pr-1">
                {journey.rows.slice(0, MAX_ROWS).map(({ card, stops }) => (
                  <li
                    key={card.id}
                    className="rounded-lg border border-line-soft bg-card p-2.5 text-sm"
                  >
                    <p className="mb-1.5 font-semibold break-words">
                      {card.number !== null && (
                        <span className="mr-1.5 text-faint">#{card.number}</span>
                      )}
                      {card.title}
                    </p>
                    <ol className="flex flex-wrap items-center gap-x-1 gap-y-1.5 text-xs">
                      {stops.map((stop, i) => (
                        <li key={i} className="flex items-center gap-1">
                          {i > 0 && (
                            <span
                              aria-label={stop.backward ? 'vuelve a' : 'pasa a'}
                              className={
                                stop.backward ? 'text-[var(--label-red-ink)]' : 'text-faint'
                              }
                            >
                              {stop.backward ? '↩' : '→'}
                            </span>
                          )}
                          <span
                            // Pixel tooltip from the cursor (native titles use the system font).
                            data-cursor-hint={`Entró el ${dateFmt.format(new Date(stop.at))}`}
                            className="inline-flex items-center gap-1 rounded-md border border-line-soft px-1.5 py-0.5"
                          >
                            <span
                              aria-hidden
                              className="size-2"
                              style={{ background: columnColor(board, stop.column) }}
                            />
                            {board.columns[stop.column]?.title ?? 'Columna eliminada'}
                            <span className="text-faint">
                              {stop.stayed === null ? 'ahora' : formatStay(stop.stayed)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ol>
              {journey.rows.length > MAX_ROWS && (
                <p className="text-xs text-faint">
                  Y {journey.rows.length - MAX_ROWS} tarjetas más con recorrido.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
