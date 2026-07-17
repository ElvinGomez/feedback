import { RequestHandler } from 'express';
import { permissionPathForResourceKey } from '@tripsi-app/logto-server-auth';
import {
  getReportsFeatureFlags,
  type ReportsFeatureFlags,
} from '../services/feature-flags-cache.service';

export type ReportRouteFlagKey = keyof ReportsFeatureFlags;

/**
 * Map HTTP method + path (relative to `/feedback/reports`, `/feedback/survey`,
 * or `/feedback/campaign-delivery` mount) to a feature flag.
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
  if (m === 'GET' && path === '/content') {
    return 'campaignDelivery';
  }
  if (m === 'POST' && (path === '/events' || path === '/refresh')) {
    return 'campaignDelivery';
  }
  return null;
}

function flagPermissionPath(key: ReportRouteFlagKey): string {
  if (key === 'surveys') {
    return permissionPathForResourceKey('feedback', 'surveys');
  }
  if (key === 'campaignDelivery') {
    return 'feedback:campaign_delivery';
  }
  if (key === 'promotions') {
    return permissionPathForResourceKey('feedback', 'promotions');
  }
  return permissionPathForResourceKey('feedback', `reports.${key}`);
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
    res.status(503).json({
      message: 'This reports capability is temporarily disabled',
      code: 'REPORTS_FEATURE_DISABLED',
      flag: flagPermissionPath(key),
    });
    return;
  }
  next();
};
