import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodType } from 'zod';
import { logger } from '../utils/logger';
import { RequestError } from '../utils/error/error.request';

export const validate = (
  schema: ZodType,
  type: 'body' | 'query' | 'params' = 'body',
) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const data = await schema.parseAsync(req[type]);
      req[type] = data as never;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Validation error:', error.errors);
        next(
          new RequestError('INVALID_REQUEST', {
            type: type.charAt(0).toUpperCase() + type.slice(1),
            issues: error.issues,
          }),
        );
        return;
      }
      logger.error('Unexpected error during validation:', error);
      next(error);
    }
  };
};
