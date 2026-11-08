/**
 * Controller layer: maps HTTP requests to service calls and shapes responses.
 * Express 5 forwards rejected promises to the error middleware automatically,
 * so handlers stay free of try/catch.
 */
import type { Request, Response } from 'express';
import type { BoardService } from '../services/BoardService';

type IdParams = { id: string };

export class BoardController {
  constructor(private readonly service: BoardService) {}

  list = async (_req: Request, res: Response) => {
    res.json(await this.service.list());
  };

  get = async (req: Request<IdParams>, res: Response) => {
    res.json(await this.service.get(req.params.id));
  };

  put = async (req: Request<IdParams>, res: Response) => {
    res.json(await this.service.put(req.params.id, req.body));
  };

  remove = async (req: Request<IdParams>, res: Response) => {
    await this.service.remove(req.params.id);
    res.status(204).end();
  };
}
