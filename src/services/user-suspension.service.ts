import env from '../config/env';
import { logger } from '../utils/logger';

type CacheEntry = { isSuspended: boolean; at: number };

const cache = new Map<string, CacheEntry>();

export async function fetchUserSuspended(
  logtoUserId: string,
): Promise<boolean | null> {
  const base = env.userManagementServiceBaseUrl;
  const key = env.usersInternalApiKey;
  if (!base || !key) {
    return null;
  }

  const cached = cache.get(logtoUserId);
  const now = Date.now();
  if (cached && now - cached.at < env.userSuspensionCacheMs) {
    return cached.isSuspended;
  }

  try {
    const res = await fetch(
      `${base}/users/internal/profiles/${encodeURIComponent(logtoUserId)}/suspension`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
        },
      },
    );
    if (!res.ok) {
      logger.warn(
        `Suspension lookup failed for ${logtoUserId}: ${res.status}`,
      );
      return null;
    }
    const json = (await res.json()) as { isSuspended?: unknown };
    const isSuspended = Boolean(json.isSuspended);
    cache.set(logtoUserId, { isSuspended, at: now });
    return isSuspended;
  } catch (err) {
    logger.warn(`Suspension lookup error for ${logtoUserId}`, err);
    return null;
  }
}
