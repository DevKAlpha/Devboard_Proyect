/**
 * In-memory GitHub for tests and local development (`GITHUB_FAKE=1`): one
 * organization Project with Status, Estimate, Iteration and Priority fields,
 * a repository with labels, issues (one epic with sub-issues) and a linked PR.
 *
 * It answers the operations in queries.ts by name, with the same shapes as
 * GitHub, and records every mutation so tests can assert on them. It is not a
 * GraphQL server: it only knows Devbord's own documents.
 */
import type { Fetch } from './GithubClient';

interface FakeIssue {
  id: string;
  number: number;
  title: string;
  body: string;
  state: 'OPEN' | 'CLOSED';
  labelIds: string[];
  assignees: string[];
  parentId: string | null;
  pr: { number: number; title: string; state: string; isDraft: boolean; merged: boolean } | null;
  createdAt: string;
  updatedAt: string;
}

interface FakeItem {
  id: string;
  contentId: string;
  draft: { title: string; body: string } | null;
  values: Record<
    string,
    { optionId?: string; number?: number; iterationId?: string; date?: string }
  >;
}

const OWNER = 'devbord-demo';
const REPO = `${OWNER}/app`;
const PROJECT_ID = 'PVT_fake1';
const AVATAR = 'https://avatars.githubusercontent.com/u/583231';
const T0 = '2026-11-01T10:00:00Z';

const STATUS = {
  id: 'F_status',
  options: [
    { id: 'OPT_todo', name: 'Todo' },
    { id: 'OPT_doing', name: 'In Progress' },
    { id: 'OPT_done', name: 'Done' },
  ],
};
const ITERATIONS = [
  { id: 'IT_1', title: 'Sprint 1', startDate: '2026-11-02', duration: 14 },
  { id: 'IT_2', title: 'Sprint 2', startDate: '2026-11-16', duration: 14 },
];
const PRIORITY = {
  id: 'F_priority',
  options: [
    { id: 'OPT_p0', name: 'P0' },
    { id: 'OPT_p1', name: 'P1' },
    { id: 'OPT_p2', name: 'P2' },
  ],
};
const LABELS = [
  { id: 'LA_bug', name: 'bug', color: 'd73a4a' },
  { id: 'LA_feature', name: 'enhancement', color: 'a2eeef' },
];

export class FakeGithub {
  /** Every mutation received, in order: [operation name, variables]. */
  readonly calls: [string, Record<string, unknown>][] = [];
  projectTitle = 'Devbord demo';
  private seq = 100;
  private readonly issues = new Map<string, FakeIssue>();
  private items: FakeItem[] = [];

  constructor() {
    const issue = (n: number, title: string, extra: Partial<FakeIssue> = {}): FakeIssue => ({
      id: `I_${n}`,
      number: n,
      title,
      body: '',
      state: 'OPEN',
      labelIds: [],
      assignees: [],
      parentId: null,
      pr: null,
      createdAt: T0,
      updatedAt: T0,
      ...extra,
    });
    const list = [
      issue(1, 'Epic: Login', { labelIds: ['LA_feature'] }),
      issue(2, 'Formulario de login', { parentId: 'I_1', assignees: ['octocat'] }),
      issue(3, 'Recordar sesión', {
        parentId: 'I_1',
        pr: { number: 7, title: 'Remember me', state: 'OPEN', isDraft: false, merged: false },
      }),
      issue(4, 'Error al salir', { labelIds: ['LA_bug'], state: 'CLOSED' }),
    ];
    for (const i of list) this.issues.set(i.id, i);
    this.items = [
      {
        id: 'PVTI_1',
        contentId: 'I_1',
        draft: null,
        values: { [STATUS.id]: { optionId: 'OPT_doing' } },
      },
      {
        id: 'PVTI_2',
        contentId: 'I_2',
        draft: null,
        values: {
          [STATUS.id]: { optionId: 'OPT_todo' },
          F_estimate: { number: 3 },
          F_iteration: { iterationId: 'IT_1' },
        },
      },
      {
        id: 'PVTI_3',
        contentId: 'I_3',
        draft: null,
        values: {
          [STATUS.id]: { optionId: 'OPT_doing' },
          F_estimate: { number: 4 },
          [PRIORITY.id]: { optionId: 'OPT_p0' },
        },
      },
      {
        id: 'PVTI_4',
        contentId: 'I_4',
        draft: null,
        values: { [STATUS.id]: { optionId: 'OPT_done' } },
      },
      { id: 'PVTI_5', contentId: 'DI_5', draft: { title: 'Idea sin issue', body: '' }, values: {} },
    ];
  }

  /** Drop-in `fetch` for GithubClient. */
  readonly fetch: Fetch = async (input, init) => {
    const url = String(input);
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    if (url.endsWith('/login/oauth/access_token')) {
      return json({
        access_token: 'fake-token',
        expires_in: 28_800,
        refresh_token: 'fake-refresh',
        refresh_token_expires_in: 15_897_600,
      });
    }
    if (url.endsWith('/graphql')) {
      const name = /(?:query|mutation)\s+(Devbord\w+)/.exec(String(body.query))?.[1] ?? '';
      const vars = (body.variables ?? {}) as Record<string, unknown>;
      return json({ data: this.graphql(name, vars) });
    }
    const rest = /\/repos\/[^/]+\/[^/]+\/issues\/(\d+)$/.exec(url);
    if (rest && init?.method === 'PATCH') {
      const issue = [...this.issues.values()].find((i) => i.number === Number(rest[1]));
      if (!issue) return json({ message: 'Not Found' }, 404);
      this.calls.push(['RestAssignees', body]);
      issue.assignees = (body.assignees as string[]) ?? [];
      this.touch(issue);
      return json({ number: issue.number });
    }
    return json({ message: 'Not Found' }, 404);
  };

  /** Simulates a change made by someone on github.com. */
  editOnGithub(issueNumber: number, title: string) {
    const issue = [...this.issues.values()].find((i) => i.number === issueNumber);
    if (issue) {
      issue.title = title;
      this.touch(issue);
    }
  }

  private touch(issue: FakeIssue) {
    issue.updatedAt = new Date().toISOString();
  }

  private graphql(name: string, v: Record<string, unknown>): unknown {
    if (
      name.startsWith('Devbord') &&
      !['DevbordViewer', 'DevbordProjects', 'DevbordProject'].includes(name)
    ) {
      this.calls.push([name, v]);
    }
    const item = (id: unknown) => this.items.find((i) => i.id === id);
    const issue = (id: unknown) => this.issues.get(String(id));
    switch (name) {
      case 'DevbordViewer':
        return { viewer: { login: 'octocat', avatarUrl: AVATAR } };
      case 'DevbordProjects':
        return {
          viewer: {
            login: 'octocat',
            projectsV2: { nodes: [] },
            organizations: { nodes: [{ login: OWNER, projectsV2: { nodes: [this.summary()] } }] },
          },
        };
      case 'DevbordProject':
        return { node: v.id === PROJECT_ID ? this.project() : null };
      case 'DevbordCreateIssue': {
        const n = ++this.seq;
        const created: FakeIssue = {
          id: `I_${n}`,
          number: n,
          title: String(v.title),
          body: String(v.body ?? ''),
          state: 'OPEN',
          labelIds: [],
          assignees: [],
          parentId: null,
          pr: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.issues.set(created.id, created);
        return { createIssue: { issue: { id: created.id } } };
      }
      case 'DevbordAddItem': {
        const id = `PVTI_${++this.seq}`;
        this.items.push({ id, contentId: String(v.contentId), draft: null, values: {} });
        return { addProjectV2ItemById: { item: { id } } };
      }
      case 'DevbordAddDraft': {
        const id = `PVTI_${++this.seq}`;
        this.items.push({
          id,
          contentId: `DI_${this.seq}`,
          draft: { title: String(v.title), body: String(v.body ?? '') },
          values: {},
        });
        return { addProjectV2DraftIssue: { projectItem: { id } } };
      }
      case 'DevbordSetField': {
        const it = item(v.itemId);
        // GitHub's input says singleSelectOptionId; its output says optionId.
        const { singleSelectOptionId, ...rest } = v.value as { singleSelectOptionId?: string };
        if (it) {
          it.values[String(v.fieldId)] = singleSelectOptionId
            ? { optionId: singleSelectOptionId }
            : (rest as FakeItem['values'][string]);
        }
        return { updateProjectV2ItemFieldValue: { projectV2Item: { id: v.itemId } } };
      }
      case 'DevbordClearField': {
        const it = item(v.itemId);
        if (it) delete it.values[String(v.fieldId)];
        return { clearProjectV2ItemFieldValue: { projectV2Item: { id: v.itemId } } };
      }
      case 'DevbordPosition': {
        const it = item(v.itemId);
        if (it) {
          this.items = this.items.filter((i) => i !== it);
          const after = v.afterId ? this.items.findIndex((i) => i.id === v.afterId) : -1;
          this.items.splice(after + 1, 0, it);
        }
        return { updateProjectV2ItemPosition: { clientMutationId: null } };
      }
      case 'DevbordUpdateIssue': {
        const i = issue(v.id);
        if (i) {
          if (typeof v.title === 'string') i.title = v.title;
          if (typeof v.body === 'string') i.body = v.body;
          if (Array.isArray(v.labelIds)) i.labelIds = v.labelIds as string[];
          this.touch(i);
        }
        return { updateIssue: { issue: { id: v.id } } };
      }
      case 'DevbordUpdateDraft': {
        const it = this.items.find((x) => x.contentId === v.id);
        if (it?.draft) {
          if (typeof v.title === 'string') it.draft.title = v.title;
          if (typeof v.body === 'string') it.draft.body = v.body;
        }
        return { updateProjectV2DraftIssue: { draftIssue: { id: v.id } } };
      }
      case 'DevbordCloseIssue':
      case 'DevbordReopenIssue': {
        const i = issue(v.id);
        if (i) {
          i.state = name === 'DevbordCloseIssue' ? 'CLOSED' : 'OPEN';
          this.touch(i);
        }
        return { closeIssue: { issue: { id: v.id } } };
      }
      case 'DevbordDeleteItem':
        this.items = this.items.filter((i) => i.id !== v.itemId);
        return { deleteProjectV2Item: { deletedItemId: v.itemId } };
      case 'DevbordAddSubIssue':
      case 'DevbordRemoveSubIssue': {
        const child = issue(v.subIssueId);
        if (child) child.parentId = name === 'DevbordAddSubIssue' ? String(v.issueId) : null;
        return { addSubIssue: { issue: { id: v.issueId } } };
      }
      case 'DevbordRenameProject':
        this.projectTitle = String(v.title);
        return { updateProjectV2: { projectV2: { id: PROJECT_ID } } };
      default:
        throw new Error(`FakeGithub: unknown operation ${name}`);
    }
  }

  private summary() {
    return {
      id: PROJECT_ID,
      number: 1,
      title: this.projectTitle,
      url: `https://github.com/orgs/${OWNER}/projects/1`,
      closed: false,
      owner: { login: OWNER },
    };
  }

  private project() {
    const users = (logins: string[]) => logins.map((login) => ({ login, avatarUrl: AVATAR }));
    const labels = (ids: string[]) => LABELS.filter((l) => ids.includes(l.id));
    const fieldValue = (fieldId: string, value: FakeItem['values'][string]) => {
      const field = { id: fieldId };
      if (value.optionId)
        return {
          __typename: 'ProjectV2ItemFieldSingleSelectValue',
          optionId: value.optionId,
          field,
        };
      if (value.number !== undefined)
        return { __typename: 'ProjectV2ItemFieldNumberValue', number: value.number, field };
      if (value.iterationId) {
        const title = ITERATIONS.find((i) => i.id === value.iterationId)?.title ?? '';
        return {
          __typename: 'ProjectV2ItemFieldIterationValue',
          iterationId: value.iterationId,
          title,
          field,
        };
      }
      return { __typename: 'ProjectV2ItemFieldDateValue', date: value.date, field };
    };
    const content = (it: FakeItem) => {
      if (it.draft) {
        return {
          __typename: 'DraftIssue',
          id: it.contentId,
          ...it.draft,
          createdAt: T0,
          updatedAt: T0,
        };
      }
      const i = this.issues.get(it.contentId)!;
      const parent = i.parentId ? this.issues.get(i.parentId) : null;
      const children = [...this.issues.values()].filter((c) => c.parentId === i.id);
      return {
        __typename: 'Issue',
        id: i.id,
        number: i.number,
        title: i.title,
        body: i.body,
        url: `https://github.com/${REPO}/issues/${i.number}`,
        state: i.state,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
        repository: { nameWithOwner: REPO },
        labels: { nodes: labels(i.labelIds) },
        assignees: { nodes: users(i.assignees) },
        parent: parent
          ? {
              id: parent.id,
              number: parent.number,
              title: parent.title,
              url: `https://github.com/${REPO}/issues/${parent.number}`,
            }
          : null,
        subIssuesSummary: {
          total: children.length,
          completed: children.filter((c) => c.state === 'CLOSED').length,
        },
        closedByPullRequestsReferences: {
          nodes: i.pr ? [{ ...i.pr, url: `https://github.com/${REPO}/pull/${i.pr.number}` }] : [],
        },
      };
    };
    return {
      ...this.summary(),
      createdAt: T0,
      repositories: {
        nodes: [
          {
            id: 'R_app',
            nameWithOwner: REPO,
            labels: { nodes: LABELS },
            assignableUsers: { nodes: users(['octocat', 'hubot']) },
          },
        ],
      },
      fields: {
        nodes: [
          { __typename: 'ProjectV2Field', id: 'F_title', name: 'Title', dataType: 'TITLE' },
          {
            __typename: 'ProjectV2SingleSelectField',
            id: STATUS.id,
            name: 'Status',
            dataType: 'SINGLE_SELECT',
            options: STATUS.options,
          },
          { __typename: 'ProjectV2Field', id: 'F_estimate', name: 'Estimate', dataType: 'NUMBER' },
          {
            __typename: 'ProjectV2IterationField',
            id: 'F_iteration',
            name: 'Iteration',
            dataType: 'ITERATION',
            configuration: { iterations: ITERATIONS, completedIterations: [] },
          },
          {
            __typename: 'ProjectV2SingleSelectField',
            id: PRIORITY.id,
            name: 'Priority',
            dataType: 'SINGLE_SELECT',
            options: PRIORITY.options,
          },
        ],
      },
      items: {
        pageInfo: { hasNextPage: false, endCursor: 'end' },
        nodes: this.items.map((it) => ({
          id: it.id,
          isArchived: false,
          fieldValues: { nodes: Object.entries(it.values).map(([f, val]) => fieldValue(f, val)) },
          content: content(it),
        })),
      },
    };
  }
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
