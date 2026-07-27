import { z } from 'zod';
import {
  ANALYTICS_EVENT_NAMES,
  ANALYTICS_PLATFORMS,
} from '../constants/analytics.constants';

const propertiesSchema = z
  .record(z.unknown())
  .refine(
    (obj) => JSON.stringify(obj).length <= 4000,
    { message: 'properties must be at most 4000 characters when serialized' },
  )
  .optional();

export const analyticsEventBodySchema = z.object({
  eventId: z.string().min(1).max(128).optional(),
  idempotencyKey: z.string().min(8).max(200),
  eventName: z.enum(ANALYTICS_EVENT_NAMES),
  sessionId: z.string().min(1).max(128).optional(),
  appVersion: z.string().max(32).optional(),
  platform: z.enum(ANALYTICS_PLATFORMS).optional(),
  properties: propertiesSchema,
});

const dateQuery = z.string().min(4).max(64).optional();

export const analyticsSummaryQuerySchema = z.object({
  from: dateQuery,
  to: dateQuery,
});

export const analyticsSeriesQuerySchema = z.object({
  from: dateQuery,
  to: dateQuery,
  eventName: z.enum(ANALYTICS_EVENT_NAMES).optional(),
  granularity: z.enum(['day']).default('day'),
});

export const analyticsEventsListQuerySchema = z.object({
  from: dateQuery,
  to: dateQuery,
  eventName: z.enum(ANALYTICS_EVENT_NAMES).optional(),
  platform: z.enum(ANALYTICS_PLATFORMS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
