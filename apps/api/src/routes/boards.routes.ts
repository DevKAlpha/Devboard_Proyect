/** Routes: URL + verb → controller method. No logic lives here. */
import { Router } from 'express';
import type { BoardController } from '../controllers/BoardController';

export function boardRoutes(controller: BoardController): Router {
  return Router()
    .get('/', controller.list)
    .get('/:id', controller.get)
    .put('/:id', controller.put)
    .delete('/:id', controller.remove);
}
