/** Variables are populated after `import 'dotenv/config'` in the app entrypoint (`index.ts`). */
export default {
  port: process.env.PORT || 3010,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri:
    process.env.MONGODB_URI || 'mongodb://localhost:27017/feedback-service',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  configServiceBaseUrl:
    process.env.CONFIG_SERVICE_BASE_URL?.trim().replace(/\/+$/, '') || '',
  featureFlagsRefreshMs: Math.max(
    3000,
    Number(process.env.FEATURE_FLAGS_REFRESH_MS) || 15_000,
  ),
  logtoEndpoint: process.env.LOGTO_ENDPOINT?.trim() || '',
  logtoResource: process.env.LOGTO_RESOURCE?.trim() || undefined,

  /** Mapbox token for reverse-geocoding country from lat/lng (Travel mode residency check). */
  mapboxAccessToken: process.env.MAPBOX_ACCESS_TOKEN?.trim() || '',

  /**
   * IP→country lookup (fallback when CF-IPCountry is absent).
   * Default provider: ipinfo.io (`https://ipinfo.io/{ip}/country`).
   */
  ipGeoProvider: (process.env.IP_GEO_PROVIDER?.trim() || 'ipinfo') as string,
  ipGeoApiKey: process.env.IP_GEO_API_KEY?.trim() || '',
  ipGeoCacheTtlMs: Math.max(
    60_000,
    Number(process.env.IP_GEO_CACHE_TTL_MS) || 3_600_000,
  ),
  geocodeCacheTtlMs: Math.max(
    60_000,
    Number(process.env.GEOCODE_CACHE_TTL_MS) || 3_600_000,
  ),

  internalApiKey:
    process.env.FEEDBACK_INTERNAL_API_KEY?.trim() ||
    process.env.REPORTS_INTERNAL_API_KEY?.trim() ||
    '',
  userManagementServiceBaseUrl:
    process.env.USER_MANAGEMENT_SERVICE_BASE_URL?.trim().replace(/\/+$/, '') || '',
  usersInternalApiKey: process.env.USERS_INTERNAL_API_KEY?.trim() || '',
  userSuspensionCacheMs: Math.max(
    1000,
    Number(process.env.USER_SUSPENSION_CACHE_MS) || 30_000,
  ),
};
