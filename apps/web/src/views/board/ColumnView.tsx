import { memo } from 'react';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Column, Label, ProfileFeatures } from '@devbord/shared';
import { IconButton, PixelIcon, cx } from '../../design';
import { CardView } from './CardView';
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

  return (
    <section
      ref={setNodeRef}
      aria-label={`Columna ${column.title}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cx(
        'flex max-h-full w-[min(300px,85vw)] shrink-0 snap-start flex-col gap-3 bg-surface-2 p-3 pixel-soft',
        isDragging && 'opacity-50',
      )}
    >
      <header className="flex items-center gap-1">
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Mover columna ${column.title}`}
          className="cursor-grab p-1 text-muted hover:text-ink"
        >
          <PixelIcon name="grip" />
        </button>
        <InlineEdit
          value={column.title}
          label="Nombre de la columna"
          maxLength={60}
          onSave={(title) => onRename(column.id, title)}
          className="flex-1 font-pixel text-base"
        />
        <span className="min-w-6 text-center text-xs text-muted tabular-nums">
          {column.cards.length}
        </span>
        <IconButton
          icon="trash"
          label={`Eliminar columna ${column.title}`}
          onClick={() => {
            const msg = column.cards.length
              ? `¿Eliminar "${column.title}" y sus ${column.cards.length} tarjetas?`
              : `¿Eliminar "${column.title}"?`;
            if (window.confirm(msg)) onRemove(column.id);
          }}
        />
      </header>

      <SortableContext items={column.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul className="-mx-1 flex min-h-8 flex-col gap-2.5 overflow-y-auto px-1 py-1">
          {column.cards.map((card) => (
            <CardView
              key={card.id}
              card={card}
              labels={labels}
              features={features}
              onOpen={onOpenCard}
            />
          ))}
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
