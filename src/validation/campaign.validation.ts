import mongoose from 'mongoose';
import { z } from 'zod';
import {
  ACTION_TYPES,
  ALLOWED_MEDIA_TYPES_BY_MODAL_SIZE,
  BACKGROUND_ALLOWED_MODAL_SIZES,
  CAMPAIGN_EVENT_TYPES,
  CAMPAIGN_PLACEMENTS,
  FREQUENCY_RULES,
  MEDIA_TYPES,
  MODAL_SIZES,
  PROMOTION_PLACEMENTS_V1,
  PROMOTION_STATUSES,
  type MediaType,
  type ModalSize,
} from '../constants/campaign.constants';
import {
  optionalLatLngQuerySchema,
  targetAudienceSchema,
} from './target-audience.validation';

export const campaignContentQuerySchema = z.object({
  placement: z.enum(CAMPAIGN_PLACEMENTS),
  locale: z.string().min(2).max(32).optional(),
  stableToken: z.string().uuid().optional(),
  ...optionalLatLngQuerySchema,
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

export type PromotionStyleInput = {
  modalSize: string;
  mediaType: string;
  mediaUrl: string;
  background: string;
  htmlContent: string;
};

export type PromotionStyleIssue = {
  path: (string | number)[];
  message: string;
};

/**
 * Per-modal-size style rules shared by create validation and patch enforcement:
 * - small: title + message only (no media, no background, no html)
 * - medium: optional image only (no video/html, no background)
 * - full_screen: background, image/video, or html content
 */
export function getPromotionStyleIssues(
  input: PromotionStyleInput,
): PromotionStyleIssue[] {
  const issues: PromotionStyleIssue[] = [];
  const modalSize = (MODAL_SIZES as readonly string[]).includes(input.modalSize)
    ? (input.modalSize as ModalSize)
    : 'medium';
  const allowedMedia = ALLOWED_MEDIA_TYPES_BY_MODAL_SIZE[modalSize];

  if (!allowedMedia.includes(input.mediaType as MediaType)) {
    issues.push({
      path: ['mediaType'],
      message: `mediaType "${input.mediaType}" is not allowed for modalSize "${modalSize}" (allowed: ${allowedMedia.join(', ')})`,
    });
  }
  if (
    input.background.trim() &&
    !BACKGROUND_ALLOWED_MODAL_SIZES.includes(modalSize)
  ) {
    issues.push({
      path: ['background'],
      message: `background is only allowed for modalSize "full_screen"`,
    });
  }
  if (input.mediaType === 'html') {
    if (!input.htmlContent.trim()) {
      issues.push({
        path: ['htmlContent'],
        message: 'htmlContent is required when mediaType is html',
      });
    }
  } else if (input.htmlContent.trim()) {
    issues.push({
      path: ['htmlContent'],
      message: 'htmlContent is only allowed when mediaType is html',
    });
  }
  if (
    (input.mediaType === 'image' || input.mediaType === 'video') &&
    !input.mediaUrl.trim()
  ) {
    issues.push({
      path: ['mediaUrl'],
      message: 'mediaUrl is required when mediaType is image or video',
    });
  }
  return issues;
}

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
    htmlContent: z.string().max(100000).default(''),
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
    targetAudience: targetAudienceSchema.optional(),
  })
  .superRefine((val, ctx) => {
    const styleIssues = getPromotionStyleIssues({
      modalSize: val.modalSize,
      mediaType: val.mediaType,
      mediaUrl: val.mediaUrl,
      background: val.background ?? '',
      htmlContent: val.htmlContent,
    });
    for (const issue of styleIssues) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: issue.message,
        path: issue.path,
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
  htmlContent: z.string().max(100000),
  mediaLayout: z.string().max(32).optional(),
  textAlignment: z.string().max(32).optional(),
  background: z.string().max(64).optional(),
  primaryAction: actionSchema,
  secondaryAction: actionSchema.optional().nullable(),
  dismissible: z.boolean(),
  modalSize: z.enum(MODAL_SIZES),
  schedule: z
    .object({
      startAt: z.coerce.date().optional().nullable(),
      endAt: z.coerce.date().optional().nullable(),
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
  targetAudience: targetAudienceSchema.optional(),
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
