import axios from 'axios';
import env from '../config/env';

export type PublicClientConfigForAuth = {
  featureFlagPaths: string[];
  tripsiRoles: string[];
  roleFeaturePaths: Record<string, string[]>;
};

let cache: { data: PublicClientConfigForAuth; at: number } | null = null;

function parseAuthPayload(resData: unknown): PublicClientConfigForAuth | null {
  const envelope = resData as { data?: unknown };
  const raw = envelope?.data ?? resData;
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const d = raw as Record<string, unknown>;
  if (
    !Array.isArray(d.featureFlagPaths) ||
    !Array.isArray(d.tripsiRoles) ||
    !d.roleFeaturePaths ||
    typeof d.roleFeaturePaths !== 'object' ||
    Array.isArray(d.roleFeaturePaths)
  ) {
    return null;
  }
  return {
    featureFlagPaths: d.featureFlagPaths as string[],
    tripsiRoles: d.tripsiRoles as string[],
    roleFeaturePaths: d.roleFeaturePaths as Record<string, string[]>,
  };
}

export async function fetchPublicClientConfigForAuth(): Promise<PublicClientConfigForAuth> {
  const base = env.configServiceBaseUrl;
  if (!base) {
    throw new Error(
      'CONFIG_SERVICE_BASE_URL is required to load feature paths for Logto auth',
    );
  }
  const now = Date.now();
  if (cache && now - cache.at < env.featureFlagsRefreshMs) {
    return cache.data;
  }
  const res = await axios.get(`${base}/config/client`, { timeout: 8000 });
  const parsed = parseAuthPayload(res.data);
  if (!parsed) {
    throw new Error(
      'Invalid public client config: missing featureFlagPaths/tripsiRoles/roleFeaturePaths',
    );
  }
  cache = { data: parsed, at: now };
  return parsed;
}
