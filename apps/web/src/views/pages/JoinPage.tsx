import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { PixelIcon } from '../../design';
import { canAddBoard, useBoardController } from '../../controllers/boardController';
import { MAX_ACTIVE_BOARDS } from '@devbord/shared';
import { useCollab } from '../../controllers/collabController';
import { AppShell } from '../components/AppShell';
import { NamePrompt } from '../team/NamePrompt';

/** After this long without data, explain that someone must have the board open. */
const SLOW_AFTER_MS = 15000;

/**
 * Invite link landing (`#/join/:boardId/:key`): connects to the team room and
 * waits until a teammate sends the board, then opens it.
 */
export function JoinPage() {
  const { boardId = '', key = '' } = useParams();
  const arrived = useBoardController((s) => s.boards.some((b) => b.id === boardId));
  // No room for one more board: joining would bring a board we cannot keep.
  const full = useBoardController((s) => !canAddBoard(s.boards));
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (arrived || full || !boardId || !key) return;
    void useCollab.getState().join(boardId, key);
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [arrived, full, boardId, key]);

  // The board page reopens the same room; leaving here before that would drop it.
  if (arrived) return <Navigate to={`/b/${boardId}`} replace />;

  return (
    <AppShell>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <PixelIcon name="team" size={48} />
        {full ? (
          <>
            <h1 className="text-2xl">No caben más tableros</h1>
            <p className="text-muted" role="status">
              Tienes {MAX_ACTIVE_BOARDS} tableros activos, el máximo. Archiva o elimina uno y vuelve
              a abrir el enlace de invitación.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl">Uniéndote al tablero…</h1>
            <p className="text-muted" role="status">
              {slow
                ? 'Todavía nadie del equipo tiene el tablero abierto. Déjalo en esta página: entrarás en cuanto alguien lo abra.'
                : 'Buscando a tu equipo. Tarda unos segundos.'}
            </p>
          </>
        )}
        <Link to="/" className="text-sm text-accent hover:underline">
          Volver a mis tableros
        </Link>
      </main>
      <NamePrompt />
    </AppShell>
  );
}
