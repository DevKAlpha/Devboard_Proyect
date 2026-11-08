import { describe, expect, it } from 'vitest';
import { addCard, createBoard, createCard } from '@devbord/shared';
import { BoardFileError, boardFileName, parseBoardFile, serializeBoard } from './boardFile';

const sample = () => {
  const board = createBoard({ name: 'Sprint Ágil #1', profile: 'technical', columnTitles: ['A'] });
  return addCard(board, board.columns[0]!.id, createCard('Hola', { storyPoints: 3 }));
};

describe('boardFile', () => {
  it('round-trips a board as a new copy', () => {
    const board = sample();
    const imported = parseBoardFile(serializeBoard(board));
    expect(imported.id).not.toBe(board.id);
    expect(imported.name).toBe(board.name);
    expect(imported.columns[0]!.cards[0]).toMatchObject({ title: 'Hola', storyPoints: 3 });
  });

  it('accepts a bare board object', () => {
    expect(parseBoardFile(JSON.stringify(sample())).name).toBe('Sprint Ágil #1');
  });

  it.each([
    ['not json', 'no es JSON'],
    [JSON.stringify({ format: 'other', board: {} }), 'no es un tablero'],
    [JSON.stringify({ format: 'devbord.board', version: 99, board: {} }), 'más nueva'],
    [JSON.stringify({ format: 'devbord.board', version: 1, board: { name: 'x' } }), 'dañado'],
  ])('rejects invalid input with a readable message (%#)', (text, message) => {
    expect(() => parseBoardFile(text)).toThrow(BoardFileError);
    expect(() => parseBoardFile(text)).toThrow(new RegExp(message.split(' ').pop()!));
  });

  it('builds safe file names', () => {
    expect(boardFileName(sample(), 'json')).toBe('sprint-agil-1.devbord.json');
    expect(boardFileName(sample(), 'png')).toBe('sprint-agil-1.png');
  });
});

describe('boardFile with team boards', () => {
  it('never exports the invite secret and gives imports a new room', () => {
    const team = createBoard({ name: 'Equipo', profile: 'simple', mode: 'team' });
    const text = serializeBoard(team);
    expect(text).not.toContain(team.shareKey!);
    const imported = parseBoardFile(text);
    expect(imported.mode).toBe('team');
    expect(imported.shareKey).toMatch(/^[0-9a-f]{64}$/);
    expect(imported.shareKey).not.toBe(team.shareKey);
  });
});
