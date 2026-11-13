import { Suspense, lazy, useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { BoardSkinSchema, PROFILE_INFO, ProfileSchema } from '@devbord/shared';
import { Button, IconButton, PixelIcon, Select, confirm } from '../../design';
import { useBoard, useBoardController } from '../../controllers/boardController';
import { BoardCanvas } from '../board/BoardCanvas';
import { ExportMenu } from '../board/ExportMenu';
import { ImportCardsModal } from '../board/ImportCardsModal';
import { JourneyModal } from '../board/JourneyModal';
import { ConnectionsModal } from '../connections/ConnectionsModal';
import { InlineEdit } from '../board/InlineEdit';
import { AppShell } from '../components/AppShell';
import { BoardSwitcher } from '../components/BoardSwitcher';
import { useCollab } from '../../controllers/collabController';
import { useSketch } from '../../controllers/sketchController';
import { SKINS, useThemeController } from '../../controllers/themeController';
import { SkinBackdrop } from '../board/SkinBackdrop';
import { NamePrompt } from '../team/NamePrompt';
import { TeamBar } from '../team/TeamBar';

/** The whiteboard ships in its own chunk, loaded the first time it opens. */
const Whiteboard = lazy(() => import('../sketch/Whiteboard'));

/** A single board: page header (name, card count, profile, delete) + Kanban canvas. */
export function BoardPage() {
  const { boardId } = useParams();
  const board = useBoard(boardId);
  const navigate = useNavigate();
  const { renameBoard, setProfile, setSkin, deleteBoard } = useBoardController.getState();
  const [importing, setImporting] = useState(false);
  const [journey, setJourney] = useState(false);
  const [connections, setConnections] = useState(false);
  const team = board?.mode === 'team';
  const sketchOpen = useSketch((s) => s.open && s.boardId === boardId);

  // Team boards go live while they are on screen; leaving the page disconnects.
  useEffect(() => {
    if (!team || !boardId) return;
    const current = useBoardController.getState().boards.find((b) => b.id === boardId);
    if (current) void useCollab.getState().open(current);
    return () => useCollab.getState().close();
  }, [team, boardId]);

  // The board's skin dresses the whole page while it is open; leaving restores the app look.
  const skin = board?.skin ?? 'default';
  useEffect(() => useThemeController.getState().setSkin(skin), [skin]);
  useEffect(() => () => useThemeController.getState().setSkin('default'), []);

  // Leaving the board (or switching to another) closes its whiteboard.
  useEffect(() => () => useSketch.getState().hide(), [boardId]);

  if (!board) return <Navigate to="/" replace />;
  const cardCount = board.columns.reduce((n, c) => n + c.cards.length, 0);

  return (
    <AppShell>
      <SkinBackdrop skin={board.skin} />
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
          <label htmlFor="board-skin" className="text-xs text-muted">
            Tema
          </label>
          <div className="w-32">
            <Select
              id="board-skin"
              className="h-8 text-sm"
              value={board.skin}
              onChange={(e) => setSkin(board.id, BoardSkinSchema.parse(e.target.value))}
            >
              {BoardSkinSchema.options.map((s) => (
                <option key={s} value={s}>
                  {SKINS[s].title}
                </option>
              ))}
            </Select>
          </div>
          {team && <TeamBar board={board} />}
          <Button size="sm" onClick={() => useSketch.getState().show(board.id, team)}>
            <PixelIcon name="sketch" />
            Pizarra
          </Button>
          <Button size="sm" onClick={() => setJourney(true)}>
            <PixelIcon name="route" />
            Recorrido
          </Button>
          <Button size="sm" onClick={() => setConnections(true)}>
            <PixelIcon name="plug" />
            Conexiones
          </Button>
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
                team
                  ? `¿Salir del tablero de equipo "${board.name}"? Se borra solo de este navegador; tu equipo lo conserva.`
                  : `¿Eliminar el tablero "${board.name}"? No se puede deshacer.`,
                { confirmLabel: 'Eliminar', danger: true },
              );
              if (!ok) return;
              if (team) await useCollab.getState().forget(board.id);
              else await useSketch.getState().forget(board.id);
              await deleteBoard(board.id);
              navigate('/', { replace: true });
            }}
          />
        </div>
      </header>

      <main key={board.id} className="mx-auto min-h-0 w-full max-w-[1600px] flex-1 animate-page-in">
        {/* key: switching boards starts with a clean canvas (no open card or drag state). */}
        <BoardCanvas key={board.id} board={board} team={team} />
      </main>
      {team && <NamePrompt />}
      {sketchOpen && (
        <Suspense fallback={null}>
          <Whiteboard boardName={board.name} team={team} />
        </Suspense>
      )}
      <ImportCardsModal open={importing} board={board} onClose={() => setImporting(false)} />
      <JourneyModal open={journey} board={board} onClose={() => setJourney(false)} />
      <ConnectionsModal open={connections} board={board} onClose={() => setConnections(false)} />
    </AppShell>
  );
}
