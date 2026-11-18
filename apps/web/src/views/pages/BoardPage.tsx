import { Suspense, lazy, useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { Button, IconButton, PixelIcon, confirm } from '../../design';
import { useBoard, useBoardController } from '../../controllers/boardController';
import { removeBoard } from '../../controllers/boardLifecycle';
import { ArchiveFullModal } from '../components/ArchiveFullModal';
import { BoardCanvas } from '../board/BoardCanvas';
import { ExportMenu } from '../board/ExportMenu';
import { ImportCardsModal } from '../board/ImportCardsModal';
import { JourneyModal } from '../board/JourneyModal';
import { ConnectionsModal } from '../connections/ConnectionsModal';
import { GithubBadge } from '../connections/GithubBadge';
import { useGithub } from '../../controllers/githubController';
import { InlineEdit } from '../board/InlineEdit';
import { AppShell } from '../components/AppShell';
import { BoardSwitcher } from '../components/BoardSwitcher';
import { useCollab } from '../../controllers/collabController';
import { useSketch } from '../../controllers/sketchController';
import { useThemeController } from '../../controllers/themeController';
import { usePreferences } from '../../controllers/preferencesController';
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
  const { renameBoard, archiveBoard } = useBoardController.getState();
  /** Archiving with the archive full: pick an archived board to delete first. */
  const [archiveFull, setArchiveFull] = useState(false);
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

  // Boards linked to a GitHub Project stay in sync while they are on screen.
  const linked = Boolean(board?.github);
  useEffect(() => {
    if (!linked || !boardId) return;
    return useGithub.getState().watch(boardId);
  }, [linked, boardId]);

  // The board's skin dresses the whole page while it is open; leaving restores the app look.
  const skin = board?.skin ?? 'default';
  // Effects use a block body: an effect that returns a value React cannot call
  // as a clean-up crashes the whole app when the page unmounts.
  useEffect(() => {
    useThemeController.getState().setSkin(skin);
  }, [skin]);
  // Our duck in the home bath dresses up for the last board we opened.
  useEffect(() => {
    usePreferences.getState().setLastSkin(skin);
  }, [skin]);
  useEffect(() => () => useThemeController.getState().setSkin('default'), []);

  // Leaving the board (or switching to another) closes its whiteboard.
  useEffect(() => () => useSketch.getState().hide(), [boardId]);

  // Archived boards are read-only: they live on home (download or delete), never here.
  if (!board || board.archivedAt) return <Navigate to="/" replace />;
  const cardCount = board.columns.reduce((n, c) => n + c.cards.length, 0);

  return (
    <AppShell>
      <SkinBackdrop skin={board.skin} />
      <header className="mx-auto flex w-full max-w-[1600px] flex-wrap items-end gap-x-4 gap-y-2 px-4 pt-5 pb-3">
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
            {board.github && <GithubBadge link={board.github} />}
          </div>
        </div>

        <div className="flex items-center gap-2">
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
          {/* Linked boards get their cards from GitHub, not from other boards. */}
          {!board.github && (
            <Button size="sm" onClick={() => setImporting(true)}>
              <PixelIcon name="import" />
              Traer historias
            </Button>
          )}
          <IconButton
            icon="archive"
            label="Archivar tablero"
            onClick={async () => {
              const ok = await confirm(
                `¿Archivar el tablero "${board.name}"? Pasará a Archivados: solo podrás descargarlo en JSON o eliminarlo, ya no editarlo.` +
                  (team
                    ? ' Se archiva solo en este navegador; tu equipo lo conserva.'
                    : board.github
                      ? ' El Project sigue en GitHub; DuckBord deja de sincronizarlo.'
                      : ''),
                { confirmLabel: 'Archivar' },
              );
              if (!ok) return;
              if (archiveBoard(board.id)) navigate('/', { replace: true });
              else setArchiveFull(true);
            }}
          />
          <IconButton
            icon="trash"
            label="Eliminar tablero"
            onClick={async () => {
              const ok = await confirm(
                team
                  ? `¿Salir del tablero de equipo "${board.name}"? Se borra solo de este navegador; tu equipo lo conserva.`
                  : board.github
                    ? `¿Quitar "${board.name}" de DuckBord? El Project y sus issues siguen en GitHub.`
                    : `¿Eliminar el tablero "${board.name}"? No se puede deshacer.`,
                { confirmLabel: 'Eliminar', danger: true },
              );
              if (!ok) return;
              await removeBoard(board);
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
      <ArchiveFullModal
        open={archiveFull}
        boardName={board.name}
        onClose={() => setArchiveFull(false)}
        onFreed={() => {
          setArchiveFull(false);
          archiveBoard(board.id);
          navigate('/', { replace: true });
        }}
      />
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
