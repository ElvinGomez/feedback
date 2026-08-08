import { z } from 'zod';

export const targetAudienceGeoSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusKm: z.number().min(0.1).max(5000),
  /** Optional admin label (e.g. city name). */
  label: z.string().max(120).optional(),
});

export const targetAudienceSchema = z.object({
  allowAll: z.boolean().default(true),
  locales: z.array(z.string().min(2).max(32)).optional(),
  platforms: z.array(z.enum(['ios', 'android'])).optional(),
  /** Preferred: one or more radius gates; user matches if inside any. */
  geos: z.array(targetAudienceGeoSchema).max(50).optional(),
  /** @deprecated Prefer `geos`. Still accepted and merged into `geos` when reading. */
  geo: targetAudienceGeoSchema.nullable().optional(),
});

export type TargetAudience = z.infer<typeof targetAudienceSchema>;
export type TargetAudienceGeo = z.infer<typeof targetAudienceGeoSchema>;

export const DEFAULT_TARGET_AUDIENCE: TargetAudience = { allowAll: true };

export const optionalLatLngQuerySchema = {
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
};

/**
 * Discovery location contract shared with spots (Travel mode):
 * - `latitude`/`longitude` — always real device GPS.
 * - `countryCode` — effective country (Travel selection or detected); when present
 *   the server enforces the admin allowlist + GPS/IP residency (skipped in Travel mode).
 * - `searchLatitude`/`searchLongitude` — Travel browse pin; overrides the device
 *   coords for audience geo-matching only when Travel mode is active.
 * All fields optional for backward compatibility with older app builds that
 * don't send them — the server simply skips gating when `countryCode` is absent.
 */
export const optionalAudienceLocationQuerySchema = {
  ...optionalLatLngQuerySchema,
  countryCode: z.string().length(2).optional(),
  searchLatitude: z.coerce.number().min(-90).max(90).optional(),
  searchLongitude: z.coerce.number().min(-180).max(180).optional(),
};
