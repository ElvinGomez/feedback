import type { RequestHandler } from 'express';
import { fetchUserSuspended } from '../services/user-suspension.service';

export const requireNotSuspended: RequestHandler = async (req, res, next) => {
  try {
    const userId =
      req.logtoUser?.id ??
      (req as { user?: { id?: string } }).user?.id;
    if (!userId) {
      next();
      return;
    }

    const suspended = await fetchUserSuspended(userId);
    if (suspended === true) {
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
