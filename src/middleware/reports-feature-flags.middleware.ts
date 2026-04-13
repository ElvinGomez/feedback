import { RequestHandler } from 'express';
import { permissionPathForResourceKey } from '@tripsi-app/logto-server-auth';
import {
  getReportsFeatureFlags,
  type ReportsFeatureFlags,
} from '../services/feature-flags-cache.service';

export type ReportRouteFlagKey = keyof ReportsFeatureFlags;

/**
 * Map HTTP method + path (relative to `/feedback/reports` or `/feedback/survey` mount) to a feature flag.
 */
export function reportRouteToFlagKey(
  method: string,
  path: string,
): ReportRouteFlagKey | null {
  const m = method.toUpperCase();
  if (m === 'POST' && path === '/') {
    return 'create';
  }
  if (m === 'GET' && path === '/eligibility') {
    return 'create';
  }
  if (m === 'GET' && path === '/active') {
    return 'surveys';
  }
  if (m === 'POST' && /^\/[^/]+\/responses$/.test(path)) {
    return 'surveys';
  }
  return null;
}

export const reportsFeatureFlagsMiddleware: RequestHandler = async (
  req,
  res,
  next,
) => {
  const flags = await getReportsFeatureFlags();
  if (!flags) {
    next();
    return;
  }
  const key = reportRouteToFlagKey(req.method, req.path);
  if (key === null) {
    next();
    return;
  }
  if (!flags[key]) {
    const flag =
      key === 'surveys'
        ? permissionPathForResourceKey('feedback', 'surveys')
        : permissionPathForResourceKey('feedback', `reports.${key}`);
    res.status(503).json({
      message: 'This reports capability is temporarily disabled',
      code: 'REPORTS_FEATURE_DISABLED',
      flag,
    });
    return;
  }
  next();
};
