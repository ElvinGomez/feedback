import env from '../config/env';
import { logger } from '../utils/logger';

type CacheEntry = { isSuspended: boolean; at: number };

const cache = new Map<string, CacheEntry>();

export type SuspensionLookupResult =
  | { status: 'ok'; isSuspended: boolean }
  | { status: 'skipped' }
  | { status: 'error'; message: string };

/**
 * Ask user-management whether the Logto user is suspended.
 *
 * Uses GET /users/internal/profiles?q=… (gateway-safe) because dedicated
 * GET …/suspension is rejected by the API gateway JWT layer.
 */
export async function lookupUserSuspension(
  logtoUserId: string,
): Promise<SuspensionLookupResult> {
  const base = env.userManagementServiceBaseUrl;
  const key = env.usersInternalApiKey;
  if (!base || !key) {
    return { status: 'skipped' };
  }

  const cached = cache.get(logtoUserId);
  const now = Date.now();
  if (cached && now - cached.at < env.userSuspensionCacheMs) {
    return { status: 'ok', isSuspended: cached.isSuspended };
  }

  try {
    const params = new URLSearchParams({
      q: logtoUserId,
      page: '1',
      limit: '20',
    });
    const res = await fetch(
      `${base}/users/internal/profiles?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
        },
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      logger.warn(
        `Suspension lookup failed for ${logtoUserId}: ${res.status} ${detail}`,
      );
      return {
        status: 'error',
        message: `Suspension lookup failed (${res.status})`,
      };
    }
    const json = (await res.json()) as {
      items?: Array<{ id?: string; isSuspended?: unknown }>;
    };
    const items = Array.isArray(json.items) ? json.items : [];
    const match = items.find((item) => item.id === logtoUserId);
    // No profile yet → treat as not suspended.
    const isSuspended = match ? Boolean(match.isSuspended) : false;
    cache.set(logtoUserId, { isSuspended, at: now });
    return { status: 'ok', isSuspended };
  } catch (err) {
    logger.warn(`Suspension lookup error for ${logtoUserId}`, err);
    return {
      status: 'error',
      message: 'Suspension lookup unavailable',
    };
  }
}

/** @deprecated Prefer lookupUserSuspension for fail-closed handling. */
export async function fetchUserSuspended(
  logtoUserId: string,
): Promise<boolean | null> {
  const result = await lookupUserSuspension(logtoUserId);
  if (result.status === 'skipped') return null;
  if (result.status === 'error') return null;
  return result.isSuspended;
}
