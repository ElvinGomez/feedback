import { RequestHandler } from 'express';
import env from '../config/env';

export const requireInternalApiKey: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  const expected = env.internalApiKey;
  if (!expected) {
    res.status(503).json({
      message: 'Feedback service internal API is not configured',
      code: 'INTERNAL_FEEDBACK_DISABLED',
    });
    return;
  }
  const token =
    header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
  if (!token || token !== expected) {
    res.status(401).json({
      message: 'Unauthorized',
      code: 'INVALID_INTERNAL_KEY',
    });
    return;
  }
  next();
};
