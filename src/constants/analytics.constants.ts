export const ANALYTICS_EVENT_NAMES = [
  'user_signed_in',
  'user_signed_out',
  'spot_viewed',
  'spot_favorited',
  'spot_unfavorited',
  'spot_captured',
  'spot_shared',
  'spot_directions_opened',
  'review_submitted',
  'profile_updated',
  'profile_shared',
  'trip_plan_started',
  'trip_plan_completed',
  'ai_chat_message_sent',
  'ai_response_reported',
  'survey_completed',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export const ANALYTICS_PLATFORMS = ['ios', 'android'] as const;

export type AnalyticsPlatform = (typeof ANALYTICS_PLATFORMS)[number];

/** Retain product analytics events for 90 days. */
export const ANALYTICS_TTL_SECONDS = 90 * 24 * 60 * 60;
