/**
 * Whiteboard models. Loaded on demand (dynamic import) the first time a
 * whiteboard opens, so Yjs stays out of the main bundle for personal boards.
 */
import * as Y from 'yjs';
import { newId } from '@devbord/shared';
import { docStore } from '../collab/docStore';
import { SketchBook } from './SketchBook';
import { SketchModel } from './SketchModel';

export * from './SketchModel';
export { SketchBook } from './SketchBook';

const SAVE_DEBOUNCE_MS = 400;
const keyOf = (boardId: string) => `sketch:${boardId}`;

/** A model for one whiteboard of a document (the team doc, or a personal board's doc). */
export const sketchOnDoc = (doc: Y.Doc, sheetId?: string) => new SketchModel(doc, sheetId);

/**
 * Opens the whiteboards of a personal board, stored in this browser: the
 * document plus its list of whiteboards. `close` flushes pending changes and
 * releases the document.
 */
export async function openLocalSketch(
  boardId: string,
): Promise<{ doc: Y.Doc; book: SketchBook; close: () => void }> {
  const doc = new Y.Doc();
  const stored = await docStore.get(keyOf(boardId));
  if (stored) Y.applyUpdate(doc, stored, 'load');

  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => void docStore.put(keyOf(boardId), Y.encodeStateAsUpdate(doc));
  doc.on('update', () => {
    clearTimeout(timer);
    timer = setTimeout(save, SAVE_DEBOUNCE_MS);
  });

  const book = new SketchBook(doc, newId);
  return {
    doc,
    book,
    close: () => {
      clearTimeout(timer);
      save();
      book.destroy();
      doc.destroy();
    },
  };
}

/** Deletes the stored whiteboards of a personal board (when the board is deleted). */
export const forgetLocalSketch = (boardId: string) => docStore.remove(keyOf(boardId));
