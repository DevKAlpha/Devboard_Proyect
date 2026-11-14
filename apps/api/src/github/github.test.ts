import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { NO_STATUS_COLUMN, type Board } from '@devbord/shared';
import { createApp } from '../app';
import type { GithubConfig } from '../config';
import { decrypt, encrypt, signPayload } from './crypto';
import { FakeGithub } from './FakeGithub';
import { labelColor, priorityOf, snapPoints } from './ProjectMapper';

const CONFIG: GithubConfig = {
  fake: false,
  clientId: 'id',
  clientSecret: 'secret',
  webhookSecret: 'hook-secret',
  appSlug: 'devbord-test',
  sessionSecret: 'session-secret',
  webUrl: 'https://web.test/app',
  apiUrl: 'https://api.test',
  database: ':memory:',
  pollSeconds: 0,
};
const PROJECT = 'PVT_fake1';

const apps: ReturnType<typeof createApp>[] = [];

/** App wired to a fresh fake GitHub, plus a signed-in session. */
async function setup() {
  const fake = new FakeGithub();
  const app = createApp({ github: CONFIG, githubFetch: fake.fetch });
  apps.push(app);
  const login = await request(app).get('/api/github/login?state=web-state');
  const state = new URL(login.headers.location as string).searchParams.get('state');
  const back = await request(app).get(`/api/github/callback?code=abc&state=${state}`);
  const hash = new URLSearchParams(new URL(back.headers.location as string).hash.slice(1));
  expect(hash.get('state')).toBe('web-state');
  const session = hash.get('devbord_session')!;
  const auth = { Authorization: `Bearer ${session}` };
  const board = async () =>
    (await request(app).get(`/api/github/projects/${PROJECT}/board`).set(auth)).body as Board;
  const op = (body: object) =>
    request(app).post(`/api/github/projects/${PROJECT}/ops`).set(auth).send(body);
  return { app, fake, auth, board, op };
}

const column = (board: Board, title: string) => board.columns.find((c) => c.title === title)!;
const card = (board: Board, title: string) =>
  board.columns.flatMap((c) => c.cards).find((c) => c.title === title)!;

afterEach(() => {
  for (const app of apps.splice(0)) app.github?.hub.stop();
});

describe('github helpers', () => {
  it('maps label colors, estimates and priorities', () => {
    expect(labelColor('d73a4a')).toBe('red');
    expect(labelColor('a2eeef')).toBe('blue');
    expect(labelColor('ededed')).toBe('gray');
    expect(snapPoints(4)).toBe(5);
    expect(snapPoints(40)).toBe(13);
    expect(snapPoints(0)).toBeNull();
    expect(priorityOf('P0')).toBe('high');
    expect(priorityOf('Baja')).toBe('low');
  });

  it('encrypts tokens and rejects tampering', () => {
    const sealed = encrypt('k', 'gho_token');
    expect(decrypt('k', sealed)).toBe('gho_token');
    expect(() => decrypt('other', sealed)).toThrow();
  });
});

describe('github api', () => {
  it('answers 503 when GitHub is not configured', async () => {
    const res = await request(createApp({ github: null })).get('/api/github/me');
    expect(res.status).toBe(503);
  });

  it('signs in with a session id and lists Projects', async () => {
    const { app, auth } = await setup();
    expect((await request(app).get('/api/github/me')).status).toBe(401);
    expect((await request(app).get('/api/github/me').set(auth)).body.login).toBe('octocat');
    const list = await request(app).get('/api/github/projects').set(auth);
    expect(list.body.projects[0]).toMatchObject({ id: PROJECT, owner: 'devbord-demo' });
    expect(list.body.installUrl).toBe('https://github.com/apps/devbord-test/installations/new');
  });

  it('maps the Project into a board', async () => {
    const { board } = await setup();
    const b = await board();
    expect(b.columns.map((c) => c.title)).toEqual(['Sin estado', 'Todo', 'In Progress', 'Done']);
    expect(b.columns[0]!.id).toBe(NO_STATUS_COLUMN);
    expect(b.github).toMatchObject({
      defaultRepo: 'devbord-demo/app',
      fields: { estimate: true, iteration: true, priority: true },
    });
    const epic = card(b, 'Epic: Login');
    expect(epic.github?.subIssues).toEqual({ total: 2, completed: 0 });
    const child = card(b, 'Recordar sesión');
    expect(child.storyPoints).toBe(5); // 4 on GitHub, rounded up to Fibonacci
    expect(child.priority).toBe('high');
    expect(child.github?.parent?.number).toBe(1);
    expect(child.github?.pullRequests[0]).toMatchObject({ number: 7, state: 'open' });
    expect(card(b, 'Formulario de login').sprint).toBe('Sprint 1');
    expect(card(b, 'Idea sin issue').github).toBeNull();
    expect(b.labels.find((l) => l.name === 'bug')?.color).toBe('red');
  });

  it('writes Devbord ops back to GitHub', async () => {
    const { board, op, fake } = await setup();
    let b = await board();
    const todo = column(b, 'Todo').id;
    const done = column(b, 'Done').id;

    const created = await op({ type: 'createCard', columnId: done, title: 'Nueva' });
    expect(created.status).toBe(200);
    expect(fake.calls.map(([n]) => n)).toEqual([
      'DevbordCreateIssue',
      'DevbordAddItem',
      'DevbordSetField',
      'DevbordCloseIssue',
    ]);
    b = created.body.board;
    expect(card(b, 'Nueva').github?.state).toBe('closed');

    const form = card(b, 'Formulario de login');
    await op({ type: 'moveCard', cardId: form.id, columnId: done, afterCardId: null });
    await op({
      type: 'updateCard',
      cardId: form.id,
      patch: { title: 'Login', storyPoints: 8, sprint: 'Sprint 2', labelIds: ['LA_bug'] },
    });
    await op({ type: 'setAssignees', cardId: form.id, logins: ['hubot'] });
    b = await board();
    const moved = card(b, 'Login');
    expect(column(b, 'Done').cards[0]!.id).toBe(moved.id);
    expect(moved).toMatchObject({ storyPoints: 8, sprint: 'Sprint 2', labelIds: ['LA_bug'] });
    expect(moved.github).toMatchObject({ state: 'closed', assignees: [{ login: 'hubot' }] });

    // Back out of "done" reopens it; epics follow sub-issues.
    await op({ type: 'moveCard', cardId: moved.id, columnId: todo, afterCardId: null });
    await op({ type: 'setParent', cardId: moved.id, parentCardId: null });
    b = await board();
    expect(card(b, 'Login').github).toMatchObject({ state: 'open', parent: null });
    expect(card(b, 'Epic: Login').github?.subIssues).toEqual({ total: 1, completed: 0 });

    await op({ type: 'removeCard', cardId: moved.id });
    expect(card(await board(), 'Login')).toBeUndefined();
  });

  it('rejects invalid ops', async () => {
    const { op } = await setup();
    expect((await op({ type: 'nope' })).status).toBe(400);
    expect((await op({ type: 'removeCard', cardId: 'missing' })).status).toBe(404);
    expect(
      (await op({ type: 'updateCard', cardId: 'PVTI_2', patch: { sprint: 'Sprint 9' } })).status,
    ).toBe(400);
  });

  it('checks webhook signatures and notifies watchers of the repo', async () => {
    const { app, board, auth } = await setup();
    await board(); // the hub learns which repos the Project shows
    const events: string[] = [];
    const stop = app.github!.hub.subscribe(PROJECT, auth.Authorization.slice(7), (e) =>
      events.push(e),
    );
    const payload = JSON.stringify({
      action: 'edited',
      repository: { full_name: 'devbord-demo/app' },
    });
    const send = (signature: string) =>
      request(app)
        .post('/api/github/webhooks')
        .set('Content-Type', 'application/json')
        .set('X-GitHub-Event', 'issues')
        .set('X-Hub-Signature-256', signature)
        .send(payload);

    expect((await send('sha256=bad')).status).toBe(401);
    const ok = await send(signPayload(CONFIG.webhookSecret, payload));
    expect(ok.body.notified).toEqual([PROJECT]);
    expect(events).toEqual(['changed']);
    stop();
  });

  it('polling notices changes made on GitHub', async () => {
    const { app, board, auth, fake } = await setup();
    await board();
    const events: string[] = [];
    const stop = app.github!.hub.subscribe(PROJECT, auth.Authorization.slice(7), (e) =>
      events.push(e),
    );
    await app.github!.hub.poll();
    expect(events).toEqual([]);
    fake.editOnGithub(2, 'Cambiado en GitHub');
    await app.github!.hub.poll();
    expect(events).toEqual(['changed']);
    stop();
  });
});
