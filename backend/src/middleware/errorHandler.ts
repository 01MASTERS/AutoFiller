import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      status: 'error',
      error: 'Invalid request payload',
      details: err.errors,
    });
  }

  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      status: 'error',
      error: err.message,
    });
  }

  console.error('Unhandled Server Error:', err);
  return res.status(500).json({
    status: 'error',
    error: err.message || 'Internal Server Error',
  });
}
