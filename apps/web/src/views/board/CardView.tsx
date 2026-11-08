import { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card, Label, ProfileFeatures } from '@devbord/shared';
import { Badge, PixelIcon, cx } from '../../design';
import { CARD_TYPE_META, PRIORITY_META, describeDueDate, previewText } from './cardMeta';

export interface CardViewProps {
  card: Card;
  labels: Label[];
  features: ProfileFeatures;
  onOpen?: (cardId: string) => void;
  /** Rendered inside the DragOverlay (no sortable wiring, lifted look). */
  overlay?: boolean;
}

/**
 * Visual body of a card, shared by the sortable item and the drag overlay.
 * Layout follows the mockups: labels, title, two-line description, then a
 * meta row (type, priority, due date).
 */
export function CardFace({ card, labels, features, overlay }: Omit<CardViewProps, 'onOpen'>) {
  const cardLabels = labels.filter((l) => card.labelIds.includes(l.id));
  const due = card.dueDate ? describeDueDate(card.dueDate) : null;
  const showType = features.cardTypes && card.type !== 'task';
  const showPriority = features.priority && card.priority;
  const showPoints = features.agile && card.storyPoints !== null;
  const showMeta = showType || showPriority || showPoints || due;

  return (
    <div
      className={cx(
        'flex flex-col gap-2 rounded-lg border border-line-soft bg-card p-3 text-left shadow-card',
        'transition-[box-shadow,border-color] duration-150 group-hover/card:border-line',
        // Lifted card: tilted and floating, like picking up a paper card.
        overlay && 'scale-[1.02] rotate-[2.5deg] shadow-lift',
      )}
    >
      {cardLabels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {cardLabels.map((l) => (
            <Badge key={l.id} color={l.color}>
              {l.name}
            </Badge>
          ))}
        </div>
      )}
      <p className="text-[14px] leading-snug font-semibold break-words">{card.title}</p>
      {card.description && (
        <p className="line-clamp-2 text-[13px] leading-snug break-words text-muted">
          {previewText(card.description)}
        </p>
      )}
      {showMeta && (
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 border-t border-line-soft pt-2 text-xs">
          {showType && (
            <Badge color={CARD_TYPE_META[card.type].color}>{CARD_TYPE_META[card.type].label}</Badge>
          )}
          {showPriority && card.priority && (
            <Badge color={PRIORITY_META[card.priority].color}>
              {PRIORITY_META[card.priority].label}
            </Badge>
          )}
          {showPoints && (
            // Pixel "die" with the estimate, the usual place for points in Scrum boards.
            <span
              className="grid h-5 min-w-5 place-items-center rounded-md border border-line px-1 text-[11px] font-semibold text-ink tabular-nums"
              title={`${card.storyPoints} story points`}
            >
              {card.storyPoints}
            </span>
          )}
          {due && (
            <span
              className={cx(
                'ml-auto inline-flex items-center gap-1 tabular-nums',
                due.overdue ? 'font-semibold text-danger' : 'text-muted',
              )}
            >
              <PixelIcon name="calendar" size={12} />
              {due.text}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Sortable card. The whole card is the drag handle for pointer users.
 * Keyboard: Space starts dragging (dnd-kit), Enter opens the detail.
 */
export const CardView = memo(function CardView({ card, labels, features, onOpen }: CardViewProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card' },
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="group/card list-none"
    >
      <div
        {...attributes}
        {...listeners}
        aria-roledescription="tarjeta"
        aria-label={card.title}
        onClick={() => !isDragging && onOpen?.(card.id)}
        onKeyDown={(e) => {
          // Enter also drops a keyboard drag; only open when not dragging.
          if (e.key === 'Enter') {
            if (!isDragging) onOpen?.(card.id);
          } else listeners?.onKeyDown?.(e);
        }}
        className="relative cursor-grab touch-manipulation rounded-lg"
      >
        {/* While lifted, the slot shows an empty "drop here" shape of the same size. */}
        <div className={cx(isDragging && 'invisible')}>
          <CardFace card={card} labels={labels} features={features} />
        </div>
        {isDragging && (
          <div
            aria-hidden
            className="absolute inset-0 rounded-lg border-2 border-dashed border-line bg-surface-3/60"
          />
        )}
      </div>
    </li>
  );
});
