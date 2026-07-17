import mongoose from 'mongoose';
import { z } from 'zod';
import {
  ACTION_TYPES,
  CAMPAIGN_EVENT_TYPES,
  CAMPAIGN_PLACEMENTS,
  FREQUENCY_RULES,
  MEDIA_TYPES,
  MODAL_SIZES,
  PROMOTION_PLACEMENTS_V1,
  PROMOTION_STATUSES,
} from '../constants/campaign.constants';

export const campaignContentQuerySchema = z.object({
  placement: z.enum(CAMPAIGN_PLACEMENTS),
  locale: z.string().min(2).max(32).optional(),
  stableToken: z.string().uuid().optional(),
});

export const campaignEventBodySchema = z.object({
  eventId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(8).max(200),
  eventType: z.enum(CAMPAIGN_EVENT_TYPES),
  selectionToken: z.string().uuid(),
  sessionId: z.string().min(1).max(128).optional(),
  appVersion: z.string().max(32).optional(),
  platform: z.enum(['ios', 'android']).optional(),
  destinationType: z.enum(ACTION_TYPES).optional(),
  destinationValue: z.string().max(2000).optional(),
  interactionType: z.string().max(64).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const campaignRefreshBodySchema = z.object({
  selectionToken: z.string().uuid(),
});

const actionSchema = z.object({
  label: z.string().min(1).max(80),
  type: z.enum(ACTION_TYPES),
  value: z.string().max(2000).default(''),
});

const promotionTranslationBundleSchema = z.object({
  title: z.string().optional(),
  message: z.string().optional(),
  primaryAction: z.object({ label: z.string() }).optional(),
  secondaryAction: z.object({ label: z.string() }).optional(),
});

export const internalCreatePromotionBodySchema = z
  .object({
    internalName: z.string().min(3).max(120),
    internalDescription: z.string().max(2000).optional().default(''),
    status: z.enum(PROMOTION_STATUSES).default('draft'),
    placements: z
      .array(z.enum(PROMOTION_PLACEMENTS_V1))
      .min(1)
      .default(['home']),
    selectionWeight: z.number().int().min(0).max(10000).default(100),
    defaultLocale: z.string().min(2).max(32).default('en'),
    translations: z
      .record(z.string().min(2).max(32), promotionTranslationBundleSchema)
      .optional(),
    title: z.string().min(1).max(200),
    message: z.string().max(4000).default(''),
    mediaType: z.enum(MEDIA_TYPES).default('none'),
    mediaUrl: z.string().max(2000).default(''),
    mediaLayout: z.string().max(32).optional(),
    textAlignment: z.string().max(32).optional(),
    background: z.string().max(64).optional(),
    primaryAction: actionSchema,
    secondaryAction: actionSchema.optional().nullable(),
    dismissible: z.boolean().default(true),
    modalSize: z.enum(MODAL_SIZES).default('medium'),
    schedule: z
      .object({
        startAt: z.coerce.date().optional(),
        endAt: z.coerce.date().optional(),
        timezone: z.string().max(64).optional(),
      })
      .optional(),
    frequencyRule: z.enum(FREQUENCY_RULES).default('none'),
    frequencyHours: z.number().int().min(1).optional(),
    maxImpressionsPerUser: z.number().int().min(1).optional(),
    maxTotalImpressions: z.number().int().min(1).optional(),
    maxInteractions: z.number().int().min(1).optional(),
    platforms: z.array(z.enum(['ios', 'android'])).optional(),
    minAppVersion: z.string().max(32).optional(),
    maxAppVersion: z.string().max(32).optional(),
    targetAudience: z.record(z.unknown()).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.mediaType !== 'none' && !val.mediaUrl.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'mediaUrl is required when mediaType is image or video',
        path: ['mediaUrl'],
      });
    }
    if (val.primaryAction.type !== 'dismiss_only' && !val.primaryAction.value.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'primaryAction.value is required unless type is dismiss_only',
        path: ['primaryAction', 'value'],
      });
    }
    if (
      val.schedule?.startAt &&
      val.schedule?.endAt &&
      val.schedule.endAt <= val.schedule.startAt
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'schedule.endAt must be after startAt',
        path: ['schedule', 'endAt'],
      });
    }
    if (val.frequencyRule === 'every_n_hours' && !val.frequencyHours) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'frequencyHours is required when frequencyRule is every_n_hours',
        path: ['frequencyHours'],
      });
    }
  });

const promotionFieldsSchema = z.object({
  internalName: z.string().min(3).max(120),
  internalDescription: z.string().max(2000).optional(),
  status: z.enum(PROMOTION_STATUSES),
  placements: z.array(z.enum(PROMOTION_PLACEMENTS_V1)).min(1),
  selectionWeight: z.number().int().min(0).max(10000),
  defaultLocale: z.string().min(2).max(32),
  translations: z
    .record(z.string().min(2).max(32), promotionTranslationBundleSchema)
    .optional(),
  title: z.string().min(1).max(200),
  message: z.string().max(4000),
  mediaType: z.enum(MEDIA_TYPES),
  mediaUrl: z.string().max(2000),
  mediaLayout: z.string().max(32).optional(),
  textAlignment: z.string().max(32).optional(),
  background: z.string().max(64).optional(),
  primaryAction: actionSchema,
  secondaryAction: actionSchema.optional().nullable(),
  dismissible: z.boolean(),
  modalSize: z.enum(MODAL_SIZES),
  schedule: z
    .object({
      startAt: z.coerce.date().optional(),
      endAt: z.coerce.date().optional(),
      timezone: z.string().max(64).optional(),
    })
    .optional(),
  frequencyRule: z.enum(FREQUENCY_RULES),
  frequencyHours: z.number().int().min(1).optional(),
  maxImpressionsPerUser: z.number().int().min(1).optional(),
  maxTotalImpressions: z.number().int().min(1).optional(),
  maxInteractions: z.number().int().min(1).optional(),
  platforms: z.array(z.enum(['ios', 'android'])).optional(),
  minAppVersion: z.string().max(32).optional(),
  maxAppVersion: z.string().max(32).optional(),
  targetAudience: z.record(z.unknown()).optional(),
});

export const internalPatchPromotionBodySchema = promotionFieldsSchema.partial();

export const internalPromotionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(PROMOTION_STATUSES).optional(),
  placement: z.string().optional(),
});

export const internalPlacementConfigBodySchema = z.object({
  surveyContentTypeWeight: z.number().int().min(0).max(10000),
  promotionContentTypeWeight: z.number().int().min(0).max(10000),
  enabledContentTypes: z.array(z.enum(['survey', 'promotion'])).min(1).optional(),
  promotionsEnabled: z.boolean().optional(),
});

export const objectIdParamSchema = z.object({
  id: z.string().refine((id) => mongoose.Types.ObjectId.isValid(id), {
    message: 'Invalid id',
  }),
});

export const placementParamSchema = z.object({
  placement: z.enum(CAMPAIGN_PLACEMENTS),
});
