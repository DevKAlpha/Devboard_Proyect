/** Downloads a board as its re-importable JSON file (columns, cards, labels, connections). */
import type { Board } from '@devbord/shared';
import { boardFileName, serializeBoard } from '../../models/boardFile';
import { downloadBlob } from './exportPng';

export function downloadBoardJson(board: Board) {
  const blob = new Blob([serializeBoard(board)], { type: 'application/json' });
  downloadBlob(blob, boardFileName(board, 'json'));
}
