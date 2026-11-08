import { describe, expect, it } from 'vitest';
import {
  addCard,
  addColumn,
  createBoard,
  createCard,
  findCard,
  moveCard,
  moveColumn,
  removeCard,
  removeColumn,
  updateCard,
} from './board-ops';
import { BoardSchema } from './schemas';

const seed = () => {
  let board = createBoard({ name: 'Test', profile: 'technical', columnTitles: ['A', 'B'] });
  const [a, b] = board.columns as [(typeof board.columns)[0], (typeof board.columns)[0]];
  const c1 = createCard('one');
  const c2 = createCard('two');
  board = addCard(board, a.id, c1);
  board = addCard(board, a.id, c2);
  return { board, a, b, c1, c2 };
};

describe('board-ops', () => {
  it('creates a board that passes schema validation', () => {
    const { board } = seed();
    expect(BoardSchema.safeParse(board).success).toBe(true);
  });

  it('never mutates the input board', () => {
    const { board, a } = seed();
    const snapshot = JSON.parse(JSON.stringify(board)) as typeof board;
    addColumn(board, 'C');
    addCard(board, a.id, createCard('x'));
    expect(board).toEqual(snapshot);
  });

  it('moves a card across columns', () => {
    const { board, b, c1 } = seed();
    const next = moveCard(board, c1.id, b.id, 0);
    expect(findCard(next, c1.id)?.column.id).toBe(b.id);
    expect(next.columns[0]!.cards.map((c) => c.title)).toEqual(['two']);
  });

  it('reorders a card within its column', () => {
    const { board, a, c1 } = seed();
    const next = moveCard(board, c1.id, a.id, 1);
    expect(next.columns[0]!.cards.map((c) => c.title)).toEqual(['two', 'one']);
  });

  it('treats unknown ids as a no-op', () => {
    const { board } = seed();
    expect(moveCard(board, 'nope', 'nope', 0)).toBe(board);
    expect(removeColumn(board, 'nope')).toBe(board);
    expect(updateCard(board, 'nope', { title: 'x' })).toBe(board);
  });

  it('updates and removes cards', () => {
    const { board, c1 } = seed();
    const updated = updateCard(board, c1.id, { title: 'renamed', priority: 'high' });
    expect(findCard(updated, c1.id)?.card).toMatchObject({ title: 'renamed', priority: 'high' });
    expect(findCard(removeCard(updated, c1.id), c1.id)).toBeNull();
  });

  it('moves columns and clamps out-of-range indexes', () => {
    const { board, a } = seed();
    expect(moveColumn(board, a.id, 99).columns.at(-1)!.id).toBe(a.id);
  });
});
