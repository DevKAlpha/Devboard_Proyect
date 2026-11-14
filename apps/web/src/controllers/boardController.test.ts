import { describe, expect, it } from 'vitest';
import {
  BoardSchema,
  addCard,
  createBoard,
  createCard,
  findCard,
  type GithubOp,
} from '@devbord/shared';
import { IndexedDbBoardRepository } from '../models/repositories';
import { createBoardController, setGithubSink } from './boardController';

let n = 0;
const setup = () => {
  const repo = new IndexedDbBoardRepository(`ctrl-${++n}`);
  return { repo, store: createBoardController(repo) };
};

describe('boardController', () => {
  it('creates a board and persists it', async () => {
    const { repo, store } = setup();
    const board = await store
      .getState()
      .createBoard({ name: 'Sprint', profile: 'technical', columnTitles: ['To do', 'Done'] });
    expect(store.getState().boards).toHaveLength(1);
    expect(await repo.get(board.id)).toEqual(board);
  });

  it('moves a card between columns and persists the result', async () => {
    const { repo, store } = setup();
    const board = await store
      .getState()
      .createBoard({ name: 'B', profile: 'simple', columnTitles: ['A', 'B'] });
    const [a, b] = board.columns;
    store.getState().addCard(board.id, a!.id, 'Hello');
    const cardId = store.getState().boards[0]!.columns[0]!.cards[0]!.id;

    store.getState().moveCard(board.id, cardId, b!.id, 0);

    const state = store.getState().boards[0]!;
    expect(findCard(state, cardId)?.column.id).toBe(b!.id);
    await new Promise((r) => setTimeout(r, 10)); // let the async save flush
    expect(findCard((await repo.get(board.id))!, cardId)?.column.id).toBe(b!.id);
  });

  it('ignores blank titles', async () => {
    const { store } = setup();
    const board = await store.getState().createBoard({ name: 'B', profile: 'simple' });
    store.getState().addColumn(board.id, '   ');
    expect(store.getState().boards[0]!.columns).toHaveLength(0);
  });

  it('loads boards from storage', async () => {
    const { repo, store } = setup();
    const first = setup().store; // separate store on a different db: unaffected
    await store.getState().createBoard({ name: 'Saved', profile: 'simple' });
    const fresh = createBoardController(repo);
    await fresh.getState().load();
    expect(fresh.getState().boards.map((b) => b.name)).toEqual(['Saved']);
    expect(first.getState().boards).toHaveLength(0);
  });
});

describe('boardController.importCards', () => {
  const twoBoards = async () => {
    const { store } = setup();
    const source = await store
      .getState()
      .createBoard({ name: 'Scrum', profile: 'technical', columnTitles: ['Backlog'] });
    const target = await store
      .getState()
      .createBoard({ name: 'Casa', profile: 'simple', columnTitles: ['Por hacer'] });
    store.getState().addCard(source.id, source.columns[0]!.id, 'Historia');
    const cardId = store.getState().boards.find((b) => b.id === source.id)!.columns[0]!.cards[0]!
      .id;
    const board = (id: string) => store.getState().boards.find((b) => b.id === id)!;
    return { store, source, target, cardId, board };
  };

  it('copies cards and keeps the originals', async () => {
    const { store, source, target, cardId, board } = await twoBoards();
    store.getState().importCards({
      boardId: target.id,
      columnId: target.columns[0]!.id,
      sourceBoardId: source.id,
      cardIds: [cardId],
      move: false,
    });
    expect(board(target.id).columns[0]!.cards.map((c) => c.title)).toEqual(['Historia']);
    expect(board(source.id).columns[0]!.cards).toHaveLength(1);
  });

  it('moves cards when asked', async () => {
    const { store, source, target, cardId, board } = await twoBoards();
    store.getState().importCards({
      boardId: target.id,
      columnId: target.columns[0]!.id,
      sourceBoardId: source.id,
      cardIds: [cardId],
      move: true,
    });
    expect(board(target.id).columns[0]!.cards).toHaveLength(1);
    expect(board(source.id).columns[0]!.cards).toHaveLength(0);
  });
});

describe('boardController on boards linked to GitHub', () => {
  it('sends GitHub only what changed, and blocks column edits', async () => {
    const { store } = setup();
    const sent: GithubOp[] = [];
    setGithubSink((_board, ops) => sent.push(...ops));
    const base = createBoard({ name: 'P', profile: 'technical', columnTitles: ['Todo', 'Done'] });
    const [todo, done] = base.columns.map((c) => c.id) as [string, string];
    const a = createCard('A');
    const b = createCard('B');
    const linked = {
      ...addCard(addCard(base, todo, a), done, b),
      github: { projectId: 'PVT', number: 1, owner: 'o', url: 'https://github.com/o' },
    };
    const board = await store.getState().addBoard(BoardSchema.parse(linked));
    const s = store.getState();

    s.updateCard(board.id, a.id, { title: 'A', description: 'nueva', links: [] });
    s.moveCard(board.id, a.id, done, 1);
    s.addColumn(board.id, 'Nueva');
    setGithubSink(null);

    expect(sent).toEqual([
      { type: 'updateCard', cardId: a.id, patch: { description: 'nueva' } },
      { type: 'moveCard', cardId: a.id, columnId: done, afterCardId: b.id },
    ]);
    expect(store.getState().boards[0]!.columns).toHaveLength(2);
  });
});
