export const CAMPAIGN_PLACEMENTS = [
  'home',
  'spot_detail',
  'app_launch',
  'after_content_report',
  'profile',
  'explore',
] as const;

export type CampaignPlacement = (typeof CAMPAIGN_PLACEMENTS)[number];

/** Promotions may only use these placements in v1. */
export const PROMOTION_PLACEMENTS_V1 = ['home'] as const;

export const CAMPAIGN_CONTENT_TYPES = ['survey', 'promotion'] as const;
export type CampaignContentType = (typeof CAMPAIGN_CONTENT_TYPES)[number];

export const PROMOTION_STATUSES = [
  'draft',
  'scheduled',
  'active',
  'paused',
  'expired',
  'archived',
] as const;
export type PromotionStatus = (typeof PROMOTION_STATUSES)[number];

export const MODAL_SIZES = ['small', 'medium', 'full_screen'] as const;
export type ModalSize = (typeof MODAL_SIZES)[number];

export const MEDIA_TYPES = ['none', 'image', 'video', 'html'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

/**
 * Style capabilities per modal size:
 * - small: title + message only
 * - medium: title, message + optional image
 * - full_screen: title, message, background, image/video, or html content
 */
export const ALLOWED_MEDIA_TYPES_BY_MODAL_SIZE: Record<
  ModalSize,
  readonly MediaType[]
> = {
  small: ['none'],
  medium: ['none', 'image'],
  full_screen: ['none', 'image', 'video', 'html'],
};

/** Only these modal sizes may set a custom background. */
export const BACKGROUND_ALLOWED_MODAL_SIZES: readonly ModalSize[] = [
  'full_screen',
];

export const ACTION_TYPES = [
  'external_url',
  'in_app_route',
  'deep_link',
  'dismiss_only',
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const FREQUENCY_RULES = [
  'none',
  'once_per_session',
  'once_per_day',
  'every_n_hours',
  'max_impressions_per_user',
] as const;
export type FrequencyRule = (typeof FREQUENCY_RULES)[number];

export const CAMPAIGN_EVENT_TYPES = [
  'campaign_entry_shown',
  'campaign_entry_tapped',
  'promotion_selected',
  'promotion_impression',
  'promotion_dismissed',
  'promotion_primary_cta_clicked',
  'promotion_secondary_cta_clicked',
  'promotion_link_opened',
  'promotion_video_started',
  'promotion_video_completed',
  'promotion_media_failed',
  'survey_selected',
  'survey_started',
  'survey_completed',
] as const;
export type CampaignEventType = (typeof CAMPAIGN_EVENT_TYPES)[number];

export const SELECTION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
