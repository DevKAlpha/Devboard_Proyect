import { describe, expect, it } from 'vitest';
import { findCard } from '@devbord/shared';
import { IndexedDbBoardRepository } from '../models/repositories';
import { createBoardController } from './boardController';

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
