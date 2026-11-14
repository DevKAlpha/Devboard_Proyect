/**
 * Service: everything the GitHub routes do, independent of HTTP.
 * Sign-in (GitHub App user OAuth), the user's Projects, Project snapshots as
 * Boards, ops written back, and webhooks turned into live notices.
 */
import type { Board } from '@devbord/shared';
import type { GithubConfig } from '../config';
import { HttpError } from '../middleware/errors';
import { randomId } from './crypto';
import type { GithubClient } from './GithubClient';
import { LiveHub } from './LiveHub';
import { mapProject, type ProjectMeta, type RawItem, type RawProject } from './ProjectMapper';
import { applyOp } from './ProjectOps';
import * as q from './queries';
import type { GithubSession, SessionStore } from './SessionStore';

/** Sign-ins not finished after this long are dropped. */
const LOGIN_TTL = 10 * 60_000;
/** Refresh a user token this long before it expires. */
const REFRESH_MARGIN = 5 * 60_000;
/** Item pages read per Project (100 each). */
const MAX_PAGES = 10;

export interface ProjectSummary {
  id: string;
  number: number;
  title: string;
  url: string;
  owner: string;
}

interface RawSummary {
  id: string;
  number: number;
  title: string;
  url: string;
  closed: boolean;
  owner: { login: string };
}

export class GithubService {
  readonly hub: LiveHub;
  private readonly logins = new Map<string, { clientState: string; expires: number }>();

  constructor(
    private readonly cfg: GithubConfig,
    private readonly gh: GithubClient,
    private readonly sessions: SessionStore,
  ) {
    this.hub = new LiveHub(
      (projectId, sessionId) => this.board(sessionId, projectId),
      cfg.pollSeconds * 1000,
    );
  }

  private get callbackUrl() {
    return `${this.cfg.apiUrl}/api/github/callback`;
  }

  // ── Sign-in ────────────────────────────────────────────────────────────────

  /** GitHub's authorize URL. `clientState` comes back to the web popup untouched. */
  loginUrl(clientState: string) {
    const now = Date.now();
    for (const [k, v] of this.logins) if (v.expires < now) this.logins.delete(k);
    const state = randomId(16);
    this.logins.set(state, { clientState, expires: now + LOGIN_TTL });
    if (this.cfg.fake) return `${this.callbackUrl}?code=fake&state=${state}`;
    const params = new URLSearchParams({
      client_id: this.cfg.clientId,
      redirect_uri: this.callbackUrl,
      state,
    });
    return `https://github.com/login/oauth/authorize?${params}`;
  }

  /**
   * Finishes the sign-in and returns where to send the popup: the web app's
   * oauth.html, with the session id in the fragment (never sent to servers).
   */
  async callback(code: string, state: string) {
    const pending = this.logins.get(state);
    this.logins.delete(state);
    const back = (params: Record<string, string>) =>
      `${this.cfg.webUrl}/oauth.html#${new URLSearchParams(params)}`;
    if (!pending || pending.expires < Date.now()) {
      return back({ error: 'La sesión de inicio caducó. Inténtalo otra vez.' });
    }
    const tokens = await this.gh.token({ code, redirectUri: this.callbackUrl });
    const { viewer } = await this.gh.graphql<{ viewer: { login: string; avatarUrl: string } }>(
      tokens.accessToken,
      q.VIEWER,
    );
    const id = randomId();
    this.sessions.save(id, { ...tokens, login: viewer.login, avatarUrl: viewer.avatarUrl });
    return back({ state: pending.clientState, devbord_session: id });
  }

  /** The session's GitHub token, refreshed when it is about to expire. */
  async token(sessionId: string): Promise<{ token: string; session: GithubSession }> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new HttpError(401, 'no_session', 'Sign in with GitHub');
    const expiring =
      session.accessExpiresAt !== null && session.accessExpiresAt - REFRESH_MARGIN < Date.now();
    if (!expiring) return { token: session.accessToken, session };
    if (!session.refreshToken) {
      this.sessions.delete(sessionId);
      throw new HttpError(401, 'no_session', 'Sign in with GitHub again');
    }
    const fresh = { ...session, ...(await this.gh.token({ refreshToken: session.refreshToken })) };
    this.sessions.save(sessionId, fresh);
    return { token: fresh.accessToken, session: fresh };
  }

  async me(sessionId: string) {
    const { session } = await this.token(sessionId);
    return { login: session.login, avatarUrl: session.avatarUrl };
  }

  logout(sessionId: string) {
    this.sessions.delete(sessionId);
  }

  // ── Projects ───────────────────────────────────────────────────────────────

  async projects(sessionId: string) {
    const { token } = await this.token(sessionId);
    const data = await this.gh.graphql<{
      viewer: {
        projectsV2: { nodes: RawSummary[] };
        organizations: { nodes: { projectsV2: { nodes: RawSummary[] } }[] };
      };
    }>(token, q.PROJECTS);
    const all = [
      ...data.viewer.projectsV2.nodes,
      ...data.viewer.organizations.nodes.flatMap((o) => o.projectsV2.nodes),
    ];
    const projects: ProjectSummary[] = all
      .filter((p) => p && !p.closed)
      .map((p) => ({
        id: p.id,
        number: p.number,
        title: p.title,
        url: p.url,
        owner: p.owner.login,
      }));
    return {
      projects,
      /** Where to install the App on more organizations or repositories. */
      installUrl: `https://github.com/apps/${this.cfg.appSlug}/installations/new`,
    };
  }

  /** Reads the whole Project (all item pages) and maps it. */
  private async load(token: string, projectId: string) {
    let project: RawProject | null = null;
    const items: RawItem[] = [];
    let after: string | null = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      const data: {
        node:
          | (Omit<RawProject, 'items'> & {
              items: { nodes: RawItem[]; pageInfo: { hasNextPage: boolean; endCursor: string } };
            })
          | null;
      } = await this.gh.graphql(token, q.PROJECT, { id: projectId, after });
      if (!data.node?.id) throw new HttpError(404, 'project_not_found', 'Project not found');
      project ??= { ...data.node, items: { nodes: [] } };
      items.push(...data.node.items.nodes);
      if (!data.node.items.pageInfo.hasNextPage) break;
      after = data.node.items.pageInfo.endCursor;
    }
    const mapped = mapProject({ ...project!, items: { nodes: items } });
    const repos = [...mapped.meta.items.values()].flatMap((i) => (i.repo ? [i.repo] : []));
    if (this.hub.record(mapped.board, repos)) this.hub.notify(projectId);
    return mapped;
  }

  async board(sessionId: string, projectId: string): Promise<Board> {
    const { token } = await this.token(sessionId);
    return (await this.load(token, projectId)).board;
  }

  /** Applies a Devbord op to the Project and returns the fresh board. */
  async op(sessionId: string, projectId: string, body: unknown) {
    const { token } = await this.token(sessionId);
    const { meta }: { meta: ProjectMeta } = await this.load(token, projectId);
    const result = await applyOp(this.gh, token, meta, body);
    const { board } = await this.load(token, projectId);
    return { board, result };
  }

  // ── Webhooks ───────────────────────────────────────────────────────────────

  /** Tells the boards affected by a GitHub event to refresh. Returns their Project ids. */
  webhook(event: string, payload: Record<string, unknown>) {
    const projectIds = new Set<string>();
    const projectItem = payload.projects_v2_item as { project_node_id?: string } | undefined;
    const project = payload.projects_v2 as { node_id?: string } | undefined;
    if (projectItem?.project_node_id) projectIds.add(projectItem.project_node_id);
    if (project?.node_id) projectIds.add(project.node_id);
    const repo = (payload.repository as { full_name?: string } | undefined)?.full_name;
    if (repo && event !== 'ping') {
      for (const id of this.hub.projectsOfRepo(repo)) projectIds.add(id);
    }
    for (const id of projectIds) this.hub.notify(id);
    return [...projectIds];
  }
}
