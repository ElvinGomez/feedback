import axios from 'axios';
import env from '../config/env';
import { logger } from '../utils/logger';
import {
  parseTargetingByPath,
  type FeatureFlagTargeting,
} from '../utils/feature-flag-targeting';

export type ReportsFeatureFlags = {
  create: boolean;
  read: boolean;
  readAll: boolean;
  update: boolean;
  updateStatus: boolean;
  delete: boolean;
  stats: boolean;
  surveys: boolean;
  campaignDelivery: boolean;
  promotions: boolean;
  announcements: boolean;
};

export type ReportsFeatureFlagsBundle = ReportsFeatureFlags & {
  targetingByPath: Record<string, FeatureFlagTargeting>;
};

let cache: { flags: ReportsFeatureFlagsBundle; at: number } | null = null;

function parseReportsPayload(data: unknown): ReportsFeatureFlagsBundle | null {
  const features = (data as { features?: Record<string, unknown> })?.features;
  if (!features || typeof features !== 'object') {
    return null;
  }
  const f = features as Record<string, unknown>;
  const fb =
    f.feedback && typeof f.feedback === 'object'
      ? (f.feedback as Record<string, unknown>)
      : null;
  const nestedReports =
    fb?.reports && typeof fb.reports === 'object'
      ? (fb.reports as Record<string, unknown>)
      : null;
  const legacyTopReports =
    f.reports && typeof f.reports === 'object'
      ? (f.reports as Record<string, unknown>)
      : null;
  const p = nestedReports ?? legacyTopReports;
  if (!p) {
    return null;
  }
  const surveys = Boolean(
    (typeof fb?.surveys === 'boolean' ? fb.surveys : undefined) ??
      (typeof legacyTopReports?.surveys === 'boolean'
        ? legacyTopReports.surveys
        : false),
  );
  const campaignDelivery = Boolean(
    typeof fb?.campaignDelivery === 'boolean' ? fb.campaignDelivery : false,
  );
  const promotions = Boolean(
    typeof fb?.promotions === 'boolean' ? fb.promotions : false,
  );
  const announcements = Boolean(
    typeof fb?.announcements === 'boolean' ? fb.announcements : false,
  );
  return {
    create: Boolean(p.create),
    read: Boolean(p.read),
    readAll: Boolean(p.readAll),
    update: Boolean(p.update),
    updateStatus: Boolean(p.updateStatus),
    delete: Boolean(p.delete),
    stats: Boolean(p.stats),
    surveys,
    campaignDelivery,
    promotions,
    announcements,
    targetingByPath: parseTargetingByPath(
      (data as { targetingByPath?: unknown }).targetingByPath,
    ),
  };
}

export async function getReportsFeatureFlags(): Promise<ReportsFeatureFlagsBundle | null> {
  if (!env.configServiceBaseUrl) {
    return null;
  }
  const now = Date.now();
  if (cache && now - cache.at < env.featureFlagsRefreshMs) {
    return cache.flags;
  }
  try {
    const res = await axios.get(`${env.configServiceBaseUrl}/config/client`, {
      timeout: 5000,
    });
    const flags = parseReportsPayload(res.data?.data);
    if (!flags) {
      return cache?.flags ?? null;
    }
    cache = { flags, at: now };
    return flags;
  } catch (e) {
    logger.warn('Feature flags fetch failed; using cache or open mode', e);
    return cache?.flags ?? null;
  }
}

let travelModeCache: {
  enabled: boolean;
  targetingByPath: Record<string, FeatureFlagTargeting>;
  at: number;
} | null = null;

function parseTravelModeState(data: unknown): {
  enabled: boolean;
  targetingByPath: Record<string, FeatureFlagTargeting>;
} | null {
  const features = (data as { features?: Record<string, unknown> })?.features;
  const travel =
    features?.travel && typeof features.travel === 'object'
      ? (features.travel as Record<string, unknown>)
      : null;
  if (!travel || typeof travel.mode !== 'boolean') {
    return null;
  }
  return {
    enabled: travel.mode,
    targetingByPath: parseTargetingByPath(
      (data as { targetingByPath?: unknown }).targetingByPath,
    ),
  };
}

/**
 * Global Travel-mode toggle (`travel.mode`), shared across
 * every service — must match spots' own reading of the same config leaf.
 */
export async function getGlobalTravelModeFlag(): Promise<boolean | null> {
  const state = await getGlobalTravelModeState();
  return state?.enabled ?? null;
}

export async function getGlobalTravelModeState(): Promise<{
  enabled: boolean;
  targetingByPath: Record<string, FeatureFlagTargeting>;
} | null> {
  if (!env.configServiceBaseUrl) {
    return null;
  }
  const now = Date.now();
  if (travelModeCache && now - travelModeCache.at < env.featureFlagsRefreshMs) {
    return {
      enabled: travelModeCache.enabled,
      targetingByPath: travelModeCache.targetingByPath,
    };
  }
  try {
    const res = await axios.get(`${env.configServiceBaseUrl}/config/client`, {
      timeout: 5000,
    });
    const parsed = parseTravelModeState(res.data?.data);
    if (!parsed) {
      return travelModeCache
        ? {
            enabled: travelModeCache.enabled,
            targetingByPath: travelModeCache.targetingByPath,
          }
        : null;
    }
    travelModeCache = { ...parsed, at: now };
    return parsed;
  } catch (e) {
    logger.warn('Travel mode flag fetch failed; using cache or open mode', e);
    return travelModeCache
      ? {
          enabled: travelModeCache.enabled,
          targetingByPath: travelModeCache.targetingByPath,
        }
      : null;
  }
}
