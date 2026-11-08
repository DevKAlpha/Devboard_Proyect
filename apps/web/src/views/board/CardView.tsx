import { memo, useEffect, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card, Label, ProfileFeatures } from '@devbord/shared';
import { Badge, PixelIcon, animateFlash, cx } from '../../design';
import { CARD_TYPE_META, PRIORITY_META, describeDueDate, previewText } from './cardMeta';
import type { CardMood } from './cardMood';
import { MoodDecor } from './MoodDecor';

export interface CardViewProps {
  card: Card;
  labels: Label[];
  features: ProfileFeatures;
  onOpen?: (cardId: string) => void;
  /** Rendered inside the DragOverlay (no sortable wiring, lifted look). */
  overlay?: boolean;
  /** Flow state shown as pixel decorations (cobwebs, flames, frost). */
  mood?: CardMood;
  /** Text version of the mood, for the tooltip and screen readers. */
  moodLabel?: string | null;
}

/**
 * Visual body of a card, shared by the sortable item and the drag overlay.
 * Layout follows the mockups: labels, title, two-line description, then a
 * meta row (type, priority, due date).
 */
export function CardFace({
  card,
  labels,
  features,
  overlay,
  mood = null,
}: Omit<CardViewProps, 'onOpen' | 'moodLabel'>) {
  const cardLabels = labels.filter((l) => card.labelIds.includes(l.id));
  const due = card.dueDate ? describeDueDate(card.dueDate) : null;
  const showType = features.cardTypes && card.type !== 'task';
  const showPriority = features.priority && card.priority;
  const showPoints = features.agile && card.storyPoints !== null;
  const showSprint = features.agile && card.sprint;
  const showMeta = showType || showPriority || showPoints || showSprint || due;
  // GitHub-style issue reference ("#12") for technical boards.
  const showRef = features.devVocabulary && card.number !== null;

  return (
    <div
      className={cx(
        'relative flex flex-col gap-2 rounded-lg border border-line-soft bg-card p-3 text-left shadow-card',
        // Hover: lift 1px; press: sink back (tactile, transform only).
        'transition-[box-shadow,border-color,transform] duration-150 group-hover/card:-translate-y-px group-hover/card:border-line group-hover/card:shadow-lift group-active/card:translate-y-0',
        mood && `card-mood-${mood}`,
        // Lifted card: tilted and floating, like picking up a paper card.
        overlay && 'scale-[1.02] rotate-[2.5deg] shadow-lift',
      )}
    >
      <MoodDecor mood={mood} />
      {showRef && (
        <span className="flex items-center gap-1 text-[11px] text-muted">
          <PixelIcon name="issue" size={12} style={{ color: 'var(--label-green-ink)' }} />#
          {card.number}
        </span>
      )}
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
          {showPoints && (
            // Pixel "die" with the estimate, the usual place for points in Scrum boards.
            <span
              className="grid h-5 min-w-5 place-items-center rounded-md border border-line px-1 text-[11px] font-semibold text-ink tabular-nums"
              title={`${card.storyPoints} story points`}
            >
              {card.storyPoints}
            </span>
          )}
          {showType && (
            <Badge color={CARD_TYPE_META[card.type].color}>{CARD_TYPE_META[card.type].label}</Badge>
          )}
          {showPriority && card.priority && (
            <Badge color={PRIORITY_META[card.priority].color}>
              {PRIORITY_META[card.priority].label}
            </Badge>
          )}
          {showSprint && (
            // Iteration chip, like GitHub Projects ("↻ Sprint 1").
            <span className="inline-flex h-5 items-center gap-1 rounded-full border border-line px-1.5 text-[11px] text-muted">
              <PixelIcon name="iteration" size={10} />
              {card.sprint}
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
export const CardView = memo(function CardView({
  card,
  labels,
  features,
  onOpen,
  mood = null,
  moodLabel = null,
}: CardViewProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card' },
  });

  // Flash when the card's content changes (local edit or a teammate's), not on mount.
  const faceRef = useRef<HTMLDivElement>(null);
  const lastUpdate = useRef(card.updatedAt);
  useEffect(() => {
    if (lastUpdate.current === card.updatedAt) return;
    lastUpdate.current = card.updatedAt;
    animateFlash(faceRef.current?.firstElementChild);
  }, [card.updatedAt]);

  return (
    <li
      ref={setNodeRef}
      data-flip-id={card.id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="group/card list-none"
    >
      <div
        {...attributes}
        {...listeners}
        aria-roledescription="tarjeta"
        aria-label={moodLabel ? `${card.title}. ${moodLabel}` : card.title}
        // Shown by the pixel cursor as a pixel tooltip (native titles use the system font).
        data-cursor-hint={moodLabel ?? undefined}
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
        <div ref={faceRef} className={cx(isDragging && 'invisible')}>
          <CardFace card={card} labels={labels} features={features} mood={mood} />
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
