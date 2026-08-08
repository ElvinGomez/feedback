import type { Request } from 'express';
import { getGlobalTravelModeFlag } from './feature-flags-cache.service';

export const TRAVEL_MODE_FEATURE_PATH = 'travel:mode';

type RequestWithLogtoUser = Request & {
  logtoUser?: { featurePaths?: string[]; roles?: string[] };
};

/**
 * Travel mode entitlement seam — must match spots' `isTravelModeEnabled`
 * (same JWT feature path + same global `travel.mode` leaf)
 * so a user's Travel mode toggle behaves identically across every service.
 */
export async function isTravelModeEnabled(req: Request): Promise<boolean> {
  const r = req as RequestWithLogtoUser;
  const featurePaths = r.logtoUser?.featurePaths ?? [];
  const roles = r.logtoUser?.roles ?? [];
  const isAdmin = roles.includes('admin');

  const hasPath = isAdmin || featurePaths.includes(TRAVEL_MODE_FEATURE_PATH);
  if (!hasPath) {
    return false;
  }

  const enabled = await getGlobalTravelModeFlag();
  if (enabled === null) {
    // Config service unset → open mode; path alone is enough.
    return true;
  }
  return enabled;
}
