import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { SketchBook } from './SketchBook';
import { SketchModel } from './SketchModel';
import { MAIN_SHEET } from './types';

let n = 0;
const ids = () => `sheet-${++n}`;

describe('SketchBook', () => {
  it('starts with the first whiteboard, keeping sketches made before there were several', () => {
    const doc = new Y.Doc();
    new SketchModel(doc).beginStroke({
      id: 's',
      tool: 'pen',
      color: 'ink',
      size: 4,
      points: [0, 0],
    });
    const book = new SketchBook(doc, ids);
    expect(book.getSheets().map((s) => s.id)).toEqual([MAIN_SHEET]);
    expect(new SketchModel(doc, MAIN_SHEET).getSnapshot().strokes).toHaveLength(1);
  });

  it('keeps each whiteboard content apart', () => {
    const doc = new Y.Doc();
    const book = new SketchBook(doc, ids);
    const second = book.add('Arquitectura');
    new SketchModel(doc, second).beginStroke({
      id: 's',
      tool: 'pen',
      color: 'ink',
      size: 4,
      points: [0, 0],
    });
    expect(new SketchModel(doc, MAIN_SHEET).getSnapshot().strokes).toHaveLength(0);
    expect(new SketchModel(doc, second).getSnapshot().strokes).toHaveLength(1);
    expect(book.getSheets().map((s) => s.name)).toEqual(['Pizarra 1', 'Arquitectura']);
  });

  it('renames, deletes with content, and never deletes the last one', () => {
    const doc = new Y.Doc();
    const book = new SketchBook(doc, ids);
    const second = book.add();
    book.rename(second, '  Flujo  ');
    expect(book.getSheets()[1]!.name).toBe('Flujo');

    new SketchModel(doc, second).addNote({
      id: 'n',
      kind: 'note',
      x: 0,
      y: 0,
      text: 'x',
      color: 'yellow',
      author: null,
      authorColor: null,
    });
    book.remove(second);
    expect(book.getSheets().map((s) => s.id)).toEqual([MAIN_SHEET]);
    expect(new SketchModel(doc, second).getSnapshot().notes).toHaveLength(0);

    book.remove(MAIN_SHEET);
    expect(book.getSheets()).toHaveLength(1);
  });

  it('keeps sheet edits out of the drawing undo history', () => {
    const doc = new Y.Doc();
    const book = new SketchBook(doc, ids);
    const model = new SketchModel(doc, MAIN_SHEET);
    book.add('Otra');
    expect(model.getSnapshot().canUndo).toBe(false);
  });
});
