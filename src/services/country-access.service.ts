import type { Request } from 'express';
import { ApiError } from '../utils/error/error.api';
import { logger } from '../utils/logger';
import { getAllowedCountryCodes } from './allowed-countries-cache.service';
import { reverseGeocodeCountryCode } from './geocoding.service';
import { resolveClientIpCountryCode } from './ip-country.service';
import { isTravelModeEnabled } from './travel-mode.service';

export type AudienceCountryAccessInput = {
  req: Request;
  countryCode: string;
  latitude: number;
  longitude: number;
};

export type AudienceGeoCenter = {
  latitude: number;
  longitude: number;
  travelMode: boolean;
};

/**
 * Hard gate: countryCode must be on the admin allowlist.
 * Travel mode does not bypass this.
 */
export async function assertCountryAllowed(countryCode: string): Promise<void> {
  const code = countryCode.toUpperCase();
  const allowed = await getAllowedCountryCodes();
  if (!allowed.has(code)) {
    throw new ApiError('COUNTRY_NOT_ALLOWED');
  }
}

/**
 * Origin mode: device GPS reverse-geocode must match countryCode.
 * IP country is advisory (VPN/local false positives are common); logged when it differs.
 * Travel mode: skip GPS + IP checks; caller may use search center for audience matching.
 * Allowlist is always enforced first.
 */
export async function assertAudienceCountryAccess(
  input: AudienceCountryAccessInput,
): Promise<{ travelMode: boolean }> {
  await assertCountryAllowed(input.countryCode);

  const travelMode = await isTravelModeEnabled(input.req);
  if (travelMode) {
    return { travelMode: true };
  }

  const expected = input.countryCode.toUpperCase();

  const [gpsCountry, ipCountry] = await Promise.all([
    reverseGeocodeCountryCode(input.latitude, input.longitude),
    resolveClientIpCountryCode(input.req),
  ]);

  const gpsMismatch = gpsCountry.toUpperCase() !== expected;
  const ipResolved = ipCountry !== 'XX';
  const ipMismatch = ipResolved && ipCountry.toUpperCase() !== expected;

  if (gpsMismatch) {
    logger.warn('Audience COUNTRY_MISMATCH (GPS)', {
      expected,
      gpsCountry,
      ipCountry,
      latitude: input.latitude,
      longitude: input.longitude,
    });
    throw new ApiError('COUNTRY_MISMATCH');
  }

  if (ipMismatch) {
    // GPS matches — allow request. IP often disagrees under VPN / carrier NAT.
    logger.warn('Audience IP country differs from GPS (allowing)', {
      expected,
      gpsCountry,
      ipCountry,
    });
  }

  return { travelMode: false };
}

/**
 * Pick the audience-matching center: search coords when Travel mode + provided; else device GPS.
 */
export function resolveAudienceGeoCenter(opts: {
  travelMode: boolean;
  deviceLatitude: number;
  deviceLongitude: number;
  searchLatitude?: number;
  searchLongitude?: number;
}): AudienceGeoCenter {
  if (
    opts.travelMode &&
    opts.searchLatitude !== undefined &&
    opts.searchLongitude !== undefined &&
    Number.isFinite(opts.searchLatitude) &&
    Number.isFinite(opts.searchLongitude)
  ) {
    return {
      latitude: opts.searchLatitude,
      longitude: opts.searchLongitude,
      travelMode: true,
    };
  }
  return {
    latitude: opts.deviceLatitude,
    longitude: opts.deviceLongitude,
    travelMode: opts.travelMode,
  };
}
