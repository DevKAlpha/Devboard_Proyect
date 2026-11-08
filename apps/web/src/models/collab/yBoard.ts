/**
 * Board <-> Yjs document mapping for team boards.
 *
 * Why a CRDT: two people editing at the same time (like Figma) must never
 * overwrite each other. Yjs merges concurrent edits field by field, in any
 * order, and every peer ends with the same board.
 *
 * Document shape (root map "board"):
 *   meta fields (id, name, profile, …)   plain values
 *   labels                               JSON array (small, last writer wins)
 *   columns: Y.Array<Y.Map>              id, title, wipLimit, cards
 *     cards: Y.Array<Y.Map>              one map per card, one key per field
 *
 * The app keeps using its pure board operations. `writeBoard` reconciles the
 * document to the new board with a minimal diff, so the rest of the code does
 * not know Yjs exists.
 */
import * as Y from 'yjs';
import { BoardSchema, type Board, type Card, type Column } from '@devbord/shared';

const META_KEYS = [
  'id',
  'name',
  'profile',
  'mode',
  'shareKey',
  'templateId',
  'cardTemplate',
  'nextNumber',
  'createdAt',
  'updatedAt',
] as const;

type Plain = Record<string, unknown>;
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** Sets only the keys whose value changed (unchanged keys create no CRDT ops). */
function patchMap(map: Y.Map<unknown>, values: Plain, skip: readonly string[] = []) {
  for (const [key, value] of Object.entries(values)) {
    if (skip.includes(key)) continue;
    if (!same(map.get(key), value)) map.set(key, value);
  }
}

/**
 * Makes `arr` match `items` (by id, in order). Changed fields are patched in
 * place; moves are delete + insert, which is the simple, safe option in Yjs.
 */
function reconcile<T extends { id: string }>(
  arr: Y.Array<Y.Map<unknown>>,
  items: readonly T[],
  build: (item: T) => Y.Map<unknown>,
  update: (map: Y.Map<unknown>, item: T) => void,
) {
  const wanted = new Set(items.map((i) => i.id));
  for (let i = arr.length - 1; i >= 0; i--) {
    if (!wanted.has(arr.get(i).get('id') as string)) arr.delete(i, 1);
  }
  items.forEach((item, i) => {
    const current = i < arr.length ? arr.get(i) : undefined;
    if (current?.get('id') === item.id) {
      update(current, item);
      return;
    }
    // Item exists further down (it moved): remove the old copy first.
    for (let j = i + 1; j < arr.length; j++) {
      if (arr.get(j).get('id') === item.id) {
        arr.delete(j, 1);
        break;
      }
    }
    arr.insert(i, [build(item)]);
  });
}

const buildCard = (card: Card) => {
  const map = new Y.Map<unknown>();
  patchMap(map, card as unknown as Plain);
  return map;
};

const buildColumn = (column: Column) => {
  const map = new Y.Map<unknown>();
  patchMap(map, column as unknown as Plain, ['cards']);
  const cards = new Y.Array<Y.Map<unknown>>();
  cards.insert(0, column.cards.map(buildCard));
  map.set('cards', cards);
  return map;
};

const rootOf = (doc: Y.Doc) => doc.getMap<unknown>('board');

/** Writes `board` into the document as one transaction tagged with `origin`. */
export function writeBoard(doc: Y.Doc, board: Board, origin: unknown = 'local') {
  doc.transact(() => {
    const root = rootOf(doc);
    patchMap(root, Object.fromEntries(META_KEYS.map((k) => [k, board[k]])));
    if (!same(root.get('labels'), board.labels)) root.set('labels', board.labels);

    let columns = root.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
    if (!columns) {
      columns = new Y.Array();
      root.set('columns', columns);
    }
    reconcile(columns, board.columns, buildColumn, (map, column) => {
      patchMap(map, column as unknown as Plain, ['cards']);
      reconcile(map.get('cards') as Y.Array<Y.Map<unknown>>, column.cards, buildCard, (cm, card) =>
        patchMap(cm, card as unknown as Plain),
      );
    });
  }, origin);
}

/**
 * Reads the board out of the document. Returns null while the document is
 * still empty (e.g. a teammate joining before the first sync) or invalid.
 */
export function readBoard(doc: Y.Doc): Board | null {
  const root = rootOf(doc);
  if (!root.has('id')) return null;

  // Two people moving the same card at once can leave two copies of it:
  // keep the first one, so a card is never shown twice.
  const seen = new Set<string>();
  const columns = ((root.get('columns') as Y.Array<Y.Map<unknown>> | undefined)?.toArray() ?? [])
    .map((col) => {
      const json = col.toJSON() as Plain;
      return {
        ...json,
        id: json.id as string,
        cards: ((col.get('cards') as Y.Array<Y.Map<unknown>>)?.toArray() ?? [])
          .map((c) => c.toJSON() as Plain)
          .filter((c) => !seen.has(c.id as string) && seen.add(c.id as string)),
      };
    })
    .filter((col) => !seen.has(`col:${col.id as string}`) && seen.add(`col:${col.id as string}`));

  const raw = {
    ...Object.fromEntries(META_KEYS.map((k) => [k, root.get(k)])),
    labels: root.get('labels') ?? [],
    columns,
  };
  const parsed = BoardSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
