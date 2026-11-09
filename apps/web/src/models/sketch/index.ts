/**
 * Whiteboard models. Loaded on demand (dynamic import) the first time a
 * whiteboard opens, so Yjs stays out of the main bundle for personal boards.
 */
import * as Y from 'yjs';
import { docStore } from '../collab/docStore';
import { SketchModel } from './SketchModel';

export * from './SketchModel';

const SAVE_DEBOUNCE_MS = 400;
const keyOf = (boardId: string) => `sketch:${boardId}`;

/** A model over an existing document (the team board's collaboration doc). */
export const sketchOnDoc = (doc: Y.Doc) => new SketchModel(doc);

/**
 * Opens the private sketch of a personal board, stored in this browser.
 * `close` flushes pending changes and releases the document.
 */
export async function openLocalSketch(
  boardId: string,
): Promise<{ model: SketchModel; close: () => void }> {
  const doc = new Y.Doc();
  const stored = await docStore.get(keyOf(boardId));
  if (stored) Y.applyUpdate(doc, stored, 'load');

  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => void docStore.put(keyOf(boardId), Y.encodeStateAsUpdate(doc));
  doc.on('update', () => {
    clearTimeout(timer);
    timer = setTimeout(save, SAVE_DEBOUNCE_MS);
  });

  const model = new SketchModel(doc);
  return {
    model,
    close: () => {
      clearTimeout(timer);
      save();
      model.destroy();
      doc.destroy();
    },
  };
}

/** Deletes the stored sketch of a personal board (when the board is deleted). */
export const forgetLocalSketch = (boardId: string) => docStore.remove(keyOf(boardId));
