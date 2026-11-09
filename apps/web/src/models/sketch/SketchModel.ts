/**
 * Whiteboard ("pizarra") data model on top of a Yjs document.
 *
 * Why Yjs for both personal and team boards: one code path. A personal board
 * keeps its sketch in a local document (stored by docStore under
 * `sketch:<boardId>`). A team board puts the sketch inside the board's own
 * collaboration document, so strokes and notes travel with the existing P2P
 * session and merge like the cards do.
 *
 * Document shape (two root types, next to the board's "board" map):
 *   sketch.strokes: Y.Array<Y.Map>   id, tool, color, size, points: Y.Array<number>
 *   sketch.notes:   Y.Map<Note>      one plain object per sticky note (last writer wins)
 *
 * Points live in a Y.Array so a stroke can grow while it is drawn: teammates
 * see it appear live instead of popping in on mouse up.
 *
 * Undo/redo uses Y.UndoManager restricted to our own origin: undo removes
 * only what *you* did, never a teammate's work.
 */
import * as Y from 'yjs';
import {
  INK_COLORS,
  NOTE_COLORS,
  NOTE_TEXT_MAX,
  STROKE_TOOLS,
  type Note,
  type SketchSnapshot,
  type Stroke,
} from './types';

export * from './types';

/** Every local change carries this origin: the undo manager tracks only these. */
const ORIGIN = 'sketch';

const isOneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && (list as readonly string[]).includes(v);
const num = (v: unknown, fallback = 0) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/** Peers are trusted to run the same app, but a bad value must never crash the canvas. */
function readStroke(map: Y.Map<unknown>): Stroke | null {
  const id = map.get('id');
  const points = map.get('points');
  if (typeof id !== 'string' || !(points instanceof Y.Array)) return null;
  const tool = map.get('tool');
  const color = map.get('color');
  return {
    id,
    tool: isOneOf(STROKE_TOOLS, tool) ? tool : 'pen',
    color: isOneOf(INK_COLORS, color) ? color : 'ink',
    size: Math.min(64, Math.max(1, num(map.get('size'), 4))),
    points: (points.toArray() as unknown[]).map((p) => num(p)),
  };
}

function readNote(id: string, raw: unknown): Note | null {
  if (!raw || typeof raw !== 'object') return null;
  const n = raw as Record<string, unknown>;
  return {
    id,
    kind: n.kind === 'text' ? 'text' : 'note',
    x: num(n.x),
    y: num(n.y),
    text: typeof n.text === 'string' ? n.text.slice(0, NOTE_TEXT_MAX) : '',
    color: isOneOf(NOTE_COLORS, n.color) ? n.color : 'yellow',
    z: num(n.z),
    author: typeof n.author === 'string' ? n.author : null,
    authorColor: typeof n.authorColor === 'string' ? n.authorColor : null,
  };
}

export class SketchModel {
  private readonly strokesArr: Y.Array<Y.Map<unknown>>;
  private readonly notesMap: Y.Map<unknown>;
  private readonly undoManager: Y.UndoManager;
  /** Parsed strokes by Y.Map: only strokes that changed are parsed again. */
  private cache = new WeakMap<Y.Map<unknown>, Stroke>();
  /** Strokes being drawn right now by this client, for fast appends. */
  private drawing = new Map<string, Y.Map<unknown>>();
  private listeners = new Set<() => void>();
  private snapshot: SketchSnapshot;

  constructor(readonly doc: Y.Doc) {
    this.strokesArr = doc.getArray('sketch.strokes');
    this.notesMap = doc.getMap('sketch.notes');
    this.undoManager = new Y.UndoManager([this.strokesArr, this.notesMap], {
      trackedOrigins: new Set([ORIGIN]),
      // Grouping is explicit (stopCapturing at the start of each gesture), so a
      // long stroke or a note drag is a single undo step however long it takes.
      captureTimeout: 60 * 60 * 1000,
    });
    this.snapshot = this.build();
    this.strokesArr.observeDeep(this.onStrokes);
    this.notesMap.observe(this.onChange);
    this.undoManager.on('stack-item-added', this.onChange);
    this.undoManager.on('stack-item-popped', this.onChange);
  }

  // --- reading -------------------------------------------------------------

  /** Stable between changes (for useSyncExternalStore). */
  getSnapshot = (): SketchSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private build(): SketchSnapshot {
    const strokes: Stroke[] = [];
    for (const map of this.strokesArr.toArray()) {
      let stroke = this.cache.get(map);
      if (!stroke) {
        const parsed = readStroke(map);
        if (!parsed) continue;
        stroke = parsed;
        this.cache.set(map, stroke);
      }
      strokes.push(stroke);
    }
    const notes: Note[] = [];
    this.notesMap.forEach((raw, id) => {
      const note = readNote(id, raw);
      if (note) notes.push(note);
    });
    notes.sort((a, b) => a.z - b.z);
    return {
      strokes,
      notes,
      canUndo: this.undoManager.canUndo(),
      canRedo: this.undoManager.canRedo(),
    };
  }

  private onStrokes = (events: Array<Y.YEvent<Y.AbstractType<unknown>>>) => {
    // Forget the parsed copy of every stroke that changed (points or fields).
    for (const event of events) {
      const target = event.target;
      if (target instanceof Y.Map) this.cache.delete(target as Y.Map<unknown>);
      else if (target instanceof Y.Array && target.parent instanceof Y.Map)
        this.cache.delete(target.parent as Y.Map<unknown>);
    }
    this.onChange();
  };

  private onChange = () => {
    this.snapshot = this.build();
    this.listeners.forEach((fn) => fn());
  };

  // --- strokes ---------------------------------------------------------------

  /** Starts a stroke; following appendPoints/setPoints calls join the same undo step. */
  beginStroke(stroke: Stroke) {
    this.undoManager.stopCapturing();
    this.doc.transact(() => {
      const map = new Y.Map<unknown>();
      map.set('id', stroke.id);
      map.set('tool', stroke.tool);
      map.set('color', stroke.color);
      map.set('size', stroke.size);
      const points = new Y.Array<number>();
      points.push([...stroke.points]);
      map.set('points', points);
      this.strokesArr.push([map]);
      this.drawing.set(stroke.id, map);
    }, ORIGIN);
  }

  /** Adds points to a freehand stroke being drawn. */
  appendPoints(id: string, points: readonly number[]) {
    const map = this.drawing.get(id);
    if (!map || points.length === 0) return;
    this.doc.transact(() => (map.get('points') as Y.Array<number>).push([...points]), ORIGIN);
  }

  /** Replaces the points of a shape being drawn (it is defined by start and end). */
  setPoints(id: string, points: readonly number[]) {
    const map = this.drawing.get(id);
    if (!map) return;
    this.doc.transact(() => {
      const arr = map.get('points') as Y.Array<number>;
      arr.delete(0, arr.length);
      arr.push([...points]);
    }, ORIGIN);
  }

  endStroke(id: string) {
    this.drawing.delete(id);
  }

  /** Removes strokes by id (eraser). Call stopCapturing() when an eraser gesture starts. */
  removeStrokes(ids: ReadonlySet<string>) {
    if (ids.size === 0) return;
    this.doc.transact(() => {
      for (let i = this.strokesArr.length - 1; i >= 0; i--) {
        if (ids.has(this.strokesArr.get(i).get('id') as string)) this.strokesArr.delete(i, 1);
      }
    }, ORIGIN);
  }

  // --- notes -----------------------------------------------------------------

  addNote(note: Omit<Note, 'z'>) {
    this.undoManager.stopCapturing();
    this.doc.transact(() => this.notesMap.set(note.id, { ...note, z: this.topZ() + 1 }), ORIGIN);
  }

  updateNote(id: string, patch: Partial<Omit<Note, 'id'>>) {
    const current = readNote(id, this.notesMap.get(id));
    if (!current) return;
    const next = { ...current, ...patch };
    if (patch.text !== undefined) next.text = patch.text.slice(0, NOTE_TEXT_MAX);
    this.doc.transact(() => this.notesMap.set(id, next), ORIGIN);
  }

  /** Puts a note above the others. */
  raiseNote(id: string) {
    const current = readNote(id, this.notesMap.get(id));
    if (current && current.z < this.topZ()) this.updateNote(id, { z: this.topZ() + 1 });
  }

  removeNote(id: string) {
    this.undoManager.stopCapturing();
    this.doc.transact(() => this.notesMap.delete(id), ORIGIN);
  }

  private topZ() {
    let top = 0;
    this.notesMap.forEach((raw) => (top = Math.max(top, num((raw as Note | undefined)?.z))));
    return top;
  }

  // --- whole sheet -----------------------------------------------------------

  /** Erases everything (one undo step, so it can be taken back). */
  clear() {
    this.undoManager.stopCapturing();
    this.doc.transact(() => {
      this.strokesArr.delete(0, this.strokesArr.length);
      this.notesMap.clear();
    }, ORIGIN);
    this.undoManager.stopCapturing();
  }

  /** Closes the current undo step: the next change starts a new one. */
  stopCapturing() {
    this.undoManager.stopCapturing();
  }

  undo() {
    this.undoManager.undo();
  }

  redo() {
    this.undoManager.redo();
  }

  destroy() {
    this.strokesArr.unobserveDeep(this.onStrokes);
    this.notesMap.unobserve(this.onChange);
    this.undoManager.destroy();
    this.listeners.clear();
  }
}
