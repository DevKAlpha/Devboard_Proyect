import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { SketchModel, type Stroke } from './SketchModel';

const pen = (id: string, points: number[] = [0, 0]): Stroke => ({
  id,
  tool: 'pen',
  color: 'ink',
  size: 4,
  points,
});

const note = (id: string) => ({
  id,
  kind: 'note' as const,
  x: 10,
  y: 20,
  text: '',
  color: 'yellow' as const,
  author: null,
  authorColor: null,
});

/** Two peers wired to each other, like a live team session. */
const twoPeers = () => {
  const a = new Y.Doc();
  const b = new Y.Doc();
  a.on(
    'update',
    (u: Uint8Array, origin: unknown) => origin !== 'remote' && Y.applyUpdate(b, u, 'remote'),
  );
  b.on(
    'update',
    (u: Uint8Array, origin: unknown) => origin !== 'remote' && Y.applyUpdate(a, u, 'remote'),
  );
  return { a: new SketchModel(a), b: new SketchModel(b) };
};

describe('SketchModel', () => {
  it('grows a stroke while it is drawn and undoes it as one step', () => {
    const m = new SketchModel(new Y.Doc());
    m.beginStroke(pen('s1', [1, 2]));
    m.appendPoints('s1', [3, 4]);
    m.appendPoints('s1', [5, 6]);
    m.endStroke('s1');
    expect(m.getSnapshot().strokes[0]!.points).toEqual([1, 2, 3, 4, 5, 6]);

    m.undo();
    expect(m.getSnapshot().strokes).toHaveLength(0);
    m.redo();
    expect(m.getSnapshot().strokes[0]!.points).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('keeps separate gestures as separate undo steps', () => {
    const m = new SketchModel(new Y.Doc());
    m.beginStroke(pen('s1'));
    m.endStroke('s1');
    m.beginStroke(pen('s2'));
    m.endStroke('s2');
    m.undo();
    expect(m.getSnapshot().strokes.map((s) => s.id)).toEqual(['s1']);
  });

  it('replaces the two points of a shape', () => {
    const m = new SketchModel(new Y.Doc());
    m.beginStroke({ ...pen('r'), tool: 'rect', points: [0, 0, 0, 0] });
    m.setPoints('r', [0, 0, 50, 40]);
    expect(m.getSnapshot().strokes[0]!.points).toEqual([0, 0, 50, 40]);
  });

  it('erases strokes and can bring them back', () => {
    const m = new SketchModel(new Y.Doc());
    m.beginStroke(pen('s1'));
    m.beginStroke(pen('s2'));
    m.stopCapturing();
    m.removeStrokes(new Set(['s1']));
    expect(m.getSnapshot().strokes.map((s) => s.id)).toEqual(['s2']);
    m.undo();
    expect(
      m
        .getSnapshot()
        .strokes.map((s) => s.id)
        .sort(),
    ).toEqual(['s1', 's2']);
  });

  it('stacks notes by last touch', () => {
    const m = new SketchModel(new Y.Doc());
    m.addNote(note('n1'));
    m.addNote(note('n2'));
    m.raiseNote('n1');
    expect(m.getSnapshot().notes.map((n) => n.id)).toEqual(['n2', 'n1']);
    m.updateNote('n1', { text: 'Ojo aquí' });
    expect(m.getSnapshot().notes[1]!.text).toBe('Ojo aquí');
  });

  it('clears everything in one undoable step', () => {
    const m = new SketchModel(new Y.Doc());
    m.beginStroke(pen('s1'));
    m.addNote(note('n1'));
    m.clear();
    expect(m.getSnapshot().strokes).toHaveLength(0);
    expect(m.getSnapshot().notes).toHaveLength(0);
    m.undo();
    expect(m.getSnapshot().strokes).toHaveLength(1);
    expect(m.getSnapshot().notes).toHaveLength(1);
  });

  it('shares strokes live with a teammate, and undo only touches your own work', () => {
    const { a, b } = twoPeers();
    a.beginStroke(pen('mine', [0, 0]));
    a.appendPoints('mine', [10, 10]);
    expect(b.getSnapshot().strokes[0]!.points).toEqual([0, 0, 10, 10]);

    b.beginStroke(pen('theirs'));
    a.undo();
    expect(a.getSnapshot().strokes.map((s) => s.id)).toEqual(['theirs']);
    expect(b.getSnapshot().strokes.map((s) => s.id)).toEqual(['theirs']);
  });

  it('ignores malformed data from the network', () => {
    const doc = new Y.Doc();
    doc.getMap('sketch.notes').set('bad', { x: 'nope', color: 'neon' });
    const n = new SketchModel(doc).getSnapshot().notes[0]!;
    expect(n).toMatchObject({ x: 0, color: 'yellow', text: '' });
  });
});
