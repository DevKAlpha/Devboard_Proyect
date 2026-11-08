import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { PROFILE_INFO, ProfileSchema } from '@devbord/shared';
import { IconButton, PixelIcon, Select } from '../../design';
import { useBoard, useBoardController } from '../../controllers/boardController';
import { BoardCanvas } from '../board/BoardCanvas';
import { InlineEdit } from '../board/InlineEdit';
import { TopBar } from '../components/TopBar';

/** A single board: header (name, profile, delete) + Kanban canvas. */
export function BoardPage() {
  const { boardId } = useParams();
  const board = useBoard(boardId);
  const navigate = useNavigate();
  const { renameBoard, setProfile, deleteBoard } = useBoardController.getState();

  if (!board) return <Navigate to="/" replace />;

  return (
    <div className="flex h-full flex-col">
      <TopBar>
        <Link
          to="/"
          className="ml-2 hidden items-center gap-1 text-sm text-muted hover:text-ink sm:inline-flex"
        >
          <PixelIcon name="board" size={12} /> Tableros
        </Link>
        <span className="hidden text-muted sm:inline">/</span>
        <InlineEdit
          value={board.name}
          label="Nombre del tablero"
          onSave={(name) => renameBoard(board.id, name)}
          className="font-pixel text-base"
        />
      </TopBar>

      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-end gap-2 px-4 py-2">
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

      <main className="mx-auto min-h-0 w-full max-w-[1600px] flex-1">
        <BoardCanvas board={board} />
      </main>
    </div>
  );
}
