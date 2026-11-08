/**
 * Express app factory (composition root).
 * Wires model → service → controller → routes. Accepts a store so tests
 * (and future DB adapters) can inject their own.
 */
import cors from 'cors';
import express from 'express';
import { config } from './config';
import { BoardController } from './controllers/BoardController';
import { errorHandler, notFound } from './middleware/errors';
import { InMemoryBoardStore, type BoardStore } from './models/BoardStore';
import { boardRoutes } from './routes/boards.routes';
import { BoardService } from './services/BoardService';

export function createApp(store: BoardStore = new InMemoryBoardStore()) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api/boards', boardRoutes(new BoardController(new BoardService(store))));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
