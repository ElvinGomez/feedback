import { z } from 'zod';
import { ACTION_TYPES } from '../constants/campaign.constants';
import {
  ANNOUNCEMENT_BACKGROUND_ALLOWED_MODAL_SIZES,
  ANNOUNCEMENT_DISPLAY_STYLES,
  ANNOUNCEMENT_EVENT_TYPES,
  ANNOUNCEMENT_FREQUENCY_RULES,
  ANNOUNCEMENT_MEDIA_TYPES,
  ANNOUNCEMENT_MEDIA_TYPES_BY_DISPLAY_STYLE,
  ANNOUNCEMENT_MEDIA_TYPES_BY_MODAL_SIZE,
  ANNOUNCEMENT_MODAL_SIZES,
  ANNOUNCEMENT_STATUSES,
  type AnnouncementDisplayStyle,
  type AnnouncementMediaType,
  type AnnouncementModalSize,
} from '../constants/announcement.constants';
import {
  optionalAudienceLocationQuerySchema,
  targetAudienceSchema,
} from './target-audience.validation';

export const announcementActiveQuerySchema = z.object({
  locale: z.string().min(2).max(32).optional(),
  ...optionalAudienceLocationQuerySchema,
});

export const announcementEventBodySchema = z.object({
  idempotencyKey: z.string().min(8).max(200),
  eventType: z.enum(ANNOUNCEMENT_EVENT_TYPES),
  sessionId: z.string().min(1).max(128).optional(),
  destinationType: z.enum(ACTION_TYPES).optional(),
  destinationValue: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const actionSchema = z.object({
  label: z.string().min(1).max(80),
  type: z.enum(ACTION_TYPES),
  value: z.string().max(2000).default(''),
});

export type AnnouncementStyleInput = {
  displayStyle: string;
  modalSize: string;
  mediaType: string;
  mediaUrl: string;
  background: string;
  htmlContent: string;
};

export type AnnouncementStyleIssue = {
  path: (string | number)[];
  message: string;
};

function normalizeDisplayStyle(raw: string): AnnouncementDisplayStyle {
  return (ANNOUNCEMENT_DISPLAY_STYLES as readonly string[]).includes(raw)
    ? (raw as AnnouncementDisplayStyle)
    : 'banner';
}

function normalizeModalSize(raw: string): AnnouncementModalSize {
  return (ANNOUNCEMENT_MODAL_SIZES as readonly string[]).includes(raw)
    ? (raw as AnnouncementModalSize)
    : 'medium';
}

/**
 * Style rules shared by create validation and patch enforcement:
 * - banner: text or html strip (no mediaUrl / background / video)
 * - modal medium: text, image, or html
 * - modal full_screen: text, image, video, or html (+ optional background)
 */
export function getAnnouncementStyleIssues(
  input: AnnouncementStyleInput,
): AnnouncementStyleIssue[] {
  const issues: AnnouncementStyleIssue[] = [];
  const displayStyle = normalizeDisplayStyle(input.displayStyle);
  const modalSize = normalizeModalSize(input.modalSize);
  const allowedMedia =
    displayStyle === 'banner'
      ? ANNOUNCEMENT_MEDIA_TYPES_BY_DISPLAY_STYLE.banner
      : ANNOUNCEMENT_MEDIA_TYPES_BY_MODAL_SIZE[modalSize];

  if (!allowedMedia.includes(input.mediaType as AnnouncementMediaType)) {
    issues.push({
      path: ['mediaType'],
      message:
        displayStyle === 'banner'
          ? `mediaType "${input.mediaType}" is not allowed for displayStyle "banner" (allowed: ${allowedMedia.join(', ')})`
          : `mediaType "${input.mediaType}" is not allowed for modalSize "${modalSize}" (allowed: ${allowedMedia.join(', ')})`,
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

  if (input.mediaType === 'image' || input.mediaType === 'video') {
    if (!input.mediaUrl.trim()) {
      issues.push({
        path: ['mediaUrl'],
        message: 'mediaUrl is required when mediaType is image or video',
      });
    }
  } else if (input.mediaUrl.trim()) {
    issues.push({
      path: ['mediaUrl'],
      message: 'mediaUrl is only allowed when mediaType is image or video',
    });
  }

  const backgroundAllowed =
    displayStyle === 'modal' &&
    (ANNOUNCEMENT_BACKGROUND_ALLOWED_MODAL_SIZES as readonly string[]).includes(modalSize);
  if (input.background.trim() && !backgroundAllowed) {
    issues.push({
      path: ['background'],
      message: 'background is only allowed for modal displayStyle with modalSize "full_screen"',
    });
  }

  return issues;
}

/** Strip disallowed style fields before persistence / delivery. */
export function sanitizeAnnouncementStyle(input: AnnouncementStyleInput): {
  modalSize: AnnouncementModalSize;
  mediaType: AnnouncementMediaType;
  mediaUrl: string;
  background: string;
  htmlContent: string;
} {
  const displayStyle = normalizeDisplayStyle(input.displayStyle);
  const modalSize =
    displayStyle === 'modal' ? normalizeModalSize(input.modalSize) : 'medium';
  const allowed =
    displayStyle === 'banner'
      ? ANNOUNCEMENT_MEDIA_TYPES_BY_DISPLAY_STYLE.banner
      : ANNOUNCEMENT_MEDIA_TYPES_BY_MODAL_SIZE[modalSize];
  const mediaType = allowed.includes(input.mediaType as AnnouncementMediaType)
    ? (input.mediaType as AnnouncementMediaType)
    : 'text';
  const backgroundAllowed =
    displayStyle === 'modal' &&
    (ANNOUNCEMENT_BACKGROUND_ALLOWED_MODAL_SIZES as readonly string[]).includes(modalSize);
  return {
    modalSize,
    mediaType,
    mediaUrl:
      mediaType === 'image' || mediaType === 'video' ? input.mediaUrl.trim() : '',
    background: backgroundAllowed ? input.background.trim() : '',
    htmlContent: mediaType === 'html' ? input.htmlContent : '',
  };
}

const announcementTranslationBundleSchema = z.object({
  title: z.string().optional(),
  message: z.string().optional(),
  primaryAction: z.object({ label: z.string() }).optional(),
  secondaryAction: z.object({ label: z.string() }).optional(),
});

function refineAnnouncementStyle(
  val: {
    displayStyle: string;
    modalSize: string;
    mediaType: string;
    mediaUrl: string;
    background: string;
    htmlContent: string;
    schedule?: { startAt?: Date | null; endAt?: Date | null };
  },
  ctx: z.RefinementCtx,
) {
  const styleIssues = getAnnouncementStyleIssues({
    displayStyle: val.displayStyle,
    modalSize: val.modalSize,
    mediaType: val.mediaType,
    mediaUrl: val.mediaUrl,
    background: val.background,
    htmlContent: val.htmlContent,
  });
  for (const issue of styleIssues) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: issue.message,
      path: issue.path,
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
}

export const internalCreateAnnouncementBodySchema = z
  .object({
    internalName: z.string().min(3).max(120),
    internalDescription: z.string().max(2000).optional().default(''),
    status: z.enum(ANNOUNCEMENT_STATUSES).default('draft'),
    displayStyle: z.enum(ANNOUNCEMENT_DISPLAY_STYLES).default('banner'),
    modalSize: z.enum(ANNOUNCEMENT_MODAL_SIZES).default('medium'),
    mediaType: z.enum(ANNOUNCEMENT_MEDIA_TYPES).default('text'),
    mediaUrl: z.string().max(2000).default(''),
    background: z.string().max(64).default(''),
    htmlContent: z.string().max(100000).default(''),
    priority: z.number().int().min(0).max(10000).default(0),
    defaultLocale: z.string().min(2).max(32).default('en'),
    translations: z
      .record(z.string().min(2).max(32), announcementTranslationBundleSchema)
      .optional(),
    title: z.string().min(1).max(200),
    message: z.string().max(4000).default(''),
    icon: z.string().max(64).optional().default(''),
    primaryAction: actionSchema.optional().nullable(),
    secondaryAction: actionSchema.optional().nullable(),
    dismissible: z.boolean().default(true),
    schedule: z
      .object({
        startAt: z.coerce.date().optional(),
        endAt: z.coerce.date().optional(),
        timezone: z.string().max(64).optional(),
      })
      .optional(),
    frequencyRule: z.enum(ANNOUNCEMENT_FREQUENCY_RULES).default('once_ever'),
    platforms: z.array(z.enum(['ios', 'android'])).optional(),
    minAppVersion: z.string().max(32).optional(),
    maxAppVersion: z.string().max(32).optional(),
    targetAudience: targetAudienceSchema.optional(),
  })
  .superRefine(refineAnnouncementStyle);

const announcementFieldsSchema = z.object({
  internalName: z.string().min(3).max(120),
  internalDescription: z.string().max(2000).optional(),
  status: z.enum(ANNOUNCEMENT_STATUSES),
  displayStyle: z.enum(ANNOUNCEMENT_DISPLAY_STYLES),
  modalSize: z.enum(ANNOUNCEMENT_MODAL_SIZES),
  mediaType: z.enum(ANNOUNCEMENT_MEDIA_TYPES),
  mediaUrl: z.string().max(2000),
  background: z.string().max(64),
  htmlContent: z.string().max(100000),
  priority: z.number().int().min(0).max(10000),
  defaultLocale: z.string().min(2).max(32),
  translations: z
    .record(z.string().min(2).max(32), announcementTranslationBundleSchema)
    .optional(),
  title: z.string().min(1).max(200),
  message: z.string().max(4000),
  icon: z.string().max(64).optional(),
  primaryAction: actionSchema.optional().nullable(),
  secondaryAction: actionSchema.optional().nullable(),
  dismissible: z.boolean(),
  schedule: z
    .object({
      startAt: z.coerce.date().optional().nullable(),
      endAt: z.coerce.date().optional().nullable(),
      timezone: z.string().max(64).optional(),
    })
    .optional(),
  frequencyRule: z.enum(ANNOUNCEMENT_FREQUENCY_RULES),
  platforms: z.array(z.enum(['ios', 'android'])).optional(),
  minAppVersion: z.string().max(32).optional(),
  maxAppVersion: z.string().max(32).optional(),
  targetAudience: targetAudienceSchema.optional(),
});

export const internalPatchAnnouncementBodySchema = announcementFieldsSchema.partial();

export const internalAnnouncementListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(ANNOUNCEMENT_STATUSES).optional(),
});
