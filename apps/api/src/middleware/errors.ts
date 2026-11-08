/**
 * Centralised HTTP error handling.
 * Controllers throw HttpError (or let zod errors bubble); this middleware
 * turns them into consistent JSON: `{ error: { code, message, details? } }`.
 */
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound: RequestHandler = (req, _res, next) =>
  next(new HttpError(404, 'not_found', `Route ${req.method} ${req.path} not found`));

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: 'validation_error', message: 'Invalid request body', details: err.issues },
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  console.error('[api] Unhandled error', err);
  res.status(500).json({ error: { code: 'internal_error', message: 'Unexpected error' } });
};
