import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  addCard,
  createBoard,
  createCard,
  moveCard,
  removeCard,
  renameColumn,
  updateCard,
} from '@devbord/shared';
import { readBoard, writeBoard } from './yBoard';

const seedBoard = () => {
  let board = createBoard({
    name: 'Equipo',
    profile: 'technical',
    mode: 'team',
    columnTitles: ['A', 'B'],
  });
  board = addCard(board, board.columns[0]!.id, createCard('Uno'));
  board = addCard(board, board.columns[0]!.id, createCard('Dos'));
  return board;
};

/** Two peers that start from the same synced state. */
const twoPeers = () => {
  const board = seedBoard();
  const a = new Y.Doc();
  writeBoard(a, board);
  const b = new Y.Doc();
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  const sync = () => {
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  };
  return { board, a, b, sync };
};

describe('yBoard', () => {
  it('round-trips a board', () => {
    const board = seedBoard();
    const doc = new Y.Doc();
    writeBoard(doc, board);
    expect(readBoard(doc)).toEqual(board);
  });

  it('returns null for an empty document (teammate not synced yet)', () => {
    expect(readBoard(new Y.Doc())).toBeNull();
  });

  it('merges simultaneous edits to different cards without losing any', () => {
    const { board, a, b, sync } = twoPeers();
    const [one, two] = board.columns[0]!.cards;
    writeBoard(a, updateCard(readBoard(a)!, one!.id, { title: 'Uno (Ana)' }));
    writeBoard(b, updateCard(readBoard(b)!, two!.id, { title: 'Dos (Beto)' }));
    sync();
    const titles = readBoard(a)!.columns[0]!.cards.map((c) => c.title);
    expect(titles).toEqual(['Uno (Ana)', 'Dos (Beto)']);
    expect(readBoard(b)).toEqual(readBoard(a));
  });

  it('merges a move on one peer with a rename on the other', () => {
    const { board, a, b, sync } = twoPeers();
    const [colA, colB] = board.columns;
    const card = colA!.cards[0]!;
    writeBoard(a, moveCard(readBoard(a)!, card.id, colB!.id, 0));
    writeBoard(b, renameColumn(readBoard(b)!, colA!.id, 'Por hacer'));
    sync();
    const merged = readBoard(a)!;
    expect(merged.columns[0]!.title).toBe('Por hacer');
    expect(merged.columns[1]!.cards.map((c) => c.id)).toEqual([card.id]);
    expect(readBoard(b)).toEqual(merged);
  });

  it('never shows a card twice when both peers move it at once', () => {
    const { board, a, b, sync } = twoPeers();
    const card = board.columns[0]!.cards[0]!;
    writeBoard(a, moveCard(readBoard(a)!, card.id, board.columns[1]!.id, 0));
    writeBoard(b, moveCard(readBoard(b)!, card.id, board.columns[1]!.id, 0));
    sync();
    const ids = readBoard(a)!.columns.flatMap((c) => c.cards.map((x) => x.id));
    expect(ids.filter((id) => id === card.id)).toHaveLength(1);
  });

  it('applies deletions', () => {
    const { board, a } = twoPeers();
    const card = board.columns[0]!.cards[0]!;
    writeBoard(a, removeCard(readBoard(a)!, card.id));
    expect(readBoard(a)!.columns[0]!.cards).toHaveLength(1);
  });
});
