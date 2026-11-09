import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type Modifier,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { getEventCoordinates } from '@dnd-kit/utilities';
import { PROFILE_FEATURES, findCard, moveCard, type Board } from '@devbord/shared';
import { useBoardController } from '../../controllers/boardController';
import { useCursorController } from '../../controllers/cursorController';
import { useCollab } from '../../controllers/collabController';
import { orderedSelection, useSelection } from '../../controllers/selectionController';
import { animateLand, animateOut, flip } from '../../design';
import { RemoteCursors } from '../team/RemoteCursors';
import { useNow } from './useNow';
import './drag.css';
import { CardDetailModal } from './CardDetailModal';
import { CardFace } from './CardView';
import { ColumnView } from './ColumnView';
import { Composer } from './Composer';
import { SelectionBar } from './SelectionBar';

type DragKind = 'card' | 'column';
const kindOf = (data: { current?: Record<string, unknown> } | undefined): DragKind | undefined =>
  data?.current?.type as DragKind | undefined;

/**
 * Collision strategy:
 *  - columns: nearest column center (horizontal reorder),
 *  - cards: what is under the pointer, preferring cards over their column,
 *    falling back to the closest corners (keyboard drags have no pointer).
 */
const collisionDetection: CollisionDetection = (args) => {
  if (kindOf(args.active.data) === 'column') {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) => kindOf(c.data) === 'column'),
    });
  }
  const hits = pointerWithin(args);
  if (hits.length) {
    const cardHits = hits.filter(
      (h) => kindOf(args.droppableContainers.find((c) => c.id === h.id)?.data) === 'card',
    );
    return cardHits.length ? cardHits : hits;
  }
  return closestCorners(args);
};

/**
 * Interactive Kanban surface.
 *
 * While a card is dragged we work on a local `draft` copy of the board, so
 * cross-column previews are instant and storage is written only once, on drop.
 */
/** Actions are stable; reading them via getState() avoids subscribing this view to the whole store. */
const ctrl = () => useBoardController.getState();
/** Where the pixel hand holds a lifted card: near its top-left corner (px). */
const GRIP = { x: 8, y: 6 };

/**
 * Drag overlay modifier: wherever the card was grabbed, the lifted card is
 * placed so the hand sits on its top-left corner, like holding a paper card.
 * Keyboard drags have no pointer coordinates and are left untouched.
 */
const holdByCorner: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  const point = activatorEvent && getEventCoordinates(activatorEvent);
  if (!point || !draggingNodeRect) return transform;
  return {
    ...transform,
    x: transform.x + point.x - draggingNodeRect.left - GRIP.x,
    y: transform.y + point.y - draggingNodeRect.top - GRIP.y,
  };
};

/** Finds a card or column element on the canvas by its FLIP id. */
const flipNode = (id: string) => document.querySelector(`[data-flip-id="${CSS.escape(id)}"]`);

/** The pixel cursor shows the grabbing hand and the destination column during drags. */
const cursor = () => useCursorController.getState();
const selection = () => useSelection.getState();

/** Where a lasso can start: empty board or column background, never on a card or control. */
const NOT_LASSO =
  'li, button, input, textarea, select, a, header, form, label, [contenteditable="true"], [role="button"]';
/** Pointer travel (px) before a press on the background becomes a lasso. */
const LASSO_SLOP = 4;

const intersects = (a: DOMRect, b: { left: number; top: number; right: number; bottom: number }) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

export function BoardCanvas({ board, team = false }: { board: Board; team?: boolean }) {
  const [draft, setDraft] = useState<Board | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  /** Cards moved together with the dragged one (multi-select), in board order. */
  const [group, setGroup] = useState<string[] | null>(null);
  /** Lasso rectangle in board-content coordinates (scroll included). */
  const [lasso, setLasso] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const lassoStart = useRef<{ x: number; y: number; base: string[] } | null>(null);
  const now = useNow();
  const boardRef = useRef(board);
  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  // The selection belongs to this board: leaving it (or switching boards) clears it.
  useEffect(() => () => selection().clear(), []);
  // Esc drops the selection, unless a dialog is open (Esc closes that first).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) selection().clear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // FLIP: after every render, cards/columns that moved glide to their new spot and
  // new ones pop in. This animates local actions and teammates' changes alike.
  // Skipped mid-drag: dnd-kit animates the drag itself.
  const scrollRef = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    positions.current = flip(scrollRef.current, positions.current, { animate: activeId === null });
  });
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  const view = draft ?? board;
  const features = PROFILE_FEATURES[board.profile];

  const sensors = useSensors(
    // Small distance so a click still opens the card.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    // Long-press on touch so the board can still scroll horizontally.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Enter is reserved for "open card"; Space picks up and drops.
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  );

  /** Column that contains `id`, whether `id` is a column or a card. */
  const columnOf = useCallback(
    (b: Board, id: string) => b.columns.find((c) => c.id === id) ?? findCard(b, id)?.column ?? null,
    [],
  );

  const onDragStart = ({ active }: DragStartEvent) => {
    const id = String(active.id);
    setActiveId(id);
    if (kindOf(active.data) === 'card') {
      const ids = selection().ids;
      if (ids.has(id) && ids.size > 1) {
        // Multi-drag: the other selected cards fold into the lifted stack, and
        // the board previews only the dragged one moving.
        const together = orderedSelection(board, ids);
        const others = new Set(together.filter((x) => x !== id));
        setGroup(together);
        setDraft({
          ...board,
          columns: board.columns.map((c) => ({
            ...c,
            cards: c.cards.filter((card) => !others.has(card.id)),
          })),
        });
      } else {
        // Dragging a card outside the selection moves that card alone.
        if (!ids.has(id)) selection().clear();
        setDraft(board);
      }
      cursor().drag(columnOf(board, String(active.id))?.title ?? null);
    } else cursor().drag(null);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || kindOf(active.data) !== 'card') return;
    cursor().drag(columnOf(draft ?? board, String(over.id))?.title ?? null);
    setDraft((current) => {
      const b = current ?? board;
      const from = columnOf(b, String(active.id));
      const to = columnOf(b, String(over.id));
      if (!from || !to || from.id === to.id) return current;
      // Hovering a card inserts before it; hovering the column appends.
      const overIndex = to.cards.findIndex((c) => c.id === over.id);
      return moveCard(b, String(active.id), to.id, overIndex === -1 ? to.cards.length : overIndex);
    });
  };

  const reset = () => {
    setDraft(null);
    setActiveId(null);
    setGroup(null);
    cursor().endDrag();
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const id = String(active.id);
    if (!over) return reset();

    if (kindOf(active.data) === 'column') {
      const toIndex = board.columns.findIndex((c) => c.id === over.id);
      if (toIndex !== -1) ctrl().moveColumn(board.id, id, toIndex);
      return reset();
    }

    // Card: resolve the final target from the drop point. The last dragOver may not
    // have fired (fast drags), so a cross-column move can still be pending here.
    let b = draft ?? board;
    const from = columnOf(b, id);
    const to = columnOf(b, String(over.id));
    if (from && to) {
      const overIndex = to.cards.findIndex((c) => c.id === over.id);
      const index =
        overIndex !== -1
          ? overIndex
          : from.id === to.id
            ? (findCard(b, id)?.index ?? 0) // dropped on own column: keep previewed slot
            : to.cards.length; // dropped on another column: append
      b = moveCard(b, id, to.id, index);
      const final = findCard(b, id);
      if (final && group) {
        // The draft column holds the cards that stay plus the dragged one, so
        // its index is the block position once the moved cards are taken out.
        ctrl().moveCards(board.id, group, final.column.id, final.index);
        requestAnimationFrame(() =>
          group.forEach((g) => animateLand(flipNode(g)?.firstElementChild)),
        );
      } else if (final) {
        ctrl().moveCard(board.id, id, final.column.id, final.index);
        // Squash when it lands (after React commits the new position).
        requestAnimationFrame(() => animateLand(flipNode(id)?.firstElementChild));
      }
    }
    reset();
  };

  const activeCard = activeId ? findCard(view, activeId)?.card : undefined;
  const openCard = openCardId ? findCard(board, openCardId) : null;
  const columnIds = useMemo(() => view.columns.map((c) => c.id), [view.columns]);

  // Stable callbacks keep memoized columns/cards from re-rendering on every drag frame.
  const onRename = useCallback(
    (columnId: string, title: string) => ctrl().renameColumn(board.id, columnId, title),
    [board.id],
  );
  const onRemove = useCallback(
    // Animate the column away first, then remove it from the board.
    (columnId: string) =>
      void animateOut(flipNode(`col:${columnId}`)).then(() =>
        ctrl().removeColumn(board.id, columnId),
      ),
    [board.id],
  );
  const onAddCard = useCallback(
    (columnId: string, title: string) => ctrl().addCard(board.id, columnId, title),
    [board.id],
  );
  const onDescribe = useCallback(
    (columnId: string, description: string) =>
      ctrl().setColumnDescription(board.id, columnId, description),
    [board.id],
  );
  /** Ctrl/Cmd+click toggles a card; Shift+click selects from the last clicked one (board order). */
  const onSelectCard = useCallback((cardId: string, mode: 'toggle' | 'range') => {
    if (mode === 'toggle') return selection().toggle(cardId);
    const order = boardRef.current.columns.flatMap((c) => c.cards.map((card) => card.id));
    const { anchor } = selection();
    const from = anchor ? order.indexOf(anchor) : -1;
    const to = order.indexOf(cardId);
    if (from === -1) return selection().toggle(cardId);
    selection().set(order.slice(Math.min(from, to), Math.max(from, to) + 1), true);
  }, []);

  // --- lasso: sweep the background to select every card it touches -------------
  const onLassoDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.pointerType !== 'mouse') return;
    if ((e.target as Element).closest(NOT_LASSO)) return;
    e.preventDefault(); // no text selection while sweeping
    e.currentTarget.setPointerCapture(e.pointerId);
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    lassoStart.current = { x: e.clientX, y: e.clientY, base: additive ? [...selection().ids] : [] };
  };

  const onLassoMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = lassoStart.current;
    if (!start) return;
    if (!lasso && Math.hypot(e.clientX - start.x, e.clientY - start.y) < LASSO_SLOP) return;
    const el = e.currentTarget;
    const origin = el.getBoundingClientRect();
    const rect = {
      left: Math.min(start.x, e.clientX),
      top: Math.min(start.y, e.clientY),
      right: Math.max(start.x, e.clientX),
      bottom: Math.max(start.y, e.clientY),
    };
    setLasso({
      x: rect.left - origin.left + el.scrollLeft,
      y: rect.top - origin.top + el.scrollTop,
      w: rect.right - rect.left,
      h: rect.bottom - rect.top,
    });
    const hits = [...el.querySelectorAll<HTMLElement>('li[data-flip-id]')]
      .filter((node) => intersects(node.getBoundingClientRect(), rect))
      .map((node) => node.dataset.flipId!);
    selection().set([...start.base, ...hits]);
  };

  const onLassoUp = () => {
    const start = lassoStart.current;
    if (!start) return;
    lassoStart.current = null;
    // A plain click on the background (no sweep) drops the selection.
    if (!lasso && start.base.length === 0) selection().clear();
    setLasso(null);
  };

  const onWipLimit = useCallback(
    (columnId: string, wipLimit: number | null) => ctrl().setWipLimit(board.id, columnId, wipLimit),
    [board.id],
  );

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={reset}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              'Pulsa Espacio para levantar. Usa las flechas para mover y Espacio para soltar. Escape cancela.',
          },
        }}
      >
        <div
          ref={scrollRef}
          className="relative flex h-full snap-x snap-mandatory items-start gap-4 overflow-x-auto px-4 pt-2 pb-6 sm:snap-none"
          // Team boards share the pointer position (content coordinates, scroll included).
          onPointerDown={onLassoDown}
          onPointerUp={onLassoUp}
          onPointerCancel={onLassoUp}
          onPointerMove={(e) => {
            onLassoMove(e);
            if (!team) return;
            const el = e.currentTarget;
            const rect = el.getBoundingClientRect();
            useCollab.getState().setCursor({
              x: Math.round(e.clientX - rect.left + el.scrollLeft),
              y: Math.round(e.clientY - rect.top + el.scrollTop),
            });
          }}
          onPointerLeave={team ? () => useCollab.getState().setCursor(null) : undefined}
        >
          {team && <RemoteCursors />}
          {lasso && (
            <div
              className="board-lasso"
              style={{ left: lasso.x, top: lasso.y, width: lasso.w, height: lasso.h }}
            />
          )}
          <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
            {view.columns.map((column, i) => (
              <ColumnView
                key={column.id}
                isLastColumn={i === view.columns.length - 1}
                now={now}
                column={column}
                labels={board.labels}
                features={features}
                onRename={onRename}
                onRemove={onRemove}
                onAddCard={onAddCard}
                onOpenCard={setOpenCardId}
                onSelectCard={onSelectCard}
                onWipLimit={onWipLimit}
                onDescribe={onDescribe}
              />
            ))}
          </SortableContext>

          <div className="w-[min(300px,85vw)] shrink-0 snap-start">
            <Composer
              triggerLabel="Añadir columna"
              placeholder="Nombre de la columna"
              submitLabel="Crear columna"
              onSubmit={(title) => ctrl().addColumn(board.id, title)}
            />
          </div>
        </div>

        <DragOverlay modifiers={[holdByCorner]}>
          {activeCard && (
            <div
              className="drag-jitter relative"
              style={{
                ['--grip-x' as string]: `${GRIP.x}px`,
                ['--grip-y' as string]: `${GRIP.y}px`,
              }}
            >
              {/* Several cards: sheets fanned out behind, and how many are travelling. */}
              {group && group.length > 1 && (
                <>
                  <div
                    className="drag-stack"
                    style={{ transform: 'translate(8px, 8px) rotate(5deg)' }}
                  />
                  {group.length > 2 && (
                    <div
                      className="drag-stack"
                      style={{ transform: 'translate(4px, 4px) rotate(3.5deg)' }}
                    />
                  )}
                  <span className="drag-count">{group.length}</span>
                </>
              )}
              <div className="relative">
                <CardFace card={activeCard} labels={board.labels} features={features} overlay />
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <SelectionBar board={board} />
      <CardDetailModal
        card={openCard?.card ?? null}
        columnTitle={openCard?.column.title}
        labels={board.labels}
        features={features}
        onClose={() => setOpenCardId(null)}
        onSave={(cardId, patch) => ctrl().updateCard(board.id, cardId, patch)}
        onDelete={(cardId) =>
          void animateOut(flipNode(cardId)).then(() => ctrl().removeCard(board.id, cardId))
        }
      />
    </>
  );
}
