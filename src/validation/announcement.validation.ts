import { z } from 'zod';
import { ACTION_TYPES } from '../constants/campaign.constants';
import {
  ANNOUNCEMENT_DISPLAY_STYLES,
  ANNOUNCEMENT_EVENT_TYPES,
  ANNOUNCEMENT_FREQUENCY_RULES,
  ANNOUNCEMENT_MEDIA_TYPES,
  ANNOUNCEMENT_MEDIA_TYPES_BY_DISPLAY_STYLE,
  ANNOUNCEMENT_STATUSES,
  type AnnouncementDisplayStyle,
  type AnnouncementMediaType,
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
  mediaType: string;
  htmlContent: string;
};

export type AnnouncementStyleIssue = {
  path: (string | number)[];
  message: string;
};

/**
 * Per-display-style style rules shared by create validation and patch enforcement:
 * - banner: text only, no html
 * - modal: text or html
 */
export function getAnnouncementStyleIssues(
  input: AnnouncementStyleInput,
): AnnouncementStyleIssue[] {
  const issues: AnnouncementStyleIssue[] = [];
  const displayStyle = (
    ANNOUNCEMENT_DISPLAY_STYLES as readonly string[]
  ).includes(input.displayStyle)
    ? (input.displayStyle as AnnouncementDisplayStyle)
    : 'banner';
  const allowedMedia = ANNOUNCEMENT_MEDIA_TYPES_BY_DISPLAY_STYLE[displayStyle];

  if (!allowedMedia.includes(input.mediaType as AnnouncementMediaType)) {
    issues.push({
      path: ['mediaType'],
      message: `mediaType "${input.mediaType}" is not allowed for displayStyle "${displayStyle}" (allowed: ${allowedMedia.join(', ')})`,
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
  return issues;
}

const announcementTranslationBundleSchema = z.object({
  title: z.string().optional(),
  message: z.string().optional(),
  primaryAction: z.object({ label: z.string() }).optional(),
  secondaryAction: z.object({ label: z.string() }).optional(),
});

export const internalCreateAnnouncementBodySchema = z
  .object({
    internalName: z.string().min(3).max(120),
    internalDescription: z.string().max(2000).optional().default(''),
    status: z.enum(ANNOUNCEMENT_STATUSES).default('draft'),
    displayStyle: z.enum(ANNOUNCEMENT_DISPLAY_STYLES).default('banner'),
    priority: z.number().int().min(0).max(10000).default(0),
    defaultLocale: z.string().min(2).max(32).default('en'),
    translations: z
      .record(z.string().min(2).max(32), announcementTranslationBundleSchema)
      .optional(),
    title: z.string().min(1).max(200),
    message: z.string().max(4000).default(''),
    mediaType: z.enum(ANNOUNCEMENT_MEDIA_TYPES).default('text'),
    htmlContent: z.string().max(100000).default(''),
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
  .superRefine((val, ctx) => {
    const styleIssues = getAnnouncementStyleIssues({
      displayStyle: val.displayStyle,
      mediaType: val.mediaType,
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
  });

const announcementFieldsSchema = z.object({
  internalName: z.string().min(3).max(120),
  internalDescription: z.string().max(2000).optional(),
  status: z.enum(ANNOUNCEMENT_STATUSES),
  displayStyle: z.enum(ANNOUNCEMENT_DISPLAY_STYLES),
  priority: z.number().int().min(0).max(10000),
  defaultLocale: z.string().min(2).max(32),
  translations: z
    .record(z.string().min(2).max(32), announcementTranslationBundleSchema)
    .optional(),
  title: z.string().min(1).max(200),
  message: z.string().max(4000),
  mediaType: z.enum(ANNOUNCEMENT_MEDIA_TYPES),
  htmlContent: z.string().max(100000),
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
