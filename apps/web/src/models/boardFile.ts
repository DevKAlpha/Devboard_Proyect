/**
 * Board file format for import / export (JSON).
 *
 * The file wraps the board with a format tag and a version, so future
 * changes can migrate old files instead of rejecting them:
 *
 *   { "format": "devbord.board", "version": 1, "exportedAt": "...", "board": { ... } }
 *
 * Validation uses the shared BoardSchema, the same one IndexedDB and the API use.
 */
import { BoardSchema, newId, type Board } from '@devbord/shared';

export const BOARD_FILE_FORMAT = 'devbord.board';
export const BOARD_FILE_VERSION = 1;

/** Serializes a board to the pretty-printed JSON file content. */
export function serializeBoard(board: Board): string {
  return JSON.stringify(
    {
      format: BOARD_FILE_FORMAT,
      version: BOARD_FILE_VERSION,
      exportedAt: new Date().toISOString(),
      board,
    },
    null,
    2,
  );
}

/** Error with a message that can be shown to the user as is. */
export class BoardFileError extends Error {}

/**
 * Parses an exported file (or a bare board object) into a NEW board.
 *
 * The board gets a fresh id, so importing never overwrites an existing board,
 * and importing the same file twice gives two independent copies.
 */
export function parseBoardFile(text: string): Board {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BoardFileError('El archivo no es un JSON válido.');
  }

  const wrapped =
    typeof data === 'object' && data !== null && 'format' in data
      ? (data as { format: unknown; version?: unknown; board?: unknown })
      : null;
  if (wrapped && wrapped.format !== BOARD_FILE_FORMAT) {
    throw new BoardFileError('El archivo no es un tablero de Devbord.');
  }
  if (wrapped && typeof wrapped.version === 'number' && wrapped.version > BOARD_FILE_VERSION) {
    throw new BoardFileError('El archivo viene de una versión más nueva de Devbord.');
  }

  const result = BoardSchema.safeParse(wrapped ? wrapped.board : data);
  if (!result.success) {
    throw new BoardFileError('El tablero del archivo está incompleto o dañado.');
  }
  const now = new Date().toISOString();
  return { ...result.data, id: newId(), createdAt: now, updatedAt: now };
}

/** File name for a board export: "mi-tablero.devbord.json". */
export const boardFileName = (board: Board, extension: 'json' | 'png') => {
  const slug =
    board.name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'tablero';
  return extension === 'json' ? `${slug}.devbord.json` : `${slug}.png`;
};
