/**
 * GitHub part of the card detail, on boards linked to a Project: open the
 * issue, assignees, epic and linked pull requests. Assignees and epic are
 * written to GitHub right away (they are not part of the card draft).
 */
import type { Board, Card } from '@devbord/shared';
import { Select, cx } from '../../design';
import { useGithub } from '../../controllers/githubController';
import { prLabel } from './prLabel';

export function GithubCardPanel({ board, card }: { board: Board; card: Card }) {
  const gh = card.github;
  const link = board.github!;
  if (!gh) {
    return (
      <p className="rounded-lg border border-dashed border-line p-2.5 text-xs text-muted">
        Borrador del Project: aún no es un issue. Conviértelo en issue desde GitHub para asignarlo o
        meterlo en una epic.
      </p>
    );
  }
  const assigned = new Set(gh.assignees.map((a) => a.login));
  const people = [...gh.assignees, ...link.assignable.filter((u) => !assigned.has(u.login))];
  // Epics: other issues of the board (any of them can hold sub-issues).
  const epics = board.columns.flatMap((c) =>
    c.cards.filter((x) => x.github && x.id !== card.id && x.github.repo === gh.repo),
  );
  const parentCard = epics.find((x) => x.github?.issueId === gh.parent?.issueId);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line-soft bg-surface-2 p-3 text-sm">
      <header className="flex items-center justify-between gap-2">
        <span className="font-pixel">GitHub</span>
        <a href={gh.url} target="_blank" rel="noopener noreferrer" className="text-xs underline">
          {gh.repo}#{gh.number} · {gh.state === 'open' ? 'abierto' : 'cerrado'}
        </a>
      </header>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold tracking-wide text-muted uppercase">Asignados</span>
        {people.length === 0 ? (
          <span className="text-xs text-faint">Nadie puede ser asignado en {gh.repo}.</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {people.map((u) => {
              const on = assigned.has(u.login);
              return (
                <button
                  key={u.login}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    useGithub
                      .getState()
                      .setAssignees(
                        board.id,
                        card.id,
                        on ? [...assigned].filter((l) => l !== u.login) : [...assigned, u.login],
                      )
                  }
                  className={cx(
                    'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs',
                    on ? 'border-accent text-ink' : 'border-line-soft text-muted opacity-70',
                  )}
                >
                  <img src={u.avatarUrl} alt="" className="size-4 rounded-sm" />
                  {u.login}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold tracking-wide text-muted uppercase">Epic</span>
        <Select
          className="h-8 text-sm"
          value={parentCard?.id ?? (gh.parent ? 'other' : '')}
          onChange={(e) => useGithub.getState().setEpic(board.id, card.id, e.target.value || null)}
        >
          <option value="">Sin epic</option>
          {gh.parent && !parentCard && (
            <option value="other" disabled>
              #{gh.parent.number} {gh.parent.title} (fuera del tablero)
            </option>
          )}
          {epics.map((x) => (
            <option key={x.id} value={x.id}>
              #{x.github!.number} {x.title}
            </option>
          ))}
        </Select>
      </label>

      {gh.subIssues && (
        <p className="text-xs text-muted">
          Es una epic: {gh.subIssues.completed} de {gh.subIssues.total} sub-issues cerrados.
        </p>
      )}

      {gh.pullRequests.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold tracking-wide text-muted uppercase">
            Pull requests
          </span>
          {gh.pullRequests.map((pr) => (
            <a
              key={pr.number}
              href={pr.url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-xs hover:underline"
            >
              #{pr.number} {pr.title} · {prLabel(pr)}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
