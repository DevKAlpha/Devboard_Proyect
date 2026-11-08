import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { PROFILE_FEATURES, findCard, moveCard, type Board } from '@devbord/shared';
import { useBoardController } from '../../controllers/boardController';
import { useCursorController } from '../../controllers/cursorController';
import { useCollab } from '../../controllers/collabController';
import { animateLand, animateOut, flip } from '../../design';
import { RemoteCursors } from '../team/RemoteCursors';
import { useNow } from './useNow';
import { CardDetailModal } from './CardDetailModal';
import { CardFace } from './CardView';
import { ColumnView } from './ColumnView';
import { Composer } from './Composer';

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
/** Finds a card or column element on the canvas by its FLIP id. */
const flipNode = (id: string) => document.querySelector(`[data-flip-id="${CSS.escape(id)}"]`);

/** The pixel cursor shows the grabbing hand and the destination column during drags. */
const cursor = () => useCursorController.getState();

export function BoardCanvas({ board, team = false }: { board: Board; team?: boolean }) {
  const [draft, setDraft] = useState<Board | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const now = useNow();

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
    setActiveId(String(active.id));
    if (kindOf(active.data) === 'card') {
      setDraft(board);
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
      if (final) {
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
          onPointerMove={
            team
              ? (e) => {
                  const el = e.currentTarget;
                  const rect = el.getBoundingClientRect();
                  useCollab.getState().setCursor({
                    x: Math.round(e.clientX - rect.left + el.scrollLeft),
                    y: Math.round(e.clientY - rect.top + el.scrollTop),
                  });
                }
              : undefined
          }
          onPointerLeave={team ? () => useCollab.getState().setCursor(null) : undefined}
        >
          {team && <RemoteCursors />}
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

        <DragOverlay>
          {activeCard && (
            <CardFace card={activeCard} labels={board.labels} features={features} overlay />
          )}
        </DragOverlay>
      </DndContext>

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
