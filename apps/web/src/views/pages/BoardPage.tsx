import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { PROFILE_INFO, ProfileSchema } from '@devbord/shared';
import { Button, IconButton, PixelIcon, Select, confirm } from '../../design';
import { useBoard, useBoardController } from '../../controllers/boardController';
import { BoardCanvas } from '../board/BoardCanvas';
import { ExportMenu } from '../board/ExportMenu';
import { ImportCardsModal } from '../board/ImportCardsModal';
import { InlineEdit } from '../board/InlineEdit';
import { AppShell } from '../components/AppShell';
import { BoardSwitcher } from '../components/BoardSwitcher';

/** A single board: page header (name, card count, profile, delete) + Kanban canvas. */
export function BoardPage() {
  const { boardId } = useParams();
  const board = useBoard(boardId);
  const navigate = useNavigate();
  const { renameBoard, setProfile, deleteBoard } = useBoardController.getState();
  const [importing, setImporting] = useState(false);

  if (!board) return <Navigate to="/" replace />;
  const cardCount = board.columns.reduce((n, c) => n + c.cards.length, 0);

  return (
    <AppShell>
      <header className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-5 pb-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <BoardSwitcher currentId={board.id} />
          <div className="flex min-w-0 items-center gap-2">
            <InlineEdit
              value={board.name}
              label="Nombre del tablero"
              onSave={(name) => renameBoard(board.id, name)}
              className="min-w-0 truncate font-pixel text-2xl"
            />
            <span className="shrink-0 rounded-full bg-surface-3 px-2 py-0.5 text-xs text-muted tabular-nums">
              {cardCount}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="board-profile" className="text-xs text-muted">
            Estilo
          </label>
          <div className="w-36">
            <Select
              id="board-profile"
              className="h-8 text-sm"
              value={board.profile}
              onChange={(e) => setProfile(board.id, ProfileSchema.parse(e.target.value))}
            >
              {ProfileSchema.options.map((p) => (
                <option key={p} value={p}>
                  {PROFILE_INFO[p].title}
                </option>
              ))}
            </Select>
          </div>
          <ExportMenu board={board} />
          <Button size="sm" onClick={() => setImporting(true)}>
            <PixelIcon name="import" />
            Traer historias
          </Button>
          <IconButton
            icon="trash"
            label="Eliminar tablero"
            onClick={async () => {
              const ok = await confirm(
                `¿Eliminar el tablero "${board.name}"? No se puede deshacer.`,
                { confirmLabel: 'Eliminar', danger: true },
              );
              if (!ok) return;
              await deleteBoard(board.id);
              navigate('/', { replace: true });
            }}
          />
        </div>
      </header>

      <main className="mx-auto min-h-0 w-full max-w-[1600px] flex-1">
        {/* key: switching boards starts with a clean canvas (no open card or drag state). */}
        <BoardCanvas key={board.id} board={board} />
      </main>
      <ImportCardsModal open={importing} board={board} onClose={() => setImporting(false)} />
    </AppShell>
  );
}
