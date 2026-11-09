/**
 * Floating bar shown while cards are selected: how many, "Mover a…" any
 * column (handy when the target column is far away or off screen), and clear.
 */
import { useEffect, useRef } from 'react';
import type { Board } from '@devbord/shared';
import { useBoardController } from '../../controllers/boardController';
import { orderedSelection, useSelection } from '../../controllers/selectionController';
import { IconButton, PixelIcon, animateIn, animateLand } from '../../design';

export function SelectionBar({ board }: { board: Board }) {
  const ids = useSelection((s) => s.ids);
  const selected = orderedSelection(board, ids);
  const barRef = useRef<HTMLDivElement>(null);
  const visible = selected.length > 0;

  useEffect(() => {
    if (visible) animateIn(barRef.current);
  }, [visible]);

  if (!visible) return null;

  const moveTo = (columnId: string) => {
    const column = board.columns.find((c) => c.id === columnId);
    if (!column) return;
    // Append at the end of the target column (its length without the moved cards).
    const staying = column.cards.filter((c) => !ids.has(c.id)).length;
    useBoardController.getState().moveCards(board.id, selected, columnId, staying);
    requestAnimationFrame(() =>
      selected.forEach((id) =>
        animateLand(
          document.querySelector(`[data-flip-id="${CSS.escape(id)}"]`)?.firstElementChild,
        ),
      ),
    );
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-4">
      <div
        ref={barRef}
        role="toolbar"
        aria-label="Tarjetas seleccionadas"
        className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-line-soft bg-card py-1.5 pr-1.5 pl-3 shadow-lift"
      >
        <span className="grid h-6 min-w-6 place-items-center rounded-lg bg-accent px-1.5 text-sm text-accent-ink tabular-nums">
          {selected.length}
        </span>
        <span className="text-sm">
          {selected.length === 1 ? 'tarjeta seleccionada' : 'tarjetas seleccionadas'}
        </span>
        <span className="relative inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-soft bg-surface-2 px-2.5 text-sm hover:bg-surface-3">
          <PixelIcon name="board" size={12} />
          Mover a…
          <PixelIcon name="chevron" size={12} />
          <select
            aria-label="Mover las tarjetas seleccionadas a la columna"
            className="absolute inset-0 cursor-pointer opacity-0"
            value=""
            onChange={(e) => moveTo(e.target.value)}
          >
            <option value="" disabled>
              Mover a…
            </option>
            {board.columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </span>
        <IconButton
          icon="close"
          label="Quitar selección (Esc)"
          onClick={() => useSelection.getState().clear()}
        />
      </div>
    </div>
  );
}
