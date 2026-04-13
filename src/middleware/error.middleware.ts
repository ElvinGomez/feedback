import { BaseError } from '../utils/error/error.base';
import { ApiError } from '../utils/error/error.api';
import { Request, Response, NextFunction } from 'express';

function errorMiddleware(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof BaseError) {
    res.statusMessage = error.message;
    let e: BaseError = error;
    if (e.code === 60203 || e.code === 20429) {
      e = new ApiError('RATE_LIMIT');
    }
    res.status(e.status).json({
      code: e.code,
      name: e.name,
      message: e.message,
      detail: e.detail ?? null,
    });
    return;
  }

  const err = error as { type?: string };
  if (err?.type === 'entity.parse.failed') {
    const e = new ApiError('INTERNAL_SERVER_ERROR');
    res.status(e.status).json({
      code: e.code,
      name: e.name,
      message: e.message,
      detail: null,
    });
    return;
  }

  const e = new ApiError('INTERNAL_SERVER_ERROR');
  res.status(e.status).json({
    code: e.code,
    name: e.name,
    message: e.message,
    detail: null,
  });
}

export default errorMiddleware;
