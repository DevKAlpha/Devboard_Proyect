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
  isOverWip,
  setColumnWipLimit,
  copyCardsInto,
} from './board-ops';
import { BoardSchema, CardSchema } from './schemas';

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

describe('agile fields', () => {
  it('parses boards saved before these fields existed (defaults fill the gaps)', () => {
    const legacy = createBoard({ name: 'Old', profile: 'technical', columnTitles: ['A'] });
    const raw = JSON.parse(JSON.stringify(legacy)) as Record<string, unknown>;
    delete raw.cardTemplate;
    for (const c of raw.columns as Record<string, unknown>[]) delete c.wipLimit;
    const parsed = BoardSchema.parse(raw);
    expect(parsed.cardTemplate).toBeNull();
    expect(parsed.columns[0]!.wipLimit).toBeNull();
  });

  it('accepts only Fibonacci story points', () => {
    const card = createCard('x');
    expect(CardSchema.safeParse({ ...card, storyPoints: 5 }).success).toBe(true);
    expect(CardSchema.safeParse({ ...card, storyPoints: 4 }).success).toBe(false);
  });

  it('flags a column over its WIP limit', () => {
    const { board, a } = seed();
    const limited = setColumnWipLimit(board, a.id, 1);
    expect(isOverWip(limited.columns[0]!)).toBe(true);
    expect(isOverWip(setColumnWipLimit(board, a.id, 2).columns[0]!)).toBe(false);
    expect(isOverWip(setColumnWipLimit(board, a.id, null).columns[0]!)).toBe(false);
  });
});

describe('copyCardsInto', () => {
  it('copies cards across boards of any profile, merging labels by name', () => {
    let source = createBoard({
      name: 'Scrum',
      profile: 'technical',
      columnTitles: ['Backlog'],
      labels: [
        { name: 'bug', color: 'red' },
        { name: 'infra', color: 'orange' },
      ],
    });
    const [bug, infra] = source.labels;
    const story = createCard('Login', {
      labelIds: [bug!.id, infra!.id],
      storyPoints: 5,
      type: 'feature',
    });
    source = addCard(source, source.columns[0]!.id, story);

    const target = createBoard({
      name: 'Casa',
      profile: 'simple',
      columnTitles: ['Por hacer'],
      labels: [{ name: 'BUG', color: 'red' }],
    });
    const result = copyCardsInto(target, target.columns[0]!.id, source, [story.id]);

    const copy = result.columns[0]!.cards[0]!;
    expect(copy.id).not.toBe(story.id);
    expect(copy).toMatchObject({ title: 'Login', storyPoints: 5, type: 'feature' });
    // "bug" reuses the existing "BUG" label; "infra" is created on the target.
    expect(result.labels.map((l) => l.name)).toEqual(['BUG', 'infra']);
    expect(copy.labelIds).toEqual(result.labels.map((l) => l.id));
    expect(BoardSchema.safeParse(result).success).toBe(true);
    expect(source.columns[0]!.cards).toHaveLength(1); // source untouched
  });

  it('is a no-op for unknown columns or empty selections', () => {
    const { board } = seed();
    expect(copyCardsInto(board, 'nope', board, ['x'])).toBe(board);
    expect(copyCardsInto(board, board.columns[0]!.id, board, [])).toBe(board);
  });
});

describe('move history', () => {
  it('records column changes, not reorders, and keeps the last 5', () => {
    const { board, a, b, c1, c2 } = seed();
    const reordered = moveCard(board, c2.id, a.id, 0);
    expect(findCard(reordered, c2.id)!.card.moveLog).toEqual([]);

    let moved = board;
    for (let i = 0; i < 7; i++) moved = moveCard(moved, c1.id, i % 2 ? a.id : b.id, 0);
    const card = findCard(moved, c1.id)!.card;
    expect(card.moveLog).toHaveLength(5);
    expect(card.movedAt).toBe(card.moveLog.at(-1));
    expect(BoardSchema.safeParse(moved).success).toBe(true);
  });
});
