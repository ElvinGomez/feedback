import type { Request } from 'express';
import { getGlobalTravelModeState } from './feature-flags-cache.service';
import { isTargetingAllowedForRequest } from '../utils/feature-flag-targeting';

export const TRAVEL_MODE_FEATURE_PATH = 'travel:mode';

type RequestWithLogtoUser = Request & {
  logtoUser?: { featurePaths?: string[] };
};

/**
 * Travel mode entitlement seam — must match spots' `isTravelModeEnabled`
 * (same JWT feature path + same global `travel.mode` leaf)
 * so a user's Travel mode toggle behaves identically across every service.
 */
export async function isTravelModeEnabled(req: Request): Promise<boolean> {
  const r = req as RequestWithLogtoUser;
  const featurePaths = r.logtoUser?.featurePaths ?? [];
  const hasPath = featurePaths.includes(TRAVEL_MODE_FEATURE_PATH);
  if (!hasPath) {
    return false;
  }

  const state = await getGlobalTravelModeState();
  if (state === null) {
    // Config service unset → open mode; path alone is enough.
    return true;
  }
  if (!state.enabled) {
    return false;
  }
  return isTargetingAllowedForRequest(
    state.targetingByPath,
    TRAVEL_MODE_FEATURE_PATH,
    req,
  );
}
