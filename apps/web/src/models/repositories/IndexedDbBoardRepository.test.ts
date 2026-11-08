import { describe, expect, it } from 'vitest';
import { createBoard, renameBoard } from '@devbord/shared';
import { IndexedDbBoardRepository } from './IndexedDbBoardRepository';

// Each test uses its own database name, so tests stay independent.
let n = 0;
const repo = () => new IndexedDbBoardRepository(`test-${++n}`);

describe('IndexedDbBoardRepository', () => {
  it('saves, reads and removes a board', async () => {
    const r = repo();
    const board = createBoard({ name: 'A', profile: 'simple', columnTitles: ['To do'] });
    await r.save(board);
    expect(await r.get(board.id)).toEqual(board);
    await r.remove(board.id);
    expect(await r.get(board.id)).toBeNull();
  });

  it('lists the most recently updated board first', async () => {
    const r = repo();
    const a = createBoard({ name: 'A', profile: 'simple' });
    const b = createBoard({ name: 'B', profile: 'simple' });
    await r.save(a);
    await r.save(b);
    await r.save({ ...renameBoard(a, 'A2'), updatedAt: '2999-01-01T00:00:00.000Z' });
    expect((await r.list()).map((x) => x.name)).toEqual(['A2', 'B']);
  });
});
