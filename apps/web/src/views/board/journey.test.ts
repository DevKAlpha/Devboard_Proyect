import { describe, expect, it } from 'vitest';
import { addCard, createBoard, createCard, findCard, moveCard } from '@devbord/shared';
import { boardJourney, formatStay } from './journey';

describe('boardJourney', () => {
  it('counts moves per pair of columns, forward and back', () => {
    let board = createBoard({ name: 'B', profile: 'technical', columnTitles: ['A', 'B', 'C'] });
    const [a, b, c] = board.columns.map((col) => col.id) as [string, string, string];
    const one = createCard('Uno');
    const two = createCard('Dos');
    board = addCard(addCard(addCard(board, a, one), a, two), a, createCard('Quieta'));
    board = moveCard(board, one.id, b, 0);
    board = moveCard(board, one.id, c, 0);
    board = moveCard(board, one.id, b, 0); // back
    board = moveCard(board, two.id, b, 0);

    const j = boardJourney(board);
    expect(j.moves).toBe(4);
    expect(j.backward).toBe(1);
    expect(j.still).toBe(1);
    const count = (from: number, to: number) =>
      j.transitions.find((t) => t.from === from && t.to === to)?.count;
    expect(count(0, 1)).toBe(2);
    expect(count(1, 2)).toBe(1);
    expect(count(2, 1)).toBe(1);
    const row = j.rows.find((r) => r.card.id === one.id)!;
    expect(row.stops.map((s) => s.column)).toEqual([0, 1, 2, 1]);
    expect(row.stops.at(-1)!.stayed).toBeNull();
    expect(findCard(board, one.id)!.column.id).toBe(b);
  });

  it('formats stays in minutes, hours and days', () => {
    expect(formatStay(20_000)).toBe('1 min');
    expect(formatStay(3 * 3_600_000)).toBe('3 h');
    expect(formatStay(50 * 3_600_000)).toBe('2 d');
  });
});
