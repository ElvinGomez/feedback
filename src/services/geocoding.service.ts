import env from '../config/env';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/error/error.api';

type CacheEntry = { countryCode: string; at: number };

const cache = new Map<string, CacheEntry>();

function cacheKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
}

function normalizeCountryCode(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/**
 * Reverse-geocode lat/lng to ISO 3166-1 alpha-2 via Mapbox.
 */
export async function reverseGeocodeCountryCode(
  latitude: number,
  longitude: number,
): Promise<string> {
  const key = cacheKey(latitude, longitude);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < env.geocodeCacheTtlMs) {
    return hit.countryCode;
  }

  const token = env.mapboxAccessToken;
  if (!token) {
    logger.error('MAPBOX_ACCESS_TOKEN is not configured');
    throw new ApiError('INTERNAL_SERVER_ERROR');
  }

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json` +
    `?types=country&limit=1&access_token=${encodeURIComponent(token)}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      logger.warn('Mapbox reverse geocode failed', { status: res.status });
      throw new ApiError('COUNTRY_MISMATCH');
    }
    const body = (await res.json()) as {
      features?: Array<{ properties?: { short_code?: string }; text?: string }>;
    };
    const feature = body.features?.[0];
    // Mapbox country short_code is often lowercase ISO (e.g. "pa") or "US-xx" for regions; prefer short_code.
    const short = feature?.properties?.short_code;
    const fromShort = short?.includes('-')
      ? short.split('-')[0]
      : short;
    const countryCode = normalizeCountryCode(fromShort);
    if (!countryCode) {
      throw new ApiError('COUNTRY_MISMATCH');
    }
    cache.set(key, { countryCode, at: Date.now() });
    return countryCode;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    logger.warn('Mapbox reverse geocode error', err);
    throw new ApiError('COUNTRY_MISMATCH');
  }
}
