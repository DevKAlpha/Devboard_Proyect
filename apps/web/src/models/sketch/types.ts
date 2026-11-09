/**
 * Whiteboard types and constants. Kept free of Yjs so the main bundle can
 * import them (the model itself is loaded on demand).
 */
/** Logical sheet size. Every client scales it to fit, so drawings line up for everyone. */
export const SHEET = { width: 1600, height: 1000 } as const;

export const STROKE_TOOLS = ['pen', 'marker', 'arrow', 'rect', 'ellipse'] as const;
export type StrokeTool = (typeof STROKE_TOOLS)[number];

/** Ink colors are names, not hex: each client paints them with its own theme. */
export const INK_COLORS = ['ink', 'blue', 'red', 'green', 'orange', 'purple'] as const;
export type InkColor = (typeof INK_COLORS)[number];

export const NOTE_COLORS = ['yellow', 'pink', 'blue', 'green'] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export interface Stroke {
  id: string;
  tool: StrokeTool;
  color: InkColor;
  /** Line width in sheet units. */
  size: number;
  /** Flat list [x0, y0, x1, y1, …] in sheet units. Shapes use exactly two points. */
  points: readonly number[];
}

export interface Note {
  id: string;
  /** "note" is a sticky note; "text" is free text written straight on the board. */
  kind: 'note' | 'text';
  x: number;
  y: number;
  text: string;
  color: NoteColor;
  /** Stacking order: the last touched note is on top. */
  z: number;
  /** Who stuck it (team boards); null on personal boards. */
  author: string | null;
  authorColor: string | null;
}

export interface SketchSnapshot {
  strokes: readonly Stroke[];
  notes: readonly Note[];
  canUndo: boolean;
  canRedo: boolean;
}

export const NOTE_TEXT_MAX = 600;

/** Sticky note paper size (sheet units). */
export const NOTE_SIZE = { width: 300, height: 240 } as const;
