import { describe, expect, it } from 'vitest';
import { CardLinkSchema, CardSchema } from './schemas';
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
  addNewCard,
  setColumnDescription,
  moveCards,
  setBoardSkin,
  cardTrail,
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

  it('boards start with the default skin and can switch to a seasonal one', () => {
    const { board } = seed();
    expect(board.skin).toBe('default');
    const spooky = setBoardSkin(board, 'halloween');
    expect(spooky.skin).toBe('halloween');
    expect(BoardSchema.safeParse(spooky).success).toBe(true);
    // Boards saved before skins existed still parse (and get the default look).
    const legacy: Partial<typeof board> = { ...board };
    delete legacy.skin;
    expect(BoardSchema.parse(legacy).skin).toBe('default');
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

describe('card trail', () => {
  it('starts where the card is created and adds a stop per column change', () => {
    const { board, a, b } = seed();
    const card = createCard('Viaje');
    let next = addCard(board, a.id, card);
    expect(findCard(next, card.id)!.card.trail.map((s) => s.columnId)).toEqual([a.id]);
    next = moveCard(next, card.id, b.id, 0);
    next = moveCard(next, card.id, b.id, 1); // reorder: no new stop
    next = moveCards(next, [card.id], a.id, 0);
    expect(findCard(next, card.id)!.card.trail.map((s) => s.columnId)).toEqual([a.id, b.id, a.id]);
    expect(BoardSchema.safeParse(next).success).toBe(true);
  });

  it('gives legacy cards their known part and keeps it on the first move', () => {
    const { board, a, b, c1 } = seed();
    const legacy = { ...c1, trail: [] };
    expect(cardTrail(legacy, a.id)).toEqual([{ columnId: a.id, at: c1.createdAt }]);
    const moved = findCard(moveCard(board, c1.id, b.id, 0), c1.id)!.card;
    expect(moved.trail.map((s) => s.columnId)).toEqual([a.id, b.id]);
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

describe('GitHub-style numbering and columns', () => {
  it('numbers new cards #1, #2… and never reuses a number', () => {
    let board = createBoard({ name: 'B', profile: 'technical', columnTitles: ['A'] });
    const col = board.columns[0]!.id;
    board = addNewCard(board, col, createCard('uno'));
    board = addNewCard(board, col, createCard('dos'));
    const second = board.columns[0]!.cards[1]!;
    board = removeCard(board, second.id);
    board = addNewCard(board, col, createCard('tres'));
    expect(board.columns[0]!.cards.map((c) => c.number)).toEqual([1, 3]);
    expect(board.nextNumber).toBe(4);
  });

  it('gives copied cards the target board numbers', () => {
    let source = createBoard({ name: 'S', profile: 'technical', columnTitles: ['A'] });
    source = addNewCard(source, source.columns[0]!.id, createCard('x'));
    let target = createBoard({ name: 'T', profile: 'technical', columnTitles: ['A'] });
    target = addNewCard(target, target.columns[0]!.id, createCard('y'));
    const ids = source.columns[0]!.cards.map((c) => c.id);
    const result = copyCardsInto(target, target.columns[0]!.id, source, ids);
    expect(result.columns[0]!.cards.map((c) => c.number)).toEqual([1, 2]);
    expect(result.nextNumber).toBe(3);
  });

  it('sets and clears column descriptions', () => {
    const { board, a } = seed();
    const withDesc = setColumnDescription(board, a.id, '  En revisión ');
    expect(withDesc.columns[0]!.description).toBe('En revisión');
    expect(setColumnDescription(withDesc, a.id, ' ').columns[0]!.description).toBeNull();
  });

  it('moves several cards as a block, in board order, recording column changes', () => {
    let board = createBoard({ name: 'B', profile: 'technical', columnTitles: ['A', 'B'] });
    const [a, b] = board.columns.map((c) => c.id) as [string, string];
    for (const t of ['a1', 'a2', 'a3']) board = addCard(board, a, createCard(t));
    board = addCard(board, b, createCard('b1'));
    board = addCard(board, b, createCard('b2'));
    const id = (t: string) => board.columns.flatMap((c) => c.cards).find((c) => c.title === t)!.id;

    // Picked out of order, from two columns: they land together in board order.
    const moved = moveCards(board, [id('b2'), id('a3'), id('a1')], b, 1);
    expect(moved.columns[0]!.cards.map((c) => c.title)).toEqual(['a2']);
    expect(moved.columns[1]!.cards.map((c) => c.title)).toEqual(['b1', 'a1', 'a3', 'b2']);
    const card = (t: string) => moved.columns[1]!.cards.find((c) => c.title === t)!;
    expect(card('a1').moveLog).toHaveLength(1);
    expect(card('b2').moveLog).toHaveLength(0);
  });

  it('ignores unknown columns and empty selections', () => {
    const { board, a } = seed();
    expect(moveCards(board, [], a.id, 0)).toBe(board);
    expect(moveCards(board, ['x'], 'nope', 0)).toBe(board);
  });
});

describe('card links', () => {
  it('accept only http(s) URLs and default to none', () => {
    const ok = { url: 'https://docs.google.com/document/d/abc/edit', title: 'Acta' };
    expect(CardLinkSchema.safeParse(ok).success).toBe(true);
    expect(CardLinkSchema.safeParse({ ...ok, url: 'javascript:alert(1)' }).success).toBe(false);
    const legacy = { ...createCard('Vieja'), links: undefined };
    expect(CardSchema.parse(legacy).links).toEqual([]);
  });
});
