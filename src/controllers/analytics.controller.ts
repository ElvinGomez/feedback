import { randomUUID } from 'crypto';
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { AnalyticsEvent } from '../models/analytics-event.model';
import { logger } from '../utils/logger';
import type {
  analyticsEventBodySchema,
  analyticsEventsListQuerySchema,
  analyticsSeriesQuerySchema,
  analyticsSummaryQuerySchema,
} from '../validation/analytics.validation';
import type { z } from 'zod';

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

function parseDateBound(value: string | undefined, endOfDay: boolean): Date | undefined {
  if (!value) {
    return undefined;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function defaultRange(): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { from, to };
}

function resolveRange(fromStr?: string, toStr?: string): { from: Date; to: Date } {
  const defaults = defaultRange();
  const from = parseDateBound(fromStr, false) ?? defaults.from;
  const to = parseDateBound(toStr, true) ?? defaults.to;
  return from <= to ? { from, to } : { from: to, to: from };
}

export async function postAnalyticsEvent(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const body = req.body as z.infer<typeof analyticsEventBodySchema>;
  const userId = req.user?.id;

  try {
    await AnalyticsEvent.create({
      eventId: body.eventId ?? randomUUID(),
      idempotencyKey: body.idempotencyKey,
      eventName: body.eventName,
      userId,
      sessionId: body.sessionId,
      appVersion: body.appVersion,
      platform: body.platform,
      properties: body.properties,
    });
  } catch (e) {
    if (isDuplicateKeyError(e)) {
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }
    logger.error('postAnalyticsEvent failed', e);
    res.status(500).json({ message: 'Failed to record event', code: 'INTERNAL' });
    return;
  }

  res.status(200).json({ ok: true });
}

export async function internalAnalyticsSummary(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const q = req.query as unknown as z.infer<typeof analyticsSummaryQuerySchema>;
  const { from, to } = resolveRange(q.from, q.to);
  const match = { createdAt: { $gte: from, $lte: to } };

  const now = Date.now();
  const last24h = new Date(now - 24 * 60 * 60 * 1000);
  const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const last30d = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [
    totalInRange,
    uniqueUsersAgg,
    byEventName,
    byPlatform,
    count24h,
    count7d,
    count30d,
  ] = await Promise.all([
    AnalyticsEvent.countDocuments(match).exec(),
    AnalyticsEvent.aggregate([
      { $match: { ...match, userId: { $exists: true, $nin: [null, ''] } } },
      { $group: { _id: '$userId' } },
      { $count: 'count' },
    ]).exec(),
    AnalyticsEvent.aggregate([
      { $match: match },
      { $group: { _id: '$eventName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).exec(),
    AnalyticsEvent.aggregate([
      { $match: match },
      { $group: { _id: { $ifNull: ['$platform', 'unknown'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).exec(),
    AnalyticsEvent.countDocuments({ createdAt: { $gte: last24h } }).exec(),
    AnalyticsEvent.countDocuments({ createdAt: { $gte: last7d } }).exec(),
    AnalyticsEvent.countDocuments({ createdAt: { $gte: last30d } }).exec(),
  ]);

  const byEventNameMapped = (
    byEventName as { _id: string; count: number }[]
  ).map((row) => ({ eventName: row._id, count: row.count }));
  const topEvent = byEventNameMapped[0] ?? null;

  res.status(200).json({
    from: from.toISOString(),
    to: to.toISOString(),
    total: totalInRange,
    uniqueUsers: (uniqueUsersAgg[0] as { count?: number } | undefined)?.count ?? 0,
    last24h: count24h,
    last7d: count7d,
    last30d: count30d,
    byEventName: byEventNameMapped,
    byPlatform: (byPlatform as { _id: string; count: number }[]).map((row) => ({
      platform: row._id,
      count: row.count,
    })),
    topEvent,
  });
}

export async function internalAnalyticsSeries(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const q = req.query as unknown as z.infer<typeof analyticsSeriesQuerySchema>;
  const { from, to } = resolveRange(q.from, q.to);
  const match: Record<string, unknown> = {
    createdAt: { $gte: from, $lte: to },
  };
  if (q.eventName) {
    match.eventName = q.eventName;
  }

  const series = await AnalyticsEvent.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          eventName: '$eventName',
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.day': 1 } },
  ]).exec();

  res.status(200).json({
    from: from.toISOString(),
    to: to.toISOString(),
    granularity: q.granularity ?? 'day',
    series: (series as { _id: { day: string; eventName: string }; count: number }[]).map(
      (row) => ({
        day: row._id.day,
        eventName: row._id.eventName,
        count: row.count,
      }),
    ),
  });
}

export async function internalListAnalyticsEvents(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const q = req.query as unknown as z.infer<typeof analyticsEventsListQuerySchema>;
  const { from, to } = resolveRange(q.from, q.to);
  const filter: Record<string, unknown> = {
    createdAt: { $gte: from, $lte: to },
  };
  if (q.eventName) {
    filter.eventName = q.eventName;
  }
  if (q.platform) {
    filter.platform = q.platform;
  }

  const skip = (q.page - 1) * q.limit;
  const [items, total] = await Promise.all([
    AnalyticsEvent.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(q.limit)
      .lean()
      .exec(),
    AnalyticsEvent.countDocuments(filter).exec(),
  ]);

  res.status(200).json({
    from: from.toISOString(),
    to: to.toISOString(),
    items: items.map((row) => {
      const r = row as {
        _id: { toString(): string };
        eventId: string;
        eventName: string;
        userId?: string;
        sessionId?: string;
        appVersion?: string;
        platform?: string;
        properties?: unknown;
        createdAt: Date;
      };
      return {
        id: r._id.toString(),
        eventId: r.eventId,
        eventName: r.eventName,
        userId: r.userId ?? null,
        sessionId: r.sessionId ?? null,
        appVersion: r.appVersion ?? null,
        platform: r.platform ?? null,
        properties: r.properties ?? null,
        createdAt: r.createdAt,
      };
    }),
    page: q.page,
    limit: q.limit,
    total,
  });
}
