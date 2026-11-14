/**
 * Header chip of a board linked to a GitHub Project: opens the Project and
 * shows the sync state with a pixel dot (green live, blue writing, gray
 * offline, red error). Errors read out on hover and to screen readers.
 */
import type { GithubLink } from '@devbord/shared';
import { PixelIcon } from '../../design';
import { useGithub, type SyncState } from '../../controllers/githubController';

const STATE: Record<SyncState, { label: string; color: string }> = {
  off: { label: 'Sin sincronizar', color: 'var(--faint)' },
  live: { label: 'Sincronizado con GitHub', color: 'var(--label-green-ink)' },
  syncing: { label: 'Guardando en GitHub…', color: 'var(--accent)' },
  offline: { label: 'Sin conexión con GitHub: reintentando', color: 'var(--faint)' },
  error: { label: 'Error con GitHub', color: 'var(--label-red-ink)' },
};

export function GithubBadge({ link }: { link: GithubLink }) {
  const sync = useGithub((s) => s.sync);
  const user = useGithub((s) => s.user);
  const error = useGithub((s) => s.error);
  const configured = useGithub((s) => s.configured);
  const state = !configured || !user ? null : STATE[sync];
  const hint = !configured
    ? 'GitHub no está configurado en esta instalación'
    : !user
      ? 'Conecta GitHub en Conexiones para sincronizar'
      : sync === 'error' && error
        ? `${state!.label}: ${error}`
        : state!.label;

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      data-cursor-hint={hint}
      aria-label={`Project de GitHub ${link.owner} #${link.number}. ${hint}`}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs text-muted hover:text-ink"
    >
      <PixelIcon name="issue" size={12} />
      {link.owner} #{link.number}
      <span
        aria-hidden
        className="size-2"
        style={{ background: state?.color ?? 'var(--label-yellow-ink)' }}
      />
    </a>
  );
}
