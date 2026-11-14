/**
 * "Conectar Project de GitHub": sign in with GitHub, pick one of your Projects
 * (v2) and open it as a Devbord board that stays in sync both ways.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Modal, PixelIcon } from '../../design';
import { useGithub } from '../../controllers/githubController';
import type { GithubProjectSummary } from '../../integrations/github/client';

export function GithubProjectsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} title="Conectar Project de GitHub" onClose={onClose}>
      {open && <ProjectPicker onClose={onClose} />}
    </Modal>
  );
}

function ProjectPicker({ onClose }: { onClose: () => void }) {
  const { configured, user, busy, error } = useGithub();
  const navigate = useNavigate();
  const [list, setList] = useState<{ projects: GithubProjectSummary[]; installUrl: string } | null>(
    null,
  );
  const [opening, setOpening] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const loading = Boolean(user) && !list && !listError;

  useEffect(() => void useGithub.getState().init(), []);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    useGithub
      .getState()
      .listProjects()
      .then((l) => alive && setList(l))
      .catch((e: unknown) => alive && setListError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [user]);

  if (!configured) {
    return (
      <p className="text-sm text-muted">
        Esta instalación de Devbord no tiene servidor de GitHub configurado. Hace falta desplegar la
        API con una GitHub App y definir <code>VITE_GITHUB_API_URL</code> (guía en docs/github.md).
      </p>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted">
          Conecta tu cuenta para elegir un Project. Lo que cambies en Devbord se verá en GitHub y al
          revés: columnas (campo Status), issues, estimaciones, sprints, epics y PRs.
        </p>
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => void useGithub.getState().signIn()}
        >
          <PixelIcon name="issue" />
          {busy ? 'Conectando…' : 'Conectar con GitHub'}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-sm text-muted">
        <img src={user.avatarUrl} alt="" className="size-5 rounded-sm" />
        Conectado como <strong className="text-ink">{user.login}</strong>
      </p>
      {loading && <p className="text-sm text-faint">Buscando tus Projects…</p>}
      {listError && (
        <p role="alert" className="text-sm text-danger">
          {listError}
        </p>
      )}
      {list && list.projects.length === 0 && (
        <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
          No hay Projects visibles. Instala la App de Devbord en tu organización o repositorio y
          vuelve a abrir esta ventana.
        </p>
      )}
      {list && list.projects.length > 0 && (
        <ul className="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto">
          {list.projects.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                disabled={opening !== null}
                onClick={async () => {
                  setOpening(p.id);
                  try {
                    const boardId = await useGithub.getState().openProject(p.id);
                    onClose();
                    navigate(`/b/${boardId}`);
                  } catch (e) {
                    setListError(e instanceof Error ? e.message : String(e));
                  } finally {
                    setOpening(null);
                  }
                }}
                className="flex w-full items-center gap-2 rounded-lg border border-line-soft bg-card px-3 py-2 text-left text-sm hover:border-line hover:shadow-pixel disabled:opacity-60"
              >
                <span className="min-w-0 flex-1 truncate font-semibold">{p.title}</span>
                <span className="shrink-0 text-xs text-faint">
                  {p.owner} · #{p.number}
                </span>
                <span className="shrink-0 text-xs text-accent">
                  {opening === p.id ? 'Abriendo…' : 'Abrir'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {list && (
        <a
          href={list.installUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted underline"
        >
          ¿Falta un Project? Instala la App en otra organización o repositorio
        </a>
      )}
    </div>
  );
}
