/**
 * Board intents from Devbord, written to GitHub (the other half of the
 * mirror). Each op is validated with zod, then turned into GraphQL mutations
 * against the Project, run as the signed-in user.
 *
 * Columns are the Project's Status options: they are edited on GitHub (the
 * API cannot change options without risking the values already set), so
 * there are no column ops here. The last column means "done": entering it
 * closes the issue and leaving it reopens it, like Zenhub's Closed pipeline.
 */
import { z } from 'zod';
import {
  NO_STATUS_COLUMN,
  PrioritySchema,
  StoryPointsSchema,
  type Priority,
  type StoryPoints,
} from '@devbord/shared';
import { HttpError } from '../middleware/errors';
import type { GithubClient } from './GithubClient';
import type { ItemMeta, ProjectMeta } from './ProjectMapper';
import * as q from './queries';

/**
 * Card fields GitHub can hold. The rest (type, links) stay in Devbord.
 * Declared here, not picked from CardPatchSchema: that one has defaults, and a
 * default would overwrite on GitHub a field the user did not touch.
 */
const GithubPatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(10_000).optional(),
  labelIds: z.array(z.string().min(1)).optional(),
  storyPoints: StoryPointsSchema.nullable().optional(),
  sprint: z.string().trim().max(30).nullable().optional(),
  dueDate: z.iso.date().nullable().optional(),
  priority: PrioritySchema.nullable().optional(),
});

export const OpSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('createCard'),
    columnId: z.string().min(1),
    title: z.string().trim().min(1).max(200),
    description: z.string().max(10_000).default(''),
  }),
  z.object({ type: z.literal('updateCard'), cardId: z.string().min(1), patch: GithubPatchSchema }),
  z.object({
    type: z.literal('moveCard'),
    cardId: z.string().min(1),
    columnId: z.string().min(1),
    /** Card it lands after in the target column; null = top. */
    afterCardId: z.string().min(1).nullable(),
  }),
  z.object({ type: z.literal('removeCard'), cardId: z.string().min(1) }),
  z.object({
    type: z.literal('setAssignees'),
    cardId: z.string().min(1),
    logins: z.array(z.string().min(1)).max(10),
  }),
  z.object({
    type: z.literal('setParent'),
    cardId: z.string().min(1),
    /** Card of the epic; null takes the card out of its epic. */
    parentCardId: z.string().min(1).nullable(),
  }),
  z.object({ type: z.literal('renameBoard'), name: z.string().trim().min(1).max(80) }),
]);
export type Op = z.infer<typeof OpSchema>;

/** Runs one op. The caller reloads the Project afterwards for the fresh snapshot. */
export async function applyOp(gh: GithubClient, token: string, meta: ProjectMeta, raw: unknown) {
  const op = OpSchema.parse(raw);
  const run = <T>(query: string, vars: Record<string, unknown>) =>
    gh.graphql<T>(token, query, vars);
  const projectId = meta.projectId;

  const item = (cardId: string): ItemMeta => {
    const found = meta.items.get(cardId);
    if (!found) throw new HttpError(404, 'card_not_found', 'The card is no longer in the Project');
    return found;
  };
  const isDone = (columnId: string) =>
    columnId !== NO_STATUS_COLUMN && columnId === meta.columnIds.at(-1);

  const setStatus = async (itemId: string, columnId: string) => {
    if (!meta.statusFieldId) return;
    if (columnId === NO_STATUS_COLUMN) {
      await run(q.CLEAR_FIELD, { projectId, itemId, fieldId: meta.statusFieldId });
    } else {
      if (!meta.columnIds.includes(columnId)) {
        throw new HttpError(400, 'column_not_found', 'That column is not in the Project');
      }
      await run(q.SET_FIELD, {
        projectId,
        itemId,
        fieldId: meta.statusFieldId,
        value: { singleSelectOptionId: columnId },
      });
    }
  };

  /** Closing follows the "done" column, for issues only. */
  const syncClosed = async (it: ItemMeta, columnId: string) => {
    if (it.contentType !== 'Issue' || !it.contentId) return;
    const done = isDone(columnId);
    if (done && !it.closed) await run(q.CLOSE_ISSUE, { id: it.contentId });
    if (!done && it.closed) await run(q.REOPEN_ISSUE, { id: it.contentId });
  };

  const setField = (itemId: string, fieldId: string | null, value: object | null) => {
    if (!fieldId) return Promise.resolve();
    return value === null
      ? run(q.CLEAR_FIELD, { projectId, itemId, fieldId })
      : run(q.SET_FIELD, { projectId, itemId, fieldId, value });
  };

  switch (op.type) {
    case 'createCard': {
      let itemId: string;
      let contentId: string | null = null;
      if (meta.defaultRepo) {
        const created = await run<{ createIssue: { issue: { id: string } } }>(q.CREATE_ISSUE, {
          repositoryId: meta.defaultRepo.id,
          title: op.title,
          body: op.description,
        });
        contentId = created.createIssue.issue.id;
        const added = await run<{ addProjectV2ItemById: { item: { id: string } } }>(q.ADD_ITEM, {
          projectId,
          contentId,
        });
        itemId = added.addProjectV2ItemById.item.id;
      } else {
        // No repository linked to the Project: the card is a draft issue.
        const added = await run<{ addProjectV2DraftIssue: { projectItem: { id: string } } }>(
          q.ADD_DRAFT,
          { projectId, title: op.title, body: op.description },
        );
        itemId = added.addProjectV2DraftIssue.projectItem.id;
      }
      if (op.columnId !== NO_STATUS_COLUMN) await setStatus(itemId, op.columnId);
      if (contentId && isDone(op.columnId)) await run(q.CLOSE_ISSUE, { id: contentId });
      return { cardId: itemId };
    }

    case 'updateCard': {
      const it = item(op.cardId);
      const p = op.patch;
      const text = p.title !== undefined || p.description !== undefined;
      if (it.contentType === 'DraftIssue' && text) {
        await run(q.UPDATE_DRAFT, { id: it.contentId, title: p.title, body: p.description });
      } else if (it.contentId && (text || p.labelIds !== undefined)) {
        await run(it.contentType === 'PullRequest' ? q.UPDATE_PULL_REQUEST : q.UPDATE_ISSUE, {
          id: it.contentId,
          title: p.title,
          body: p.description,
          labelIds: p.labelIds,
        });
      }
      if (p.storyPoints !== undefined) {
        await setField(op.cardId, meta.estimateFieldId, pointsValue(p.storyPoints));
      }
      if (p.sprint !== undefined) {
        const iterationId = p.sprint === null ? null : meta.iterationIds.get(p.sprint);
        if (iterationId === undefined) {
          throw new HttpError(400, 'iteration_not_found', `No iteration named "${p.sprint}"`);
        }
        await setField(op.cardId, meta.iterationFieldId, iterationId ? { iterationId } : null);
      }
      if (p.dueDate !== undefined) {
        await setField(op.cardId, meta.dueFieldId, p.dueDate ? { date: p.dueDate } : null);
      }
      if (p.priority !== undefined) {
        await setField(op.cardId, meta.priorityFieldId, priorityValue(meta, p.priority));
      }
      return {};
    }

    case 'moveCard': {
      const it = item(op.cardId);
      if (it.columnId !== op.columnId) {
        await setStatus(op.cardId, op.columnId);
        await syncClosed(it, op.columnId);
      }
      await run(q.POSITION, { projectId, itemId: op.cardId, afterId: op.afterCardId });
      return {};
    }

    case 'removeCard':
      // Only leaves the Project: the issue itself is never deleted.
      item(op.cardId);
      await run(q.DELETE_ITEM, { projectId, itemId: op.cardId });
      return {};

    case 'setAssignees': {
      const it = item(op.cardId);
      if (!it.repo || !it.number) {
        throw new HttpError(400, 'not_an_issue', 'Draft cards have no assignees');
      }
      await gh.rest(token, 'PATCH', `/repos/${it.repo}/issues/${it.number}`, {
        assignees: op.logins,
      });
      return {};
    }

    case 'setParent': {
      const it = item(op.cardId);
      if (it.contentType !== 'Issue' || !it.contentId) {
        throw new HttpError(400, 'not_an_issue', 'Only issues can belong to an epic');
      }
      if (op.parentCardId === null) {
        if (it.parentIssueId) {
          await run(q.REMOVE_SUB_ISSUE, { issueId: it.parentIssueId, subIssueId: it.contentId });
        }
        return {};
      }
      const parent = item(op.parentCardId);
      if (parent.contentType !== 'Issue' || !parent.contentId || op.parentCardId === op.cardId) {
        throw new HttpError(400, 'not_an_issue', 'An epic must be another issue');
      }
      await run(q.ADD_SUB_ISSUE, { issueId: parent.contentId, subIssueId: it.contentId });
      return {};
    }

    case 'renameBoard':
      await run(q.RENAME_PROJECT, { projectId, title: op.name });
      return {};
  }
}

const pointsValue = (points: StoryPoints | null) => (points === null ? null : { number: points });

function priorityValue(meta: ProjectMeta, priority: Priority | null) {
  if (priority === null) return null;
  const id = meta.priorityOptionIds.get(priority);
  if (!id) throw new HttpError(400, 'priority_not_found', `No "${priority}" option in Priority`);
  return { singleSelectOptionId: id };
}
