/**
 * Deleting a board everywhere it lives: its local whiteboard or team room and
 * the board itself. Used by the board page and by the archived list on home.
 */
import type { Board } from '@devbord/shared';
import { useBoardController } from './boardController';
import { useCollab } from './collabController';
import { useSketch } from './sketchController';

export async function removeBoard(board: Board) {
  if (board.mode === 'team') await useCollab.getState().forget(board.id);
  else await useSketch.getState().forget(board.id);
  await useBoardController.getState().deleteBoard(board.id);
}
