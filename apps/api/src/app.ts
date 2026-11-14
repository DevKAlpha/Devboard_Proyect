/**
 * Express app factory (composition root).
 * Wires model → service → controller → routes. Accepts a store so tests
 * (and future DB adapters) can inject their own.
 */
import cors from 'cors';
import express, { type RequestHandler } from 'express';
import { config, type GithubConfig } from './config';
import { BoardController } from './controllers/BoardController';
import { FakeGithub } from './github/FakeGithub';
import { GithubClient, type Fetch } from './github/GithubClient';
import { GithubController, githubRoutes, githubWebhookRoute } from './github/GithubController';
import { GithubService } from './github/GithubService';
import { SessionStore } from './github/SessionStore';
import { HttpError, errorHandler, notFound } from './middleware/errors';
import { InMemoryBoardStore, type BoardStore } from './models/BoardStore';
import { boardRoutes } from './routes/boards.routes';
import { BoardService } from './services/BoardService';

export interface AppOptions {
  store?: BoardStore;
  /** GitHub module settings; null turns it off (routes answer 503). */
  github?: GithubConfig | null;
  /** fetch used to reach GitHub (tests pass a FakeGithub's). */
  githubFetch?: Fetch;
}

export function createApp(options: AppOptions | BoardStore = {}) {
  const opts: AppOptions = 'list' in options ? { store: options } : options;
  const store = opts.store ?? new InMemoryBoardStore();
  const gh = opts.github === undefined ? config.github : opts.github;

  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.corsOrigins }));

  let github: GithubService | null = null;
  if (gh) {
    const fetchFn = opts.githubFetch ?? (gh.fake ? new FakeGithub().fetch : fetch);
    github = new GithubService(
      gh,
      new GithubClient(gh.clientId, gh.clientSecret, fetchFn),
      new SessionStore(gh.database, gh.sessionSecret),
    );
    const controller = new GithubController(github, gh.webhookSecret);
    // Before express.json: the webhook signature is checked on the raw body.
    app.use('/api/github/webhooks', githubWebhookRoute(controller));
    app.use('/api/github', express.json({ limit: '1mb' }), githubRoutes(controller));
  } else {
    const off: RequestHandler = (_req, _res, next) =>
      next(new HttpError(503, 'github_not_configured', 'GitHub is not set up on this server'));
    app.use('/api/github', off);
  }

  app.use(express.json({ limit: '1mb' }));
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', github: Boolean(gh) });
  });
  app.use('/api/boards', boardRoutes(new BoardController(new BoardService(store))));

  app.use(notFound);
  app.use(errorHandler);
  return Object.assign(app, { github });
}
