import { useState } from 'react';
import {
  CardTypeSchema,
  PrioritySchema,
  type Card,
  type CardPatch,
  type Label,
  type ProfileFeatures,
} from '@devbord/shared';
import { Badge, Button, Field, Input, Modal, Select, Textarea, cx } from '../../design';
import { CARD_TYPE_META, PRIORITY_META } from './cardMeta';

export interface CardDetailModalProps {
  card: Card | null;
  columnTitle?: string;
  labels: Label[];
  features: ProfileFeatures;
  onClose: () => void;
  onSave: (cardId: string, patch: CardPatch) => void;
  onDelete: (cardId: string) => void;
}

/**
 * Card detail editor. Edits a local draft and saves on "Guardar", so the
 * board does not re-render on every keystroke.
 */
export function CardDetailModal({ card, ...rest }: CardDetailModalProps) {
  // `key` resets the draft whenever a different card is opened.
  return (
    <Modal open={card !== null} title="Detalle de la tarjeta" onClose={rest.onClose}>
      {card && <CardForm key={card.id} card={card} {...rest} />}
    </Modal>
  );
}

function CardForm({
  card,
  columnTitle,
  labels,
  features,
  onClose,
  onSave,
  onDelete,
}: Omit<CardDetailModalProps, 'card'> & { card: Card }) {
  const [draft, setDraft] = useState<CardPatch>({
    title: card.title,
    description: card.description,
    labelIds: card.labelIds,
    dueDate: card.dueDate,
    type: card.type,
    priority: card.priority,
  });
  const set = (patch: CardPatch) => setDraft((d) => ({ ...d, ...patch }));
  const labelIds = draft.labelIds ?? [];
  const canSave = Boolean(draft.title?.trim());

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSave) return;
        onSave(card.id, { ...draft, title: draft.title!.trim() });
        onClose();
      }}
    >
      {columnTitle && (
        <p className="-mt-2 text-sm text-muted">
          En <strong className="text-ink">{columnTitle}</strong>
        </p>
      )}

      <Field label="Título" htmlFor="card-title">
        <Input
          id="card-title"
          required
          maxLength={200}
          value={draft.title ?? ''}
          onChange={(e) => set({ title: e.target.value })}
        />
      </Field>

      <Field label="Descripción" htmlFor="card-description">
        <Textarea
          id="card-description"
          placeholder="Añade más detalles…"
          value={draft.description ?? ''}
          onChange={(e) => set({ description: e.target.value })}
        />
      </Field>

      {labels.length > 0 && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
            Etiquetas
          </legend>
          <div className="flex flex-wrap gap-2">
            {labels.map((l) => {
              const active = labelIds.includes(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    set({
                      labelIds: active ? labelIds.filter((id) => id !== l.id) : [...labelIds, l.id],
                    })
                  }
                  className={cx('transition-opacity', !active && 'opacity-45 hover:opacity-80')}
                >
                  <Badge color={l.color} className={active ? 'pixel-border' : undefined}>
                    {l.name}
                  </Badge>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Fecha límite" htmlFor="card-due">
          <Input
            id="card-due"
            type="date"
            value={draft.dueDate ?? ''}
            onChange={(e) => set({ dueDate: e.target.value || null })}
          />
        </Field>
        {features.cardTypes && (
          <Field label="Tipo" htmlFor="card-type">
            <Select
              id="card-type"
              value={draft.type}
              onChange={(e) => set({ type: CardTypeSchema.parse(e.target.value) })}
            >
              {CardTypeSchema.options.map((t) => (
                <option key={t} value={t}>
                  {CARD_TYPE_META[t].label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {features.priority && (
          <Field label="Prioridad" htmlFor="card-priority">
            <Select
              id="card-priority"
              value={draft.priority ?? ''}
              onChange={(e) =>
                set({ priority: e.target.value ? PrioritySchema.parse(e.target.value) : null })
              }
            >
              <option value="">Sin prioridad</option>
              {PrioritySchema.options.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_META[p].label}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      <footer className="mt-2 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          className="text-danger hover:text-danger"
          onClick={() => {
            if (window.confirm('¿Eliminar esta tarjeta?')) {
              onDelete(card.id);
              onClose();
            }
          }}
        >
          Eliminar
        </Button>
        <div className="flex gap-2">
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={!canSave}>
            Guardar
          </Button>
        </div>
      </footer>
    </form>
  );
}
