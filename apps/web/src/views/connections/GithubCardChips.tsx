/**
 * GitHub details on a card of a linked board, Zenhub-style: the issue number
 * (green open, purple closed), its epic, the epic's progress, linked pull
 * requests and assignees.
 */
import type { CardGithub, PullRequestRef } from '@devbord/shared';
import { PixelIcon } from '../../design';
import { prLabel } from './prLabel';

const PR_COLOR: Record<PullRequestRef['state'], string> = {
  open: 'var(--label-green-ink)',
  merged: 'var(--label-purple-ink)',
  closed: 'var(--label-red-ink)',
};

/** Top line: "#12" and the epic it belongs to. */
export function GithubRef({ github }: { github: CardGithub }) {
  const open = github.state === 'open';
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted">
      <span
        className="inline-flex shrink-0 items-center gap-1"
        data-cursor-hint={`${github.repo}#${github.number} · ${open ? 'abierto' : 'cerrado'}`}
      >
        <PixelIcon
          name="issue"
          size={12}
          style={{ color: open ? 'var(--label-green-ink)' : 'var(--label-purple-ink)' }}
        />
        #{github.number}
      </span>
      {github.parent && (
        <span
          className="min-w-0 truncate rounded-sm border border-line px-1 text-[10px]"
          data-cursor-hint={`Epic #${github.parent.number}`}
        >
          {github.parent.title}
        </span>
      )}
    </span>
  );
}

/** Bottom line: epic progress, pull requests and assignees. Nothing when empty. */
export function GithubMeta({ github }: { github: CardGithub }) {
  const { subIssues, pullRequests, assignees } = github;
  if (!subIssues && pullRequests.length === 0 && assignees.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
      {subIssues && (
        <span
          className="inline-flex items-center gap-1 rounded-sm border border-line px-1 tabular-nums"
          aria-label={`Epic: ${subIssues.completed} de ${subIssues.total} sub-issues cerrados`}
        >
          Epic
          {/* Pixel progress bar: 8 cells. */}
          <span aria-hidden className="flex gap-px">
            {Array.from({ length: 8 }, (_, i) => (
              <span
                key={i}
                className="h-1.5 w-1"
                style={{
                  background:
                    i < Math.round((subIssues.completed / subIssues.total) * 8)
                      ? 'var(--label-green-ink)'
                      : 'var(--line)',
                }}
              />
            ))}
          </span>
          {subIssues.completed}/{subIssues.total}
        </span>
      )}
      {pullRequests.map((pr) => (
        <span
          key={pr.number}
          className="inline-flex items-center gap-0.5"
          data-cursor-hint={`PR #${pr.number} ${prLabel(pr)}: ${pr.title}`}
          aria-label={`Pull request #${pr.number} ${prLabel(pr)}`}
        >
          <PixelIcon name="pr" size={12} style={{ color: PR_COLOR[pr.state] }} />#{pr.number}
        </span>
      ))}
      {assignees.length > 0 && (
        <span className="ml-auto flex -space-x-1">
          {assignees.slice(0, 3).map((a) => (
            <img
              key={a.login}
              src={a.avatarUrl}
              alt={a.login}
              data-cursor-hint={a.login}
              className="size-4 rounded-sm border border-card [image-rendering:pixelated]"
            />
          ))}
        </span>
      )}
    </div>
  );
}
