import { RequestHandler } from 'express';
import { permissionPathForResourceKey } from '@tripsi-app/logto-server-auth';
import {
  getReportsFeatureFlags,
  type ReportsFeatureFlags,
} from '../services/feature-flags-cache.service';
import { isTargetingAllowedForRequest } from '../utils/feature-flag-targeting';

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

/**
 * Map HTTP method + path relative to `/feedback/analytics` mount.
 */
export function analyticsRouteToFlagKey(
  method: string,
  path: string,
): ReportRouteFlagKey | null {
  const m = method.toUpperCase();
  if (m === 'POST' && path === '/events') {
    return 'analytics';
  }
  return null;
}

/**
 * Map HTTP method + path relative to `/feedback/announcements` mount.
 */
export function announcementRouteToFlagKey(
  method: string,
  path: string,
): ReportRouteFlagKey | null {
  const m = method.toUpperCase();
  if (m === 'GET' && path === '/active') {
    return 'announcements';
  }
  if (m === 'POST' && /^\/[^/]+\/events$/.test(path)) {
    return 'announcements';
  }
  return null;
}

export function flagKeyForRequest(
  method: string,
  path: string,
  baseUrl: string,
): ReportRouteFlagKey | null {
  if (baseUrl.includes('/analytics')) {
    return analyticsRouteToFlagKey(method, path);
  }
  if (baseUrl.includes('/announcements')) {
    return announcementRouteToFlagKey(method, path);
  }
  return reportRouteToFlagKey(method, path);
}

export function flagPermissionPath(key: ReportRouteFlagKey): string {
  if (key === 'surveys') {
    return permissionPathForResourceKey('feedback', 'surveys');
  }
  if (key === 'analytics') {
    return 'feedback:analytics';
  }
  if (key === 'campaignDelivery') {
    return 'feedback:campaign_delivery';
  }
  if (key === 'promotions') {
    return permissionPathForResourceKey('feedback', 'promotions');
  }
  if (key === 'announcements') {
    return permissionPathForResourceKey('feedback', 'announcements');
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
  const key = flagKeyForRequest(req.method, req.path, req.baseUrl || '');
  if (key === null) {
    next();
    return;
  }
  const flag = flagPermissionPath(key);
  if (!flags[key]) {
    res.status(503).json({
      message: 'This reports capability is temporarily disabled',
      code: 'REPORTS_FEATURE_DISABLED',
      flag,
    });
    return;
  }
  if (!isTargetingAllowedForRequest(flags.targetingByPath, flag, req)) {
    res.status(503).json({
      message: 'This reports capability is temporarily disabled',
      code: 'REPORTS_FEATURE_DISABLED',
      flag,
    });
    return;
  }
  next();
};
