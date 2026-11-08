import { useState } from 'react';
import type { Board } from '@devbord/shared';
import { Button, Field, Modal, Select } from '../../design';
import { useBoardController } from '../../controllers/boardController';
import { previewText } from './cardMeta';

export interface ImportCardsModalProps {
  open: boolean;
  /** Board that receives the cards. */
  board: Board;
  onClose: () => void;
}

/**
 * "Traer historias": pick cards from any other board (any profile or
 * template) and copy or move them into a column of this board.
 */
export function ImportCardsModal({ open, board, onClose }: ImportCardsModalProps) {
  return (
    <Modal open={open} title="Traer historias de otro tablero" onClose={onClose}>
      {/* Remount on every open: a fresh selection each time. */}
      {open && <ImportForm board={board} onClose={onClose} />}
    </Modal>
  );
}

function ImportForm({ board, onClose }: Omit<ImportCardsModalProps, 'open'>) {
  // Select the stable array, then filter: a filtering selector would return a
  // new array on every store read and loop the render.
  const boards = useBoardController((s) => s.boards);
  const others = boards.filter((b) => b.id !== board.id);
  const [sourceId, setSourceId] = useState(others[0]?.id ?? '');
  const [columnId, setColumnId] = useState(board.columns[0]?.id ?? '');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [move, setMove] = useState(false);

  const source = others.find((b) => b.id === sourceId);
  const sourceCards = source?.columns.flatMap((c) => c.cards) ?? [];

  if (others.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted">
          Solo tienes este tablero. Crea otro para poder traer historias desde él.
        </p>
        <Button className="self-end" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    );
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = sourceCards.length > 0 && selected.size === sourceCards.length;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!selected.size || !columnId) return;
        useBoardController.getState().importCards({
          boardId: board.id,
          columnId,
          sourceBoardId: sourceId,
          cardIds: [...selected],
          move,
        });
        onClose();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Desde el tablero" htmlFor="import-source">
          <Select
            id="import-source"
            value={sourceId}
            onChange={(e) => {
              setSourceId(e.target.value);
              setSelected(new Set());
            }}
          >
            {others.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="A la columna" htmlFor="import-column">
          <Select id="import-column" value={columnId} onChange={(e) => setColumnId(e.target.value)}>
            {board.columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {/* min-w-0: fieldsets default to min-content width, which lets long text overflow. */}
      <fieldset className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center justify-between">
          <legend className="text-xs font-semibold tracking-wide text-muted uppercase">
            Historias ({selected.size}/{sourceCards.length})
          </legend>
          {sourceCards.length > 0 && (
            <button
              type="button"
              className="text-xs text-accent hover:underline"
              onClick={() =>
                setSelected(allSelected ? new Set() : new Set(sourceCards.map((c) => c.id)))
              }
            >
              {allSelected ? 'Quitar selección' : 'Seleccionar todas'}
            </button>
          )}
        </div>

        {sourceCards.length === 0 ? (
          <p className="rounded-lg bg-surface-2 p-4 text-center text-sm text-muted">
            Este tablero no tiene tarjetas.
          </p>
        ) : (
          <div className="flex max-h-72 flex-col gap-3 overflow-y-auto rounded-lg bg-surface-2 p-2">
            {source!.columns
              .filter((c) => c.cards.length > 0)
              .map((column) => (
                <div key={column.id} className="flex flex-col gap-1">
                  <p className="px-1 text-xs text-faint">{column.title}</p>
                  {column.cards.map((card) => (
                    <label
                      key={card.id}
                      className="flex cursor-pointer items-start gap-2.5 rounded-md border border-line-soft bg-card p-2 has-checked:border-accent"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 accent-[var(--accent)]"
                        checked={selected.has(card.id)}
                        onChange={() => toggle(card.id)}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="text-sm font-semibold break-words">{card.title}</span>
                        {card.description && (
                          <span className="truncate text-xs text-muted">
                            {previewText(card.description)}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              ))}
          </div>
        )}
      </fieldset>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-[var(--accent)]"
          checked={move}
          onChange={(e) => setMove(e.target.checked)}
        />
        Mover (quitarlas del tablero de origen)
      </label>

      <footer className="flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={selected.size === 0}>
          {move ? 'Mover' : 'Traer'} {selected.size || ''}{' '}
          {selected.size === 1 ? 'historia' : 'historias'}
        </Button>
      </footer>
    </form>
  );
}
