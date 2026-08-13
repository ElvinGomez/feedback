import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { Announcement } from '../models/announcement.model';
import { AnnouncementUserState } from '../models/announcement-user-state.model';
import { getActiveAnnouncementsForUser } from '../services/announcement-eligibility.service';
import {
  assertAudienceCountryAccess,
  resolveAudienceGeoCenter,
} from '../services/country-access.service';
import { getAnnouncementStyleIssues } from '../validation/announcement.validation';
import { ApiError } from '../utils/error/error.api';
import { logger } from '../utils/logger';

function headerString(req: AuthenticatedRequest, name: string): string | undefined {
  const v = req.headers[name.toLowerCase()];
  if (typeof v === 'string' && v.trim()) {
    return v.trim();
  }
  return undefined;
}

function serializeAnnouncement(a: {
  _id: mongoose.Types.ObjectId;
  internalName: string;
  internalDescription?: string;
  status: string;
  displayStyle: string;
  modalSize?: string;
  priority: number;
  defaultLocale?: string;
  translations?: unknown;
  title: string;
  message?: string;
  mediaType?: string;
  mediaUrl?: string;
  background?: string;
  htmlContent?: string;
  icon?: string;
  primaryAction?: unknown;
  secondaryAction?: unknown;
  dismissible?: boolean;
  schedule?: { startAt?: Date; endAt?: Date; timezone?: string };
  frequencyRule?: string;
  platforms?: string[];
  minAppVersion?: string;
  maxAppVersion?: string;
  targetAudience?: unknown;
  stats?: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: a._id.toString(),
    internalName: a.internalName,
    internalDescription: a.internalDescription ?? '',
    status: a.status,
    displayStyle: a.displayStyle,
    modalSize: a.modalSize ?? 'medium',
    priority: a.priority,
    defaultLocale: a.defaultLocale ?? 'en',
    translations: a.translations ?? {},
    title: a.title,
    message: a.message ?? '',
    mediaType: a.mediaType ?? 'text',
    mediaUrl: a.mediaUrl ?? '',
    background: a.background ?? '',
    htmlContent: a.htmlContent ?? '',
    icon: a.icon ?? '',
    primaryAction: a.primaryAction ?? null,
    secondaryAction: a.secondaryAction ?? null,
    dismissible: a.dismissible !== false,
    schedule: a.schedule
      ? {
          startAt: a.schedule.startAt?.toISOString() ?? null,
          endAt: a.schedule.endAt?.toISOString() ?? null,
          timezone: a.schedule.timezone ?? 'UTC',
        }
      : null,
    frequencyRule: a.frequencyRule ?? 'once_ever',
    platforms: a.platforms,
    minAppVersion: a.minAppVersion ?? '',
    maxAppVersion: a.maxAppVersion ?? '',
    targetAudience: a.targetAudience ?? { allowAll: true },
    stats: a.stats,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export async function getActiveAnnouncements(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'Unauthorized', code: 'UNAUTHORIZED' });
    return;
  }

  const q = req.query as unknown as {
    locale?: string;
    countryCode?: string;
    latitude?: number;
    longitude?: number;
    searchLatitude?: number;
    searchLongitude?: number;
  };

  try {
    let effectiveLatitude = typeof q.latitude === 'number' ? q.latitude : undefined;
    let effectiveLongitude = typeof q.longitude === 'number' ? q.longitude : undefined;

    if (q.countryCode && typeof q.latitude === 'number' && typeof q.longitude === 'number') {
      const { travelMode } = await assertAudienceCountryAccess({
        req,
        countryCode: q.countryCode,
        latitude: q.latitude,
        longitude: q.longitude,
      });
      const center = resolveAudienceGeoCenter({
        travelMode,
        deviceLatitude: q.latitude,
        deviceLongitude: q.longitude,
        searchLatitude: q.searchLatitude,
        searchLongitude: q.searchLongitude,
      });
      effectiveLatitude = center.latitude;
      effectiveLongitude = center.longitude;
    }

    const result = await getActiveAnnouncementsForUser({
      userId,
      locale: q.locale,
      countryCode: q.countryCode,
      latitude: effectiveLatitude,
      longitude: effectiveLongitude,
      sessionId: headerString(req, 'x-session-id'),
      appVersion: headerString(req, 'x-app-version'),
      platform: headerString(req, 'x-platform'),
    });

    res.status(200).json(result);
  } catch (e) {
    if (e instanceof ApiError) {
      res.status(e.status).json({ code: e.code, name: e.name, message: e.message });
      return;
    }
    logger.error('getActiveAnnouncements failed', e);
    res.status(500).json({ message: 'Failed to load announcements', code: 'INTERNAL' });
  }
}

export async function postAnnouncementEvent(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'Unauthorized', code: 'UNAUTHORIZED' });
    return;
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid id', code: 'INVALID_ID' });
    return;
  }

  const body = req.body as {
    eventType: string;
    sessionId?: string;
  };

  const announcement = await Announcement.findById(id).exec();
  if (!announcement) {
    res.status(404).json({ message: 'Announcement not found', code: 'NOT_FOUND' });
    return;
  }

  const now = new Date();
  try {
    if (body.eventType === 'announcement_seen') {
      await AnnouncementUserState.findOneAndUpdate(
        { userId, announcementId: id },
        {
          $inc: { seenCount: 1 },
          $set: { lastSeenAt: now, lastSeenSessionId: body.sessionId },
          $setOnInsert: { firstSeenAt: now },
        },
        { upsert: true },
      ).exec();

      const state = (await AnnouncementUserState.findOne({ userId, announcementId: id })
        .select('seenCount')
        .lean()
        .exec()) as { seenCount?: number } | null;
      const isFirst = (state?.seenCount ?? 1) === 1;

      await Announcement.findByIdAndUpdate(id, {
        $inc: {
          'stats.seenTotal': 1,
          ...(isFirst ? { 'stats.uniqueUsersSeen': 1 } : {}),
        },
      }).exec();
    } else if (body.eventType === 'announcement_dismissed') {
      await AnnouncementUserState.findOneAndUpdate(
        { userId, announcementId: id },
        { $set: { dismissedAt: now, lastDismissedSessionId: body.sessionId } },
        { upsert: true },
      ).exec();
      await Announcement.findByIdAndUpdate(id, {
        $inc: { 'stats.dismissedTotal': 1 },
      }).exec();
    } else if (
      body.eventType === 'announcement_primary_cta_clicked' ||
      body.eventType === 'announcement_secondary_cta_clicked'
    ) {
      await AnnouncementUserState.findOneAndUpdate(
        { userId, announcementId: id },
        { $inc: { ctaClickCount: 1 } },
        { upsert: true },
      ).exec();
      const field =
        body.eventType === 'announcement_primary_cta_clicked'
          ? 'stats.primaryCtaClicks'
          : 'stats.secondaryCtaClicks';
      await Announcement.findByIdAndUpdate(id, { $inc: { [field]: 1 } }).exec();
    }
  } catch (e) {
    logger.error('postAnnouncementEvent failed', e);
    res.status(500).json({ message: 'Failed to record event', code: 'INTERNAL' });
    return;
  }

  res.status(201).json({ ok: true });
}

export async function internalListAnnouncements(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const q = req.query as unknown as { page: number; limit: number; status?: string };
  const filter: Record<string, unknown> = {};
  if (q.status) {
    filter.status = q.status;
  }
  const skip = (q.page - 1) * q.limit;
  const [items, total] = await Promise.all([
    Announcement.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(q.limit).lean().exec(),
    Announcement.countDocuments(filter).exec(),
  ]);
  res.status(200).json({
    items: items.map((a) => serializeAnnouncement(a as Parameters<typeof serializeAnnouncement>[0])),
    page: q.page,
    limit: q.limit,
    total,
  });
}

export async function internalCreateAnnouncement(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const doc = await Announcement.create(body);
  const s = doc.toObject();
  res.status(201).json(serializeAnnouncement(s as Parameters<typeof serializeAnnouncement>[0]));
}

export async function internalGetAnnouncement(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid id', code: 'INVALID_ID' });
    return;
  }
  const doc = await Announcement.findById(id).lean().exec();
  if (!doc) {
    res.status(404).json({ message: 'Announcement not found', code: 'NOT_FOUND' });
    return;
  }
  res.status(200).json(serializeAnnouncement(doc as Parameters<typeof serializeAnnouncement>[0]));
}

export async function internalPatchAnnouncement(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { id } = req.params;
  const body = req.body as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined) {
      update[key] = value;
    }
  }

  const existing = (await Announcement.findById(id).lean().exec()) as {
    displayStyle?: string;
    modalSize?: string;
    mediaType?: string;
    mediaUrl?: string;
    background?: string;
    htmlContent?: string;
  } | null;
  if (!existing) {
    res.status(404).json({ message: 'Announcement not found', code: 'NOT_FOUND' });
    return;
  }
  const merged = { ...existing, ...update } as {
    displayStyle?: string;
    modalSize?: string;
    mediaType?: string;
    mediaUrl?: string;
    background?: string;
    htmlContent?: string;
  };
  const styleIssues = getAnnouncementStyleIssues({
    displayStyle: merged.displayStyle ?? 'banner',
    modalSize: merged.modalSize ?? 'medium',
    mediaType: merged.mediaType ?? 'text',
    mediaUrl: merged.mediaUrl ?? '',
    background: merged.background ?? '',
    htmlContent: merged.htmlContent ?? '',
  });
  if (styleIssues.length) {
    res.status(400).json({
      message: styleIssues.map((i) => i.message).join('; '),
      code: 'INVALID_ANNOUNCEMENT_STYLE',
      issues: styleIssues,
    });
    return;
  }

  const doc = await Announcement.findByIdAndUpdate(id, { $set: update }, { new: true }).exec();
  if (!doc) {
    res.status(404).json({ message: 'Announcement not found', code: 'NOT_FOUND' });
    return;
  }
  const s = doc.toObject();
  res.status(200).json(serializeAnnouncement(s as Parameters<typeof serializeAnnouncement>[0]));
}
