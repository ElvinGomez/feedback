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
