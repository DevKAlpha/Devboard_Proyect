/**
 * Card "mood": a visual language for how work is flowing (Lean: make flow visible).
 *
 *  - frozen  card is in an icebox column: parked on purpose, frosted look.
 *  - hot     moved between columns several times recently: flames.
 *  - stale   untouched in the same column for days: cobwebs (stale2 = longer).
 *
 * Pure function of the card, its column and "now", so it is easy to test and
 * cheap to compute on every render.
 */
import type { Card, Column } from '@devbord/shared';

export type CardMood = 'frozen' | 'hot' | 'stale' | 'stale2' | null;

const DAY = 24 * 60 * 60 * 1000;
/** Cobwebs start after a week without changing column, and grow after two. */
export const STALE_AFTER = 7 * DAY;
export const VERY_STALE_AFTER = 14 * DAY;
/** "Hot": at least this many column changes inside the window. */
export const HOT_MOVES = 3;
export const HOT_WINDOW = 2 * DAY;

/** Column names (any language we ship) that mean "parked". */
const ICEBOX = /ice ?box|congelad|nevera|frozen|parking|en pausa|algún día|someday/i;

export const isIceboxColumn = (column: Pick<Column, 'title'>) => ICEBOX.test(column.title);

export function cardMood(
  card: Pick<Card, 'createdAt' | 'movedAt' | 'moveLog'>,
  column: Pick<Column, 'title'>,
  /** Last column of the board (Done): finished work never gathers cobwebs. */
  isLastColumn: boolean,
  now = Date.now(),
): CardMood {
  if (isIceboxColumn(column)) return 'frozen';

  const recentMoves = card.moveLog.filter((at) => now - Date.parse(at) <= HOT_WINDOW).length;
  if (recentMoves >= HOT_MOVES) return 'hot';

  if (isLastColumn) return null;
  const idle = now - Date.parse(card.movedAt ?? card.createdAt);
  if (idle >= VERY_STALE_AFTER) return 'stale2';
  if (idle >= STALE_AFTER) return 'stale';
  return null;
}

/** Accessible description of the mood (title tooltip + screen readers). */
export function describeMood(
  mood: CardMood,
  card: Pick<Card, 'createdAt' | 'movedAt'>,
  now = Date.now(),
) {
  if (!mood) return null;
  if (mood === 'frozen') return 'Congelada: aparcada en el Icebox';
  if (mood === 'hot') return 'Caliente: se ha movido mucho estos días';
  const days = Math.floor((now - Date.parse(card.movedAt ?? card.createdAt)) / DAY);
  return `Sin avanzar desde hace ${days} días`;
}
