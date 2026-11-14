/**
 * Turns a GitHub Project (v2) into a Devbord Board, plus the ids the ops need
 * to write back (field ids, options, issue ids). Pure: no I/O, tested with
 * fixtures.
 *
 * Fields are found by type and name, so a Project made by hand works as is:
 *  - Status (single select "Status"/"Estado"): the columns, in option order.
 *  - Estimate (number "Estimate"/"Story points"/"Points"): story points.
 *  - Iteration (the first iteration field): sprint.
 *  - Due date (date "Due…"/"Target…"/"Fecha…"): due date.
 *  - Priority (single select "Priority"/"Prioridad"): priority.
 */
import {
  BoardSchema,
  NO_STATUS_COLUMN,
  STORY_POINTS,
  type Board,
  type Card,
  type LabelColor,
  type Priority,
  type StoryPoints,
} from '@devbord/shared';

// ── Raw GraphQL shapes (only what queries.ts asks for) ────────────────────────

interface RawLabel {
  id: string;
  name: string;
  color: string;
}
interface RawUser {
  login: string;
  avatarUrl: string;
}
interface RawIteration {
  id: string;
  title: string;
  startDate: string;
  duration: number;
}
export interface RawField {
  __typename: string;
  id: string;
  name: string;
  dataType: string;
  options?: { id: string; name: string }[];
  configuration?: { iterations: RawIteration[]; completedIterations: RawIteration[] };
}
interface RawFieldValue {
  __typename: string;
  field?: { id: string };
  optionId?: string;
  number?: number;
  iterationId?: string;
  title?: string;
  date?: string;
}
interface RawContentBase {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}
export type RawContent =
  | (RawContentBase & { __typename: 'DraftIssue' })
  | (RawContentBase & {
      __typename: 'Issue';
      number: number;
      url: string;
      state: 'OPEN' | 'CLOSED';
      repository: { nameWithOwner: string };
      labels: { nodes: RawLabel[] };
      assignees: { nodes: RawUser[] };
      parent: { id: string; number: number; title: string; url: string } | null;
      subIssuesSummary: { total: number; completed: number } | null;
      closedByPullRequestsReferences: {
        nodes: {
          number: number;
          title: string;
          url: string;
          state: string;
          isDraft: boolean;
          merged: boolean;
        }[];
      };
    })
  | (RawContentBase & {
      __typename: 'PullRequest';
      number: number;
      url: string;
      state: 'OPEN' | 'CLOSED' | 'MERGED';
      isDraft: boolean;
      merged: boolean;
      repository: { nameWithOwner: string };
      labels: { nodes: RawLabel[] };
      assignees: { nodes: RawUser[] };
    });
export interface RawItem {
  id: string;
  isArchived: boolean;
  fieldValues: { nodes: RawFieldValue[] };
  content: RawContent | null;
}
export interface RawProject {
  id: string;
  number: number;
  title: string;
  url: string;
  createdAt: string;
  owner: { login: string };
  repositories: {
    nodes: {
      id: string;
      nameWithOwner: string;
      labels: { nodes: RawLabel[] };
      assignableUsers: { nodes: RawUser[] };
    }[];
  };
  fields: { nodes: RawField[] };
  /** All pages, concatenated by the service. */
  items: { nodes: RawItem[] };
}

// ── What the ops need ────────────────────────────────────────────────────────

export interface ItemMeta {
  contentId: string | null;
  contentType: 'Issue' | 'DraftIssue' | 'PullRequest' | null;
  closed: boolean;
  columnId: string;
  /** Issue id of the epic (sub-issue parent). */
  parentIssueId: string | null;
  repo: string | null;
  number: number | null;
}

export interface ProjectMeta {
  projectId: string;
  statusFieldId: string | null;
  /** Column ids in order (NO_STATUS_COLUMN first). The last one is "done". */
  columnIds: string[];
  estimateFieldId: string | null;
  iterationFieldId: string | null;
  /** Iteration id by title (active and completed). */
  iterationIds: Map<string, string>;
  dueFieldId: string | null;
  priorityFieldId: string | null;
  priorityOptionIds: Map<Priority, string>;
  defaultRepo: { id: string; nameWithOwner: string } | null;
  items: Map<string, ItemMeta>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fieldOf = (fields: RawField[], type: string, name?: RegExp) =>
  fields.find((f) => f.dataType === type && (!name || name.test(f.name.trim()))) ?? null;

/** Nearest Devbord palette key for a GitHub label color (hex, no #). */
export function labelColor(hex: string): LabelColor {
  const n = Number.parseInt(hex, 16);
  if (Number.isNaN(n)) return 'gray';
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 0.15) return 'gray';
  let hue: number;
  if (max === r) hue = ((g - b) / (max - min)) % 6;
  else if (max === g) hue = (b - r) / (max - min) + 2;
  else hue = (r - g) / (max - min) + 4;
  hue = (hue * 60 + 360) % 360;
  if (hue < 15 || hue >= 330) return 'red';
  if (hue < 40) return 'orange';
  if (hue < 70) return 'yellow';
  if (hue < 170) return 'green';
  if (hue < 250) return 'blue';
  return 'purple';
}

/** GitHub estimates are free numbers; Devbord uses Fibonacci. Round up to the scale. */
export function snapPoints(value: number | undefined): StoryPoints | null {
  if (value === undefined || !(value > 0)) return null;
  return STORY_POINTS.find((p) => p >= value) ?? 13;
}

/** "High", "P0", "Alta"… to Devbord's priority. Unknown names: no priority. */
export function priorityOf(name: string): Priority | null {
  const n = name.trim().toLowerCase();
  if (/^(p0|urgent|critical|high|alta|urgente)/.test(n)) return 'high';
  if (/^(p1|medium|media|normal)/.test(n)) return 'medium';
  if (/^(p2|p3|low|baja)/.test(n)) return 'low';
  return null;
}

const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);

// ── Mapper ───────────────────────────────────────────────────────────────────

export function mapProject(raw: RawProject): { board: Board; meta: ProjectMeta } {
  const fields = raw.fields.nodes;
  const status = fieldOf(fields, 'SINGLE_SELECT', /^(status|estado)$/i);
  const estimate = fieldOf(
    fields,
    'NUMBER',
    /^(estimate|story ?points?|points|estimación|puntos)$/i,
  );
  const iteration = fieldOf(fields, 'ITERATION');
  const due = fieldOf(fields, 'DATE', /^(due|target|fecha)/i);
  const priority = fieldOf(fields, 'SINGLE_SELECT', /^(priority|prioridad)$/i);

  const iterations = iteration?.configuration?.iterations ?? [];
  const iterationIds = new Map<string, string>();
  for (const it of [...iterations, ...(iteration?.configuration?.completedIterations ?? [])]) {
    iterationIds.set(it.title, it.id);
  }
  const priorityOptionIds = new Map<Priority, string>();
  const priorityById = new Map<string, Priority>();
  for (const o of priority?.options ?? []) {
    const p = priorityOf(o.name);
    if (!p) continue;
    priorityById.set(o.id, p);
    if (!priorityOptionIds.has(p)) priorityOptionIds.set(p, o.id);
  }

  const repos = raw.repositories.nodes;
  const labelsById = new Map<string, { id: string; name: string; color: LabelColor }>();
  for (const repo of repos) {
    for (const l of repo.labels.nodes) {
      labelsById.set(l.id, { id: l.id, name: clip(l.name.trim(), 30), color: labelColor(l.color) });
    }
  }

  const columnIds = [NO_STATUS_COLUMN, ...(status?.options ?? []).map((o) => o.id)];
  const cardsByColumn = new Map<string, Card[]>(columnIds.map((id) => [id, []]));
  const items = new Map<string, ItemMeta>();

  for (const item of raw.items.nodes) {
    const content = item.content;
    if (item.isArchived || !content) continue;
    const values = new Map(
      item.fieldValues.nodes.filter((v) => v.field).map((v) => [v.field!.id, v]),
    );
    const statusOption = status ? values.get(status.id)?.optionId : undefined;
    const columnId =
      statusOption && cardsByColumn.has(statusOption) ? statusOption : NO_STATUS_COLUMN;

    // Labels from repos outside the Project's linked ones still show.
    const issueLike = content.__typename !== 'DraftIssue' ? content : null;
    for (const l of issueLike?.labels.nodes ?? []) {
      if (!labelsById.has(l.id)) {
        labelsById.set(l.id, {
          id: l.id,
          name: clip(l.name.trim(), 30),
          color: labelColor(l.color),
        });
      }
    }

    const card: Card = {
      id: item.id,
      title: clip(content.title.trim() || '(sin título)', 200),
      description: clip(content.body ?? '', 10_000),
      labelIds: issueLike?.labels.nodes.map((l) => l.id) ?? [],
      dueDate: due ? (values.get(due.id)?.date ?? null) : null,
      type: 'task',
      priority: priority
        ? (priorityById.get(values.get(priority.id)?.optionId ?? '') ?? null)
        : null,
      storyPoints: estimate ? snapPoints(values.get(estimate.id)?.number) : null,
      movedAt: null,
      moveLog: [],
      trail: [],
      links: [],
      number: issueLike?.number ?? null,
      sprint: iteration ? clip(values.get(iteration.id)?.title ?? '', 30) || null : null,
      github: issueLike
        ? {
            issueId: issueLike.id,
            repo: issueLike.repository.nameWithOwner,
            number: issueLike.number,
            url: issueLike.url,
            state: issueLike.state === 'OPEN' ? 'open' : 'closed',
            assignees: issueLike.assignees.nodes,
            parent:
              issueLike.__typename === 'Issue' && issueLike.parent
                ? {
                    issueId: issueLike.parent.id,
                    number: issueLike.parent.number,
                    title: issueLike.parent.title,
                    url: issueLike.parent.url,
                  }
                : null,
            subIssues:
              issueLike.__typename === 'Issue' && issueLike.subIssuesSummary?.total
                ? issueLike.subIssuesSummary
                : null,
            pullRequests:
              issueLike.__typename === 'Issue'
                ? issueLike.closedByPullRequestsReferences.nodes.map((pr) => ({
                    number: pr.number,
                    title: pr.title,
                    url: pr.url,
                    state: pr.merged ? 'merged' : pr.state === 'OPEN' ? 'open' : 'closed',
                    draft: pr.isDraft,
                  }))
                : [],
          }
        : null,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
    };
    cardsByColumn.get(columnId)!.push(card);
    items.set(item.id, {
      contentId: content.id,
      contentType: content.__typename,
      closed: issueLike ? issueLike.state !== 'OPEN' : false,
      columnId,
      parentIssueId: content.__typename === 'Issue' && content.parent ? content.parent.id : null,
      repo: issueLike?.repository.nameWithOwner ?? null,
      number: issueLike?.number ?? null,
    });
  }

  const defaultRepo = repos[0] ? { id: repos[0].id, nameWithOwner: repos[0].nameWithOwner } : null;
  const columnTitle = (id: string) =>
    id === NO_STATUS_COLUMN
      ? 'Sin estado'
      : clip(status?.options?.find((o) => o.id === id)?.name.trim() || 'Columna', 60);

  const board = BoardSchema.parse({
    id: raw.id,
    name: clip(raw.title.trim() || `Project ${raw.number}`, 80),
    profile: 'technical',
    labels: [...labelsById.values()],
    columns: columnIds.map((id) => ({
      id,
      title: columnTitle(id),
      cards: cardsByColumn.get(id) ?? [],
    })),
    github: {
      projectId: raw.id,
      number: raw.number,
      owner: raw.owner.login,
      url: raw.url,
      defaultRepo: defaultRepo?.nameWithOwner ?? null,
      iterations,
      assignable: repos[0]?.assignableUsers.nodes ?? [],
      fields: {
        estimate: Boolean(estimate),
        iteration: Boolean(iteration),
        dueDate: Boolean(due),
        priority: priorityOptionIds.size > 0,
      },
    },
    createdAt: raw.createdAt,
    updatedAt: new Date().toISOString(),
  });

  return {
    board,
    meta: {
      projectId: raw.id,
      statusFieldId: status?.id ?? null,
      columnIds,
      estimateFieldId: estimate?.id ?? null,
      iterationFieldId: iteration?.id ?? null,
      iterationIds,
      dueFieldId: due?.id ?? null,
      priorityFieldId: priority?.id ?? null,
      priorityOptionIds,
      defaultRepo,
      items,
    },
  };
}
