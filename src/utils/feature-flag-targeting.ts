import { createHash } from 'crypto';

/**
 * Keep in sync with `backend/config/src/platform/flags/evaluate.ts`.
 * Same SHA-256 bucket so admin % rollout matches API enforcement.
 */
export type FeatureFlagTargeting = {
  country?: string[];
  role?: string[];
  user?: string[];
  percentage?: number;
};

export type FeatureFlagEvalContext = {
  userId?: string;
  country?: string;
  roles?: string[];
};

export function percentageBucket(userId: string, path: string): number {
  const hex = createHash('sha256')
    .update(`${userId}:${path}`)
    .digest('hex')
    .slice(0, 8);
  return parseInt(hex, 16) % 100;
}

export function evaluateTargeting(
  targeting: FeatureFlagTargeting | undefined,
  ctx: FeatureFlagEvalContext,
  path: string,
): boolean {
  if (!targeting) {
    return true;
  }
  if (targeting.country && targeting.country.length > 0) {
    const country = ctx.country?.trim().toUpperCase();
    if (
      !country ||
      !targeting.country.map((c) => c.toUpperCase()).includes(country)
    ) {
      return false;
    }
  }
  if (targeting.role && targeting.role.length > 0) {
    const roles = new Set((ctx.roles ?? []).map((r) => r.trim()));
    if (!targeting.role.some((r) => roles.has(r))) {
      return false;
    }
  }
  if (targeting.user && targeting.user.length > 0) {
    if (!ctx.userId || !targeting.user.includes(ctx.userId)) {
      return false;
    }
  }
  if (typeof targeting.percentage === 'number') {
    if (targeting.percentage >= 100) {
      return true;
    }
    if (targeting.percentage <= 0) {
      return false;
    }
    if (!ctx.userId) {
      return false;
    }
    return percentageBucket(ctx.userId, path) < targeting.percentage;
  }
  return true;
}

export function parseTargetingByPath(
  raw: unknown,
): Record<string, FeatureFlagTargeting> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const out: Record<string, FeatureFlagTargeting> = {};
  for (const [path, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }
    const row = value as Record<string, unknown>;
    const targeting: FeatureFlagTargeting = {};
    if (Array.isArray(row.country)) {
      targeting.country = row.country.filter(
        (item): item is string => typeof item === 'string' && item.trim() !== '',
      );
    }
    if (Array.isArray(row.role)) {
      targeting.role = row.role.filter(
        (item): item is string => typeof item === 'string' && item.trim() !== '',
      );
    }
    if (Array.isArray(row.user)) {
      targeting.user = row.user.filter(
        (item): item is string => typeof item === 'string' && item.trim() !== '',
      );
    }
    if (
      typeof row.percentage === 'number' &&
      Number.isInteger(row.percentage) &&
      row.percentage >= 0 &&
      row.percentage <= 100
    ) {
      targeting.percentage = row.percentage;
    }
    out[path] = targeting;
  }
  return out;
}

export function evalContextFromRequest(req: {
  logtoUser?: { id?: string; roles?: string[] };
}): FeatureFlagEvalContext {
  return {
    userId: req.logtoUser?.id,
    roles: req.logtoUser?.roles,
  };
}

export function isTargetingAllowedForRequest(
  targetingByPath: Record<string, FeatureFlagTargeting> | undefined,
  path: string,
  req: { logtoUser?: { id?: string; roles?: string[] } },
): boolean {
  return evaluateTargeting(
    targetingByPath?.[path],
    evalContextFromRequest(req),
    path,
  );
}
