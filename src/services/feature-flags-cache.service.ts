import axios from 'axios';
import env from '../config/env';
import { logger } from '../utils/logger';

export type ReportsFeatureFlags = {
  create: boolean;
  read: boolean;
  readAll: boolean;
  update: boolean;
  updateStatus: boolean;
  delete: boolean;
  stats: boolean;
  surveys: boolean;
};

let cache: { flags: ReportsFeatureFlags; at: number } | null = null;

function parseReportsPayload(data: unknown): ReportsFeatureFlags | null {
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
  return {
    create: Boolean(p.create),
    read: Boolean(p.read),
    readAll: Boolean(p.readAll),
    update: Boolean(p.update),
    updateStatus: Boolean(p.updateStatus),
    delete: Boolean(p.delete),
    stats: Boolean(p.stats),
    surveys,
  };
}

export async function getReportsFeatureFlags(): Promise<ReportsFeatureFlags | null> {
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
