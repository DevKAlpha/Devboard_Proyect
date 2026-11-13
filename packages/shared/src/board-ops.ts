/**
 * Pure, immutable board operations.
 *
 * Every function takes a Board and returns a NEW Board (never mutates), so:
 *  - React/Zustand can detect changes by reference,
 *  - the same logic runs on the client and the API,
 *  - undo/redo is trivial to add later (keep previous snapshots).
 *
 * Unknown ids are a no-op (the board is returned unchanged). That keeps
 * stale UI events (e.g. a double click on a deleted card) harmless.
 */
import { MOVE_LOG_SIZE, TRAIL_SIZE, type TrailStep } from './schemas';
import type {
  Board,
  BoardMode,
  BoardSkin,
  Card,
  CardPatch,
  Column,
  Label,
  Profile,
} from './schemas';

/** Collision-safe id. `crypto.randomUUID` exists in modern browsers (secure context) and Node >= 19. */
// Typed locally so this package needs neither DOM nor Node type libs.
const webCrypto = (globalThis as unknown as { crypto: { randomUUID(): string } }).crypto;
export const newId = (): string => webCrypto.randomUUID();

/** Unguessable secret for team invite links (two UUIDs, hyphens removed: 64 hex chars). */
export const newShareKey = (): string =>
  (webCrypto.randomUUID() + webCrypto.randomUUID()).replace(/-/g, '');

const nowIso = (): string => new Date().toISOString();

/** Returns a copy of the board with a fresh `updatedAt`. */
const touch = (board: Board, columns: Column[] = board.columns): Board => ({
  ...board,
  columns,
  updatedAt: nowIso(),
});

/** Clamps an insertion index into [0, length]. */
const clampIndex = (index: number, length: number): number =>
  Math.max(0, Math.min(Number.isFinite(index) ? index : length, length));

export interface NewBoardInput {
  name: string;
  profile: Profile;
  /** Default "personal". Team boards get a random share key. */
  mode?: BoardMode;
  /** Default "default" (the app's own look). */
  skin?: BoardSkin;
  templateId?: string | null;
  columnTitles?: string[];
  /** WIP limit per column, aligned with `columnTitles` (missing = unlimited). */
  wipLimits?: (number | null)[];
  /** Column descriptions, aligned with `columnTitles`. */
  columnDescriptions?: (string | null)[];
  labels?: Omit<Label, 'id'>[];
  cardTemplate?: string | null;
}

export function createBoard(input: NewBoardInput): Board {
  const at = nowIso();
  return {
    id: newId(),
    name: input.name.trim(),
    profile: input.profile,
    mode: input.mode ?? 'personal',
    skin: input.skin ?? 'default',
    shareKey: input.mode === 'team' ? newShareKey() : null,
    templateId: input.templateId ?? null,
    labels: (input.labels ?? []).map((l) => ({ ...l, id: newId() })),
    cardTemplate: input.cardTemplate ?? null,
    nextNumber: 1,
    columns: (input.columnTitles ?? []).map((title, i) => ({
      id: newId(),
      title,
      description: input.columnDescriptions?.[i] ?? null,
      wipLimit: input.wipLimits?.[i] ?? null,
      cards: [],
    })),
    createdAt: at,
    updatedAt: at,
  };
}

export function createCard(title: string, patch: CardPatch = {}): Card {
  const at = nowIso();
  return {
    description: '',
    labelIds: [],
    dueDate: null,
    type: 'task',
    priority: null,
    storyPoints: null,
    movedAt: null,
    moveLog: [],
    trail: [],
    links: [],
    number: null,
    sprint: null,
    ...patch,
    id: newId(),
    title: title.trim(),
    createdAt: at,
    updatedAt: at,
  };
}

export function renameBoard(board: Board, name: string): Board {
  return { ...touch(board), name: name.trim() };
}

export function setBoardProfile(board: Board, profile: Profile): Board {
  return { ...touch(board), profile };
}

export function setBoardSkin(board: Board, skin: BoardSkin): Board {
  return { ...touch(board), skin };
}

// ─── Columns ────────────────────────────────────────────────────────────────

export function addColumn(board: Board, title: string, index = board.columns.length): Board {
  const columns = [...board.columns];
  columns.splice(clampIndex(index, columns.length), 0, {
    id: newId(),
    title: title.trim(),
    description: null,
    wipLimit: null,
    cards: [],
  });
  return touch(board, columns);
}

/** Sets (or clears with null) a column's WIP limit. */
export function setColumnWipLimit(board: Board, columnId: string, wipLimit: number | null): Board {
  if (!board.columns.some((c) => c.id === columnId)) return board;
  return touch(
    board,
    board.columns.map((c) => (c.id === columnId ? { ...c, wipLimit } : c)),
  );
}

/** Sets (or clears with null/empty) a column's one-line description. */
export function setColumnDescription(
  board: Board,
  columnId: string,
  description: string | null,
): Board {
  if (!board.columns.some((c) => c.id === columnId)) return board;
  const value = description?.trim() || null;
  return touch(
    board,
    board.columns.map((c) => (c.id === columnId ? { ...c, description: value } : c)),
  );
}

/** True when a column holds more cards than its WIP limit allows. */
export const isOverWip = (column: Column): boolean =>
  column.wipLimit !== null && column.cards.length > column.wipLimit;

export function renameColumn(board: Board, columnId: string, title: string): Board {
  if (!board.columns.some((c) => c.id === columnId)) return board;
  return touch(
    board,
    board.columns.map((c) => (c.id === columnId ? { ...c, title: title.trim() } : c)),
  );
}

/** Removes a column AND its cards. The UI is expected to confirm first. */
export function removeColumn(board: Board, columnId: string): Board {
  if (!board.columns.some((c) => c.id === columnId)) return board;
  return touch(
    board,
    board.columns.filter((c) => c.id !== columnId),
  );
}

export function moveColumn(board: Board, columnId: string, toIndex: number): Board {
  const from = board.columns.findIndex((c) => c.id === columnId);
  if (from === -1) return board;
  const columns = [...board.columns];
  const [moved] = columns.splice(from, 1);
  columns.splice(clampIndex(toIndex, columns.length), 0, moved!);
  return touch(board, columns);
}

// ─── Cards ──────────────────────────────────────────────────────────────────

/** Locates a card. Returns null when it does not exist. */
export function findCard(
  board: Board,
  cardId: string,
): { card: Card; column: Column; index: number } | null {
  for (const column of board.columns) {
    const index = column.cards.findIndex((c) => c.id === cardId);
    if (index !== -1) return { card: column.cards[index]!, column, index };
  }
  return null;
}

/**
 * A card's journey, oldest stop first. Cards from before the trail existed (or
 * built straight into a column, like template cards) get their known part: the
 * column they are in now, since they entered it.
 */
export function cardTrail(card: Card, columnId: string): TrailStep[] {
  return card.trail.length > 0 ? card.trail : [{ columnId, at: card.movedAt ?? card.createdAt }];
}

/** The card after entering `to` from `from`: a new stop at the end of its trail. */
function enter(card: Card, fromColumnId: string, toColumnId: string, at: string): Card {
  return {
    ...card,
    movedAt: at,
    moveLog: [...card.moveLog, at].slice(-MOVE_LOG_SIZE),
    trail: [...cardTrail(card, fromColumnId), { columnId: toColumnId, at }].slice(-TRAIL_SIZE),
  };
}

export function addCard(board: Board, columnId: string, card: Card, index?: number): Board {
  if (!board.columns.some((c) => c.id === columnId)) return board;
  // The first stop of the journey: where the card was created.
  const placed: Card =
    card.trail.length > 0 ? card : { ...card, trail: [{ columnId, at: card.createdAt }] };
  return touch(
    board,
    board.columns.map((c) => {
      if (c.id !== columnId) return c;
      const cards = [...c.cards];
      cards.splice(clampIndex(index ?? cards.length, cards.length), 0, placed);
      return { ...c, cards };
    }),
  );
}

/**
 * Adds a NEW card and gives it the board's next number (#1, #2…).
 * Use this for cards the user creates; `addCard` places an existing card as is.
 */
export function addNewCard(board: Board, columnId: string, card: Card, index?: number): Board {
  const next = addCard(board, columnId, { ...card, number: board.nextNumber }, index);
  return next === board ? board : { ...next, nextNumber: board.nextNumber + 1 };
}

export function updateCard(board: Board, cardId: string, patch: CardPatch): Board {
  if (!findCard(board, cardId)) return board;
  const at = nowIso();
  return touch(
    board,
    board.columns.map((col) => ({
      ...col,
      cards: col.cards.map((card) =>
        card.id === cardId ? { ...card, ...patch, updatedAt: at } : card,
      ),
    })),
  );
}

export function removeCard(board: Board, cardId: string): Board {
  if (!findCard(board, cardId)) return board;
  return touch(
    board,
    board.columns.map((col) => ({ ...col, cards: col.cards.filter((c) => c.id !== cardId) })),
  );
}

/**
 * Moves a card to `toColumnId` at `toIndex`.
 * `toIndex` is interpreted AFTER the card is removed from its source, which
 * matches how drag & drop libraries report the drop position.
 */
export function moveCard(board: Board, cardId: string, toColumnId: string, toIndex: number): Board {
  const found = findCard(board, cardId);
  if (!found || !board.columns.some((c) => c.id === toColumnId)) return board;
  if (found.column.id === toColumnId && found.index === toIndex) return board;

  const without = board.columns.map((col) =>
    col.id === found.column.id ? { ...col, cards: col.cards.filter((c) => c.id !== cardId) } : col,
  );
  const columns = without.map((col) => {
    if (col.id !== toColumnId) return col;
    const cards = [...col.cards];
    // Changing column is "progress": record it (reordering inside a column is not).
    const card =
      found.column.id === toColumnId
        ? found.card
        : enter(found.card, found.column.id, toColumnId, nowIso());
    cards.splice(clampIndex(toIndex, cards.length), 0, card);
    return { ...col, cards };
  });
  return touch(board, columns);
}

/**
 * Moves several cards at once (multi-select) into one column, as a block, in
 * the order they appear on the board. `toIndex` is the position in the
 * target column once the moved cards are taken out of it. Cards that change
 * column record the move, like moveCard.
 */
export function moveCards(
  board: Board,
  cardIds: readonly string[],
  toColumnId: string,
  toIndex: number,
): Board {
  const wanted = new Set(cardIds);
  if (wanted.size === 0 || !board.columns.some((c) => c.id === toColumnId)) return board;

  const at = nowIso();
  const moving: Card[] = [];
  const without = board.columns.map((col) => {
    const keep: Card[] = [];
    for (const card of col.cards) {
      if (!wanted.has(card.id)) keep.push(card);
      else if (col.id === toColumnId) moving.push(card);
      else moving.push(enter(card, col.id, toColumnId, at));
    }
    return keep.length === col.cards.length ? col : { ...col, cards: keep };
  });
  if (moving.length === 0) return board;

  const columns = without.map((col) => {
    if (col.id !== toColumnId) return col;
    const cards = [...col.cards];
    cards.splice(clampIndex(toIndex, cards.length), 0, ...moving);
    return { ...col, cards };
  });
  return touch(board, columns);
}

// ─── Cross-board ────────────────────────────────────────────────────────────

/**
 * Copies cards from `source` into a column of `target` (appended, in source
 * order). Works between any boards, whatever their profile or template.
 *
 * - Copies get new ids and timestamps; the source board is not touched
 *   (callers that "move" remove the originals with `removeCard`).
 * - Labels are matched by name (case-insensitive). A missing label is
 *   created on the target with the source color, so no tag is lost.
 */
export function copyCardsInto(
  target: Board,
  columnId: string,
  source: Board,
  cardIds: readonly string[],
): Board {
  if (!target.columns.some((c) => c.id === columnId)) return target;
  const wanted = new Set(cardIds);
  const picked = source.columns.flatMap((c) => c.cards).filter((c) => wanted.has(c.id));
  if (picked.length === 0) return target;

  const labels = [...target.labels];
  const byName = new Map(labels.map((l) => [l.name.toLowerCase(), l.id]));
  const sourceLabels = new Map(source.labels.map((l) => [l.id, l]));
  const mapLabel = (sourceId: string): string[] => {
    const label = sourceLabels.get(sourceId);
    if (!label) return [];
    const key = label.name.toLowerCase();
    let id = byName.get(key);
    if (!id) {
      id = newId();
      labels.push({ id, name: label.name, color: label.color });
      byName.set(key, id);
    }
    return [id];
  };

  const at = nowIso();
  const copies: Card[] = picked.map((card, i) => ({
    ...card,
    id: newId(),
    // Copies are new items on the target board: they take its next numbers.
    number: target.nextNumber + i,
    labelIds: card.labelIds.flatMap(mapLabel),
    // A copy starts fresh on the target board: no inherited "stale" or "hot" state.
    movedAt: null,
    moveLog: [],
    trail: [{ columnId, at }],
    createdAt: at,
    updatedAt: at,
  }));

  return {
    ...touch(
      target,
      target.columns.map((c) => (c.id === columnId ? { ...c, cards: [...c.cards, ...copies] } : c)),
    ),
    labels,
    nextNumber: target.nextNumber + copies.length,
  };
}
