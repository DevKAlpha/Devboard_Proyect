/**
 * The board's "Recorrido" (journey) in numbers: how cards travelled between
 * columns, from each card's trail (see cardTrail in @devbord/shared). Pure, so
 * the diagram (JourneyModal) only draws what this returns.
 */
import { cardTrail, type Board, type Card } from '@devbord/shared';

/** Cards that went from column `from` to column `to` (indexes in board order). */
export interface Transition {
  from: number;
  to: number;
  count: number;
}

export interface JourneyStop {
  /** Column index in the board, or -1 if that column was deleted. */
  column: number;
  /** When the card entered it. */
  at: string;
  /** Time spent there (ms), or null for the column it is in now. */
  stayed: number | null;
  /** True when the card came back to an earlier column. */
  backward: boolean;
}

export interface JourneyRow {
  card: Card;
  stops: JourneyStop[];
  /** When it last changed column (sort key: most recent first). */
  lastAt: string;
}

export interface Journey {
  transitions: Transition[];
  /** Column changes in total, and how many went backwards. */
  moves: number;
  backward: number;
  /** Cards that changed column at least once, most recently moved first. */
  rows: JourneyRow[];
  /** Cards that never left the column they started in. */
  still: number;
}

export function boardJourney(board: Board): Journey {
  const index = new Map(board.columns.map((c, i) => [c.id, i]));
  const pairs = new Map<string, Transition>();
  const rows: JourneyRow[] = [];
  let moves = 0;
  let backward = 0;
  let still = 0;

  for (const column of board.columns) {
    for (const card of column.cards) {
      const trail = cardTrail(card, column.id);
      if (trail.length < 2) {
        still++;
        continue;
      }
      const stops = trail.map((step, i): JourneyStop => {
        const col = index.get(step.columnId) ?? -1;
        const prev = i > 0 ? (index.get(trail[i - 1]!.columnId) ?? -1) : -1;
        const next = trail[i + 1];
        return {
          column: col,
          at: step.at,
          stayed: next ? Date.parse(next.at) - Date.parse(step.at) : null,
          backward: i > 0 && col !== -1 && prev !== -1 && col < prev,
        };
      });
      for (let i = 1; i < stops.length; i++) {
        const a = stops[i - 1]!.column;
        const b = stops[i]!.column;
        moves++;
        if (stops[i]!.backward) backward++;
        if (a === -1 || b === -1 || a === b) continue; // deleted columns are not drawn
        const key = `${a}>${b}`;
        const t = pairs.get(key) ?? { from: a, to: b, count: 0 };
        t.count++;
        pairs.set(key, t);
      }
      rows.push({ card, stops, lastAt: trail.at(-1)!.at });
    }
  }

  rows.sort((x, y) => y.lastAt.localeCompare(x.lastAt));
  return { transitions: [...pairs.values()], moves, backward, rows, still };
}

/** "3 min", "5 h", "2 d": how long a card stayed in a column. */
export function formatStay(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 60) return `${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}
