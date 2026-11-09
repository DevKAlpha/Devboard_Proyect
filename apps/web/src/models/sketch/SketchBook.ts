/**
 * The list of whiteboards of a personal board (story 15), stored in the same
 * Yjs document as their content:
 *
 *   sketch.sheets: Y.Map<id, { name, createdAt }>
 *
 * Each whiteboard has its own root types (see rootName), so switching is just
 * opening another SketchModel on the same document. Team boards do not use the
 * book: the team shares a single whiteboard, so nobody ends up on a different
 * one than the person explaining.
 */
import type * as Y from 'yjs';
import { rootName } from './SketchModel';
import { MAIN_SHEET, SHEET_NAME_MAX, type SheetInfo } from './types';

/** Book edits are not drawing: they stay out of every sheet's undo history. */
const ORIGIN = 'sketch-book';

const cleanName = (name: string) => name.trim().slice(0, SHEET_NAME_MAX);

export class SketchBook {
  private readonly meta: Y.Map<unknown>;
  private listeners = new Set<() => void>();
  private list: readonly SheetInfo[];

  constructor(
    readonly doc: Y.Doc,
    private readonly newId: () => string,
  ) {
    this.meta = doc.getMap('sketch.sheets');
    // A board that never had a list starts with its first (possibly existing) whiteboard.
    if (this.meta.size === 0) {
      doc.transact(
        () => this.meta.set(MAIN_SHEET, { name: 'Pizarra 1', createdAt: Date.now() }),
        ORIGIN,
      );
    }
    this.list = this.read();
    this.meta.observe(this.onChange);
  }

  getSheets = (): readonly SheetInfo[] => this.list;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private read(): SheetInfo[] {
    const out: SheetInfo[] = [];
    this.meta.forEach((raw, id) => {
      const v = (raw ?? {}) as Partial<SheetInfo>;
      out.push({
        id,
        name: typeof v.name === 'string' && v.name ? v.name : 'Pizarra',
        createdAt: typeof v.createdAt === 'number' ? v.createdAt : 0,
      });
    });
    return out.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  }

  private onChange = () => {
    this.list = this.read();
    this.listeners.forEach((fn) => fn());
  };

  /** Adds a whiteboard and returns its id. */
  add(name?: string): string {
    const id = this.newId();
    const fallback = `Pizarra ${this.list.length + 1}`;
    this.doc.transact(
      () => this.meta.set(id, { name: cleanName(name ?? '') || fallback, createdAt: Date.now() }),
      ORIGIN,
    );
    return id;
  }

  rename(id: string, name: string) {
    const current = this.meta.get(id) as Partial<SheetInfo> | undefined;
    const next = cleanName(name);
    if (!current || !next) return;
    this.doc.transact(() => this.meta.set(id, { ...current, name: next }), ORIGIN);
  }

  /**
   * Deletes a whiteboard and its content. The last one is never removed: a
   * board always has somewhere to draw.
   */
  remove(id: string) {
    if (this.list.length <= 1 || !this.meta.has(id)) return;
    this.doc.transact(() => {
      const strokes = this.doc.getArray(rootName('strokes', id));
      strokes.delete(0, strokes.length);
      this.doc.getMap(rootName('notes', id)).clear();
      this.meta.delete(id);
    }, ORIGIN);
  }

  destroy() {
    this.meta.unobserve(this.onChange);
    this.listeners.clear();
  }
}
