import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  MAX_ACTIVE_BOARDS,
  MAX_ARCHIVED_BOARDS,
  PROFILE_INFO,
  type Board,
} from '@devbord/shared';
import { Badge, Button, IconButton, PixelIcon, confirm } from '../../design';
import {
  activeBoards,
  archivedBoards,
  BoardLimitError,
  useBoardController,
} from '../../controllers/boardController';
import { removeBoard } from '../../controllers/boardLifecycle';
import { downloadBoardJson } from '../board/downloadBoard';
import { AppShell } from '../components/AppShell';
import { NewBoardModal } from '../components/NewBoardModal';
import { GithubProjectsModal } from '../connections/GithubProjectsModal';
import { BathCaption, BathScene } from '../components/BathScene';
import { SKINS } from '../../controllers/themeController';
import { BoardFileError, parseBoardFile } from '../../models/boardFile';

const updatedFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

/** Home: grid of the user's boards plus a "new board" entry point. */
export function BoardsPage() {
  const boards = useBoardController((s) => s.boards);
  const active = activeBoards(boards);
  const archived = archivedBoards(boards);
  /** At MAX_ACTIVE_BOARDS nothing new comes in: create, import and GitHub wait. */
  const full = active.length >= MAX_ACTIVE_BOARDS;
  const [creating, setCreating] = useState(false);
  const [fromGithub, setFromGithub] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  return (
    <AppShell>
      {/* The bathtub with everyone's rubber ducks, behind the whole page. */}
      <BathScene />
      <header className="mx-auto flex w-full max-w-5xl flex-wrap items-end justify-between gap-4 px-4 pt-8 pb-6">
        <div>
          <h1 className="text-3xl">Tus tableros</h1>
          <p className="mt-1 text-muted">Todo lo que tienes entre manos, en un vistazo.</p>
          <BathCaption />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={full} onClick={() => setFromGithub(true)}>
            <PixelIcon name="issue" />
            Conectar Project de GitHub
          </Button>
          <Button disabled={full} onClick={() => fileRef.current?.click()}>
            <PixelIcon name="upload" />
            Importar JSON
          </Button>
          <Button variant="primary" disabled={full} onClick={() => setCreating(true)}>
            <PixelIcon name="plus" />
            Nuevo tablero
          </Button>
        </div>
        {/* Hidden picker behind "Importar JSON". */}
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Archivo de tablero (JSON)"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = ''; // allow picking the same file again
            if (!file) return;
            try {
              const board = await useBoardController
                .getState()
                .addBoard(parseBoardFile(await file.text()));
              navigate(`/b/${board.id}`);
            } catch (err) {
              setImportError(
                err instanceof BoardFileError || err instanceof BoardLimitError
                  ? err.message
                  : 'No se pudo importar el archivo.',
              );
            }
          }}
        />
        {full && (
          <p role="status" className="w-full text-sm text-muted">
            Tienes {MAX_ACTIVE_BOARDS} de {MAX_ACTIVE_BOARDS} tableros activos. Archiva o elimina uno
            para crear, importar o conectar otro.
          </p>
        )}
        {importError && (
          <p
            role="alert"
            className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm"
            style={{ color: 'var(--label-red-ink)' }}
          >
            {importError}
          </p>
        )}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        {(['personal', 'team'] as const).map((mode) => {
          const list = active.filter((b) => b.mode === mode);
          if (!list.length) return null;
          return (
            <section key={mode} className="mx-auto flex max-w-5xl flex-col gap-3 px-4 pb-8">
              {/* Personal and team boards are listed apart: they never mix. */}
              <h2 className="flex items-center gap-2 text-sm text-muted">
                <PixelIcon name={mode === 'team' ? 'team' : 'board'} />
                {mode === 'team' ? 'Tableros de equipo' : 'Tableros individuales'}
              </h2>
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((b) => (
                  <BoardTile key={b.id} board={b} />
                ))}
              </ul>
            </section>
          );
        })}

        {archived.length > 0 && (
          <section className="mx-auto flex max-w-5xl flex-col gap-3 px-4 pb-8">
            {/* Read-only boards: download (JSON) or delete, never opened for editing. */}
            <h2 className="flex items-center gap-2 text-sm text-muted">
              <PixelIcon name="archive" />
              Archivados
              <span className="tabular-nums text-faint">
                {archived.length}/{MAX_ARCHIVED_BOARDS}
              </span>
            </h2>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {archived.map((b) => (
                <ArchivedTile key={b.id} board={b} />
              ))}
            </ul>
          </section>
        )}

        {active.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-muted">
            <PixelIcon name="board" size={48} />
            <p>Aún no tienes tableros. Crea el primero en segundos.</p>
          </div>
        )}
      </main>

      <NewBoardModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => navigate(`/b/${id}`)}
      />
      <GithubProjectsModal open={fromGithub} onClose={() => setFromGithub(false)} />
    </AppShell>
  );
}

/** One board in the home grid: mini preview, name, profile, activity and its look. */
function BoardTile({ board: b }: { board: Board }) {
  const cards = b.columns.reduce((n, c) => n + c.cards.length, 0);
  return (
    <li className="relative">
      <SkinChip board={b} />
      <Link
        to={`/b/${b.id}`}
        className="flex h-full flex-col gap-3 rounded-xl border border-line-soft bg-card p-4 shadow-card transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lift"
      >
        {/* Mini preview in the board's own colors: one bar per column, one block per card. */}
        <div
          className="flex h-14 gap-1.5 rounded-lg p-1.5"
          style={{ background: SKINS[b.skin].swatch.bg }}
          aria-hidden
        >
          {b.columns.slice(0, 6).map((c) => (
            <span key={c.id} className="flex flex-1 flex-col gap-1">
              {Array.from({ length: Math.min(4, c.cards.length) }, (_, i) => (
                <span
                  key={i}
                  className="h-2 rounded-[2px] shadow-card"
                  style={{
                    background: SKINS[b.skin].swatch.card,
                    boxShadow: `inset 2px 0 0 ${SKINS[b.skin].swatch.accent}`,
                  }}
                />
              ))}
            </span>
          ))}
        </div>
        <h3 className="truncate text-lg">{b.name}</h3>
        <div className="mt-auto flex items-center justify-between text-xs text-muted">
          <Badge color={b.profile === 'technical' ? 'blue' : 'green'}>
            {PROFILE_INFO[b.profile].title}
          </Badge>
          <span>
            {cards} tarjetas · {updatedFormat.format(new Date(b.updatedAt))}
          </span>
        </div>
      </Link>
    </li>
  );
}

/**
 * An archived board: read-only, so the tile is not a link. It can only be
 * downloaded as JSON (everything: columns, cards, labels, connections) or deleted.
 */
function ArchivedTile({ board: b }: { board: Board }) {
  const cards = b.columns.reduce((n, c) => n + c.cards.length, 0);
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-dashed border-line bg-surface-2 p-4">
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 truncate text-lg text-muted">{b.name}</h3>
        <IconButton
          icon="download"
          label={`Descargar "${b.name}" en JSON`}
          onClick={() => downloadBoardJson(b)}
        />
        <IconButton
          icon="trash"
          label={`Eliminar "${b.name}"`}
          onClick={async () => {
            const ok = await confirm(
              `¿Eliminar el tablero archivado "${b.name}"? No se puede deshacer. Descárgalo antes si quieres conservarlo.`,
              { confirmLabel: 'Eliminar', danger: true },
            );
            if (ok) await removeBoard(b);
          }}
        />
      </div>
      <div className="mt-auto flex items-center justify-between text-xs text-muted">
        <Badge color={b.profile === 'technical' ? 'blue' : 'green'}>
          {PROFILE_INFO[b.profile].title}
        </Badge>
        <span>
          {cards} tarjetas · archivado el {updatedFormat.format(new Date(b.archivedAt ?? b.updatedAt))}
        </span>
      </div>
    </li>
  );
}

/**
 * The board's look, as a chip over the tile. Read-only: profile and look are
 * chosen once, when the board is created.
 */
function SkinChip({ board }: { board: Board }) {
  return (
    <span className="pointer-events-none absolute top-6 right-6 z-10 inline-flex h-6 items-center gap-1 rounded-md border border-line-soft bg-surface/90 px-1.5 text-[11px] text-muted backdrop-blur">
      <span
        aria-hidden
        className="size-2 rounded-[2px]"
        style={{ background: SKINS[board.skin].swatch.accent }}
      />
      {SKINS[board.skin].title}
    </span>
  );
}
