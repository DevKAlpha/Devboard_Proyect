import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { PROFILE_INFO, ProfileSchema } from '@devbord/shared';
import { IconButton, PixelIcon, Select } from '../../design';
import { useBoard, useBoardController } from '../../controllers/boardController';
import { BoardCanvas } from '../board/BoardCanvas';
import { InlineEdit } from '../board/InlineEdit';
import { AppShell } from '../components/AppShell';

/** A single board: page header (name, card count, profile, delete) + Kanban canvas. */
export function BoardPage() {
  const { boardId } = useParams();
  const board = useBoard(boardId);
  const navigate = useNavigate();
  const { renameBoard, setProfile, deleteBoard } = useBoardController.getState();

  if (!board) return <Navigate to="/" replace />;
  const cardCount = board.columns.reduce((n, c) => n + c.cards.length, 0);

  return (
    <AppShell>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-soft px-5 py-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Link
            to="/"
            className="inline-flex w-fit items-center gap-1 text-xs text-muted hover:text-ink"
          >
            <PixelIcon name="board" size={12} /> Tableros
          </Link>
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
          <IconButton
            icon="trash"
            label="Eliminar tablero"
            onClick={async () => {
              if (!window.confirm(`¿Eliminar el tablero "${board.name}"? No se puede deshacer.`))
                return;
              await deleteBoard(board.id);
              navigate('/', { replace: true });
            }}
          />
        </div>
      </header>

      <main className="min-h-0 flex-1">
        <BoardCanvas board={board} />
      </main>
    </AppShell>
  );
}
