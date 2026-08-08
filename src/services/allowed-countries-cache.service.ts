import env from '../config/env';
import { logger } from '../utils/logger';

type Cached = {
  codes: Set<string>;
  at: number;
};

let cache: Cached | null = null;

function parseAllowedCodes(payload: unknown): string[] | null {
  const data = (payload as { data?: { allowedCountryCodes?: unknown } })?.data;
  if (!data || !Array.isArray(data.allowedCountryCodes)) {
    return null;
  }
  const codes: string[] = [];
  for (const raw of data.allowedCountryCodes) {
    if (typeof raw !== 'string') continue;
    const code = raw.trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(code)) {
      codes.push(code);
    }
  }
  return codes;
}

/**
 * Cached allowlist from config-service GET /config/countries.
 * Fail closed when config URL is unset or fetch fails with no cache.
 */
export async function getAllowedCountryCodes(): Promise<Set<string>> {
  if (!env.configServiceBaseUrl) {
    logger.warn(
      'CONFIG_SERVICE_BASE_URL unset; treating allowed countries as empty',
    );
    return new Set();
  }

  const now = Date.now();
  if (cache && now - cache.at < env.featureFlagsRefreshMs) {
    return cache.codes;
  }

  try {
    const res = await fetch(`${env.configServiceBaseUrl}/config/countries`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const parsed = parseAllowedCodes(await res.json());
    if (!parsed) {
      if (cache) return cache.codes;
      return new Set();
    }
    cache = { codes: new Set(parsed), at: now };
    return cache.codes;
  } catch (e) {
    logger.warn('Allowed countries fetch failed; using cache or empty', e);
    return cache?.codes ?? new Set();
  }
}

/** Test helper / cache bust. */
export function clearAllowedCountriesCache(): void {
  cache = null;
}
