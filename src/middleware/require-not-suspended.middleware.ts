import type { RequestHandler } from 'express';
import { lookupUserSuspension } from '../services/user-suspension.service';

/**
 * After Logto auth: reject suspended users with 403 ACCOUNT_SUSPENDED.
 * When user-management is configured, lookup failures fail closed (503).
 */
export const requireNotSuspended: RequestHandler = async (req, res, next) => {
  try {
    const userId =
      req.logtoUser?.id ??
      (req as { user?: { id?: string } }).user?.id;
    if (!userId) {
      next();
      return;
    }

    const result = await lookupUserSuspension(userId);
    if (result.status === 'skipped') {
      next();
      return;
    }
    if (result.status === 'error') {
      res.status(503).json({
        status: 'error',
        message: result.message,
        code: 'SUSPENSION_CHECK_FAILED',
      });
      return;
    }
    if (result.isSuspended) {
      res.status(403).json({
        status: 'error',
        message: 'Account suspended',
        code: 'ACCOUNT_SUSPENDED',
      });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
};
