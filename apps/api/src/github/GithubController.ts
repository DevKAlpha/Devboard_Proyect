/**
 * Controller + routes of the GitHub module (HTTP only; logic in GithubService).
 *
 * The web app authenticates with `Authorization: Bearer <session id>`; the
 * session id comes from the sign-in popup. Live updates use Server-Sent Events
 * read with fetch (EventSource cannot send that header).
 */
import express, { Router, type Request, type Response } from 'express';
import { HttpError } from '../middleware/errors';
import { verifySignature } from './crypto';
import type { GithubService } from './GithubService';

type ProjectParams = { id: string };

/** Keeps idle SSE connections (and proxies in between) from timing out. */
const HEARTBEAT_MS = 25_000;

const sessionOf = (req: Request) => {
  const auth = req.header('authorization') ?? '';
  const id = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!id) throw new HttpError(401, 'no_session', 'Sign in with GitHub');
  return id;
};

export class GithubController {
  constructor(
    private readonly service: GithubService,
    private readonly webhookSecret: string,
  ) {}

  login = (req: Request, res: Response) => {
    const state = typeof req.query.state === 'string' ? req.query.state.slice(0, 100) : '';
    res.redirect(this.service.loginUrl(state));
  };

  callback = async (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    res.redirect(await this.service.callback(code, state));
  };

  me = async (req: Request, res: Response) => {
    res.json(await this.service.me(sessionOf(req)));
  };

  logout = (req: Request, res: Response) => {
    this.service.logout(sessionOf(req));
    res.status(204).end();
  };

  projects = async (req: Request, res: Response) => {
    res.json(await this.service.projects(sessionOf(req)));
  };

  board = async (req: Request<ProjectParams>, res: Response) => {
    res.json(await this.service.board(sessionOf(req), req.params.id));
  };

  op = async (req: Request<ProjectParams>, res: Response) => {
    res.json(await this.service.op(sessionOf(req), req.params.id, req.body));
  };

  events = async (req: Request<ProjectParams>, res: Response) => {
    const sessionId = sessionOf(req);
    await this.service.token(sessionId); // reject bad sessions before streaming
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Some proxies (nginx) buffer responses unless told not to.
      'X-Accel-Buffering': 'no',
    });
    const send = (event: string, data: unknown) =>
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send('ready', { projectId: req.params.id });
    const unsubscribe = this.service.hub.subscribe(req.params.id, sessionId, send);
    const beat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
    req.on('close', () => {
      clearInterval(beat);
      unsubscribe();
    });
  };

  webhook = (req: Request, res: Response) => {
    const body = req.body as Buffer;
    if (
      !Buffer.isBuffer(body) ||
      !verifySignature(this.webhookSecret, body, req.header('x-hub-signature-256'))
    ) {
      throw new HttpError(401, 'bad_signature', 'Invalid webhook signature');
    }
    const event = req.header('x-github-event') ?? '';
    const payload = JSON.parse(body.toString('utf8')) as Record<string, unknown>;
    res.json({ notified: this.service.webhook(event, payload) });
  };
}

/** Webhook route: needs the raw body for the signature, so it is mounted before express.json. */
export const githubWebhookRoute = (controller: GithubController) =>
  Router().post('/', express.raw({ type: '*/*', limit: '5mb' }), controller.webhook);

export function githubRoutes(controller: GithubController): Router {
  return Router()
    .get('/login', controller.login)
    .get('/callback', controller.callback)
    .get('/me', controller.me)
    .post('/logout', controller.logout)
    .get('/projects', controller.projects)
    .get('/projects/:id/board', controller.board)
    .post('/projects/:id/ops', controller.op)
    .get('/projects/:id/events', controller.events);
}
