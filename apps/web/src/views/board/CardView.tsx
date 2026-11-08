import { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card, Label, ProfileFeatures } from '@devbord/shared';
import { Badge, PixelIcon, cx } from '../../design';
import { CARD_TYPE_META, PRIORITY_META, describeDueDate } from './cardMeta';

export interface CardViewProps {
  card: Card;
  labels: Label[];
  features: ProfileFeatures;
  onOpen?: (cardId: string) => void;
  /** Rendered inside the DragOverlay (no sortable wiring, lifted look). */
  overlay?: boolean;
}

/** Visual body of a card, shared by the sortable item and the drag overlay. */
export function CardFace({ card, labels, features, overlay }: Omit<CardViewProps, 'onOpen'>) {
  const cardLabels = labels.filter((l) => card.labelIds.includes(l.id));
  const due = card.dueDate ? describeDueDate(card.dueDate) : null;
  const showMeta =
    (features.cardTypes && card.type !== 'task') || (features.priority && card.priority) || due;

  return (
    <div
      className={cx(
        'flex flex-col gap-2 bg-surface p-3 text-left pixel-raised',
        overlay && 'rotate-[1.5deg] cursor-grabbing',
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
      <p className="text-[15px] leading-snug break-words">{card.title}</p>
      {showMeta && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {features.cardTypes && card.type !== 'task' && (
            <Badge color={CARD_TYPE_META[card.type].color}>{CARD_TYPE_META[card.type].label}</Badge>
          )}
          {features.priority && card.priority && (
            <Badge color={PRIORITY_META[card.priority].color}>
              {PRIORITY_META[card.priority].label}
            </Badge>
          )}
          {due && (
            <span
              className={cx(
                'inline-flex items-center gap-1',
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
      className={cx('list-none', isDragging && 'opacity-40')}
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
        className="cursor-grab touch-manipulation"
      >
        <CardFace card={card} labels={labels} features={features} />
      </div>
    </li>
  );
});
