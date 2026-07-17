import type {
  TargetAudience,
  TargetAudienceGeo,
} from '../validation/target-audience.validation';

export type AudienceContext = {
  userId: string;
  locale?: string;
  platform?: string;
  appVersion?: string;
  latitude?: number;
  longitude?: number;
};

export type AudienceMatchResult =
  | { matched: true }
  | { matched: false; reason: string };

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in km between two WGS84 points. */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

function parseGeoPoint(raw: unknown): TargetAudienceGeo | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const g = raw as Record<string, unknown>;
  if (
    typeof g.latitude !== 'number' ||
    typeof g.longitude !== 'number' ||
    typeof g.radiusKm !== 'number'
  ) {
    return null;
  }
  return {
    latitude: g.latitude,
    longitude: g.longitude,
    radiusKm: g.radiusKm,
    ...(typeof g.label === 'string' && g.label.trim()
      ? { label: g.label.trim() }
      : {}),
  };
}

/** Normalize legacy single `geo` + `geos[]` into one list. */
export function resolveAudienceGeos(raw: Record<string, unknown>): TargetAudienceGeo[] {
  const fromArray = Array.isArray(raw.geos)
    ? raw.geos.map(parseGeoPoint).filter((g): g is TargetAudienceGeo => g != null)
    : [];
  const legacy = parseGeoPoint(raw.geo);
  if (legacy && fromArray.length === 0) {
    return [legacy];
  }
  if (
    legacy &&
    !fromArray.some(
      (g) =>
        g.latitude === legacy.latitude &&
        g.longitude === legacy.longitude &&
        g.radiusKm === legacy.radiusKm,
    )
  ) {
    return [legacy, ...fromArray];
  }
  return fromArray;
}

function normalizeAudience(
  raw: unknown,
): TargetAudience & { geosResolved: TargetAudienceGeo[] } {
  if (!raw || typeof raw !== 'object') {
    return { allowAll: true, geosResolved: [] };
  }
  const o = raw as Record<string, unknown>;
  return {
    allowAll: o.allowAll !== false,
    locales: Array.isArray(o.locales)
      ? o.locales.filter((x): x is string => typeof x === 'string')
      : undefined,
    platforms: Array.isArray(o.platforms)
      ? o.platforms.filter(
          (x): x is 'ios' | 'android' => x === 'ios' || x === 'android',
        )
      : undefined,
    geos: resolveAudienceGeos(o),
    geosResolved: resolveAudienceGeos(o),
  };
}

/**
 * Returns whether the request context matches the campaign/survey audience rules.
 * `allowAll: true` (default) skips all audience filters.
 * Multiple geo locations: user matches if inside **any** radius.
 */
export function matchesTargetAudience(
  audienceRaw: unknown,
  ctx: AudienceContext,
): AudienceMatchResult {
  const audience = normalizeAudience(audienceRaw);
  if (audience.allowAll) {
    return { matched: true };
  }

  if (audience.locales?.length) {
    const locale = ctx.locale?.trim();
    if (!locale || !audience.locales.includes(locale)) {
      return { matched: false, reason: 'audience_locale_mismatch' };
    }
  }

  if (audience.platforms?.length) {
    if (!ctx.platform || !audience.platforms.includes(ctx.platform as 'ios' | 'android')) {
      return { matched: false, reason: 'audience_platform_mismatch' };
    }
  }

  const geos = audience.geosResolved;
  if (geos.length > 0) {
    if (
      typeof ctx.latitude !== 'number' ||
      typeof ctx.longitude !== 'number' ||
      !Number.isFinite(ctx.latitude) ||
      !Number.isFinite(ctx.longitude)
    ) {
      return { matched: false, reason: 'audience_geo_location_missing' };
    }
    const insideAny = geos.some((g) => {
      const distance = haversineKm(
        ctx.latitude!,
        ctx.longitude!,
        g.latitude,
        g.longitude,
      );
      return distance <= g.radiusKm;
    });
    if (!insideAny) {
      return { matched: false, reason: 'audience_geo_out_of_range' };
    }
  }

  return { matched: true };
}
