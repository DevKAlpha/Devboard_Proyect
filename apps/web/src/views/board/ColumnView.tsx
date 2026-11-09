import { memo, useEffect, useRef } from 'react';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { isOverWip, type Column, type Label, type ProfileFeatures } from '@devbord/shared';
import { IconButton, PixelIcon, animateShake, confirm, cx } from '../../design';
import { cardMood, describeMood } from './cardMood';
import { CardView } from './CardView';
import { ColumnSprite, Snowfall, StatusRing } from './ColumnDecor';
import { columnKind } from './columnKind';
import { Composer } from './Composer';
import { InlineEdit } from './InlineEdit';

export interface ColumnViewProps {
  column: Column;
  labels: Label[];
  features: ProfileFeatures;
  onRename: (columnId: string, title: string) => void;
  onRemove: (columnId: string) => void;
  onAddCard: (columnId: string, title: string) => void;
  onOpenCard: (cardId: string) => void;
  onSelectCard: (cardId: string, mode: 'toggle' | 'range') => void;
  onWipLimit: (columnId: string, wipLimit: number | null) => void;
  onDescribe: (columnId: string, description: string) => void;
  /** Last column (Done): its cards never gather cobwebs. */
  isLastColumn?: boolean;
  /** Shared clock (ms) for card moods; see useNow. */
  now: number;
}

const WIP_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10];

/**
 * Card count with the Lean WIP limit ("2/3"). The chip is also the editor: a
 * transparent native <select> sits on top, so it is keyboard and screen-reader
 * friendly without extra UI.
 */
function WipChip({
  column,
  onChange,
}: {
  column: Column;
  onChange: (limit: number | null) => void;
}) {
  const over = isOverWip(column);
  const count = column.cards.length;
  return (
    <span
      className={cx(
        'relative grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums',
        over ? '' : 'bg-surface-3 text-muted hover:text-ink',
      )}
      style={over ? { background: 'var(--label-red)', color: 'var(--label-red-ink)' } : undefined}
    >
      {column.wipLimit === null ? count : `${count}/${column.wipLimit}`}
      <select
        aria-label={`Límite WIP de ${column.title}${over ? ' (superado)' : ''}`}
        className="absolute inset-0 cursor-pointer opacity-0"
        value={column.wipLimit ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">Sin límite WIP</option>
        {WIP_OPTIONS.map((n) => (
          <option key={n} value={n}>
            WIP {n}
          </option>
        ))}
      </select>
    </span>
  );
}

/**
 * One Kanban column. The column itself is sortable (drag by the grip) and is
 * also the drop target for cards, so empty columns still accept drops.
 */
export const ColumnView = memo(function ColumnView({
  column,
  labels,
  features,
  onRename,
  onRemove,
  onAddCard,
  onOpenCard,
  onSelectCard,
  onWipLimit,
  onDescribe,
  isLastColumn = false,
  now,
}: ColumnViewProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id, data: { type: 'column' } });
  const points = column.cards.reduce((sum, c) => sum + (c.storyPoints ?? 0), 0);
  const overWip = isOverWip(column);
  const kind = columnKind(column.title, isLastColumn);

  // Shake once when the column crosses its WIP limit (not on every render).
  const headerRef = useRef<HTMLElement>(null);
  const wasOver = useRef(overWip);
  useEffect(() => {
    if (overWip && !wasOver.current) animateShake(headerRef.current);
    wasOver.current = overWip;
  }, [overWip]);

  return (
    <section
      ref={setNodeRef}
      data-flip-id={`col:${column.id}`}
      aria-label={`Columna ${column.title}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cx(
        // *:relative keeps the content above decorative layers (icebox snowfall).
        'kb-col group/col relative flex max-h-full w-[min(320px,85vw)] shrink-0 snap-start flex-col gap-3 rounded-xl bg-surface-2 p-2.5 *:relative',
        // Over the WIP limit: a visible but calm signal to finish before starting more.
        overWip && 'shadow-[inset_0_0_0_2px_var(--label-red-ink)]',
        isDragging && 'opacity-50',
      )}
    >
      {kind === 'icebox' && <Snowfall />}
      {/* GitHub Projects-style header: status ring, name, count/WIP, estimate, then the column's sprite. */}
      <header ref={headerRef} className="flex flex-col gap-0.5 px-1">
        <div className="flex items-center gap-1.5">
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Mover columna ${column.title}`}
            className="-ml-1 cursor-grab rounded-md p-0.5 text-faint hover:text-ink"
          >
            <PixelIcon name="grip" size={12} />
          </button>
          <StatusRing kind={kind} />
          <InlineEdit
            value={column.title}
            label="Nombre de la columna"
            maxLength={60}
            onSave={(title) => onRename(column.id, title)}
            className="min-w-0 font-pixel text-base"
          />
          {features.agile ? (
            <WipChip column={column} onChange={(limit) => onWipLimit(column.id, limit)} />
          ) : (
            // Count chip, as in the mockups ("To Do ④").
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-surface-3 px-1.5 text-[11px] font-semibold text-muted tabular-nums">
              {column.cards.length}
            </span>
          )}
          {features.agile && (
            <span
              className="shrink-0 rounded-full border border-line px-1.5 py-px text-[10px] text-muted tabular-nums"
              title="Estimación total de la columna (story points)"
            >
              Est. {points}
            </span>
          )}
          <span className="flex-1" />
          <ColumnSprite kind={kind} />
          <IconButton
            icon="trash"
            // Quiet until the column is hovered or focused: less noise, same reach.
            // Hidden (no space taken) until the column is hovered or has focus inside.
            className="hidden! group-focus-within/col:inline-flex! group-hover/col:inline-flex!"
            label={`Eliminar columna ${column.title}`}
            onClick={() => {
              const msg = column.cards.length
                ? `¿Eliminar "${column.title}" y sus ${column.cards.length} tarjetas?`
                : `¿Eliminar "${column.title}"?`;
              void confirm(msg, { confirmLabel: 'Eliminar', danger: true }).then(
                (ok) => ok && onRemove(column.id),
              );
            }}
          />
        </div>
        <InlineEdit
          value={column.description ?? ''}
          placeholder="Añadir descripción"
          label="Descripción de la columna"
          maxLength={140}
          onSave={(text) => onDescribe(column.id, text)}
          className={cx(
            'pl-5 text-xs text-muted',
            // The empty placeholder only shows on hover: calm columns by default.
            !column.description &&
              'opacity-0 group-hover/col:opacity-100 focus-visible:opacity-100',
          )}
        />
      </header>

      <SortableContext items={column.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul className="-mx-1 flex min-h-8 flex-col gap-2.5 overflow-y-auto px-1 py-1">
          {column.cards.map((card) => {
            const mood = cardMood(card, column, isLastColumn, now);
            return (
              <CardView
                key={card.id}
                card={card}
                labels={labels}
                features={features}
                onOpen={onOpenCard}
                onSelect={onSelectCard}
                mood={mood}
                moodLabel={describeMood(mood, card, now)}
              />
            );
          })}
        </ul>
      </SortableContext>

      <Composer
        triggerLabel="Añadir tarjeta"
        placeholder="¿Qué hay que hacer?"
        submitLabel="Añadir"
        onSubmit={(title) => onAddCard(column.id, title)}
      />
    </section>
  );
});
