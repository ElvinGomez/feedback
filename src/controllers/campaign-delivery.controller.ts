import { randomUUID } from 'crypto';
import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { CampaignEvent } from '../models/campaign-event.model';
import {
  CampaignPlacementConfig,
  getOrCreatePlacementConfig,
} from '../models/campaign-placement-config.model';
import { CampaignSelection } from '../models/campaign-selection.model';
import { Promotion } from '../models/promotion.model';
import { PromotionUserState } from '../models/promotion-user-state.model';
import { selectCampaignContent } from '../services/campaign-selection.service';
import { getReportsFeatureFlags } from '../services/feature-flags-cache.service';
import { getPromotionStyleIssues } from '../validation/campaign.validation';
import { logger } from '../utils/logger';

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

function headerString(req: AuthenticatedRequest, name: string): string | undefined {
  const v = req.headers[name.toLowerCase()];
  if (typeof v === 'string' && v.trim()) {
    return v.trim();
  }
  return undefined;
}

function serializePromotion(p: {
  _id: mongoose.Types.ObjectId;
  internalName: string;
  internalDescription?: string;
  status: string;
  placements: string[];
  selectionWeight: number;
  defaultLocale?: string;
  translations?: unknown;
  title: string;
  message?: string;
  mediaType?: string;
  mediaUrl?: string;
  htmlContent?: string;
  mediaLayout?: string;
  textAlignment?: string;
  background?: string;
  primaryAction: unknown;
  secondaryAction?: unknown;
  dismissible?: boolean;
  modalSize?: string;
  schedule?: { startAt?: Date; endAt?: Date; timezone?: string };
  frequencyRule?: string;
  frequencyHours?: number;
  maxImpressionsPerUser?: number;
  maxTotalImpressions?: number;
  maxInteractions?: number;
  platforms?: string[];
  minAppVersion?: string;
  maxAppVersion?: string;
  targetAudience?: unknown;
  stats?: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: p._id.toString(),
    internalName: p.internalName,
    internalDescription: p.internalDescription ?? '',
    status: p.status,
    placements: p.placements,
    selectionWeight: p.selectionWeight,
    defaultLocale: p.defaultLocale ?? 'en',
    translations: p.translations ?? {},
    title: p.title,
    message: p.message ?? '',
    mediaType: p.mediaType ?? 'none',
    mediaUrl: p.mediaUrl ?? '',
    htmlContent: p.htmlContent ?? '',
    mediaLayout: p.mediaLayout,
    textAlignment: p.textAlignment,
    background: p.background,
    primaryAction: p.primaryAction,
    secondaryAction: p.secondaryAction ?? null,
    dismissible: p.dismissible !== false,
    modalSize: p.modalSize ?? 'medium',
    schedule: p.schedule
      ? {
          startAt: p.schedule.startAt?.toISOString() ?? null,
          endAt: p.schedule.endAt?.toISOString() ?? null,
          timezone: p.schedule.timezone ?? 'UTC',
        }
      : null,
    frequencyRule: p.frequencyRule ?? 'none',
    frequencyHours: p.frequencyHours,
    maxImpressionsPerUser: p.maxImpressionsPerUser,
    maxTotalImpressions: p.maxTotalImpressions,
    maxInteractions: p.maxInteractions,
    platforms: p.platforms,
    minAppVersion: p.minAppVersion ?? '',
    maxAppVersion: p.maxAppVersion ?? '',
    targetAudience: p.targetAudience ?? { allowAll: true },
    stats: p.stats,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function getCampaignContent(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'Unauthorized', code: 'UNAUTHORIZED' });
    return;
  }

  const q = req.query as unknown as {
    placement: string;
    locale?: string;
    stableToken?: string;
    latitude?: number;
    longitude?: number;
  };

  const flags = await getReportsFeatureFlags();
  const campaignDeliveryEnabled = flags?.campaignDelivery !== false;
  if (flags && !campaignDeliveryEnabled) {
    res.status(503).json({
      message: 'Campaign delivery is temporarily disabled',
      code: 'CAMPAIGN_DELIVERY_DISABLED',
    });
    return;
  }

  try {
    const result = await selectCampaignContent({
      userId,
      placement: q.placement,
      locale: q.locale,
      stableToken: q.stableToken,
      latitude: typeof q.latitude === 'number' ? q.latitude : undefined,
      longitude: typeof q.longitude === 'number' ? q.longitude : undefined,
      sessionId: headerString(req, 'x-session-id'),
      appVersion: headerString(req, 'x-app-version'),
      platform: headerString(req, 'x-platform'),
      promotionsFeatureEnabled: flags?.promotions !== false,
      surveysFeatureEnabled: flags?.surveys !== false,
    });

    if (!result) {
      res.status(200).json({ content: null });
      return;
    }

    // Fire selection events (idempotent per token)
    const selectedType =
      result.contentType === 'survey' ? 'survey_selected' : 'promotion_selected';
    try {
      await CampaignEvent.create({
        eventId: randomUUID(),
        idempotencyKey: `${result.selectionToken}:${selectedType}`,
        eventType: selectedType,
        selectionToken: result.selectionToken,
        userId,
        sessionId: headerString(req, 'x-session-id'),
        placement: result.placement,
        contentType: result.contentType,
        contentId: result.contentId,
        modalSize: result.modalSize,
        appVersion: headerString(req, 'x-app-version'),
        platform: headerString(req, 'x-platform'),
        selectionAudit: result.selectionAudit,
      });
    } catch (e) {
      if (!isDuplicateKeyError(e)) {
        logger.warn('Failed to persist selection event', e);
      }
    }

    res.status(200).json(result);
  } catch (e) {
    logger.error('getCampaignContent failed', e);
    res.status(500).json({ message: 'Failed to load campaign content', code: 'INTERNAL' });
  }
}

export async function postCampaignEvent(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'Unauthorized', code: 'UNAUTHORIZED' });
    return;
  }

  const body = req.body as {
    eventId?: string;
    idempotencyKey: string;
    eventType: string;
    selectionToken: string;
    sessionId?: string;
    appVersion?: string;
    platform?: string;
    destinationType?: string;
    destinationValue?: string;
    interactionType?: string;
    metadata?: Record<string, unknown>;
  };

  const selection = await CampaignSelection.findOne({
    token: body.selectionToken,
    userId,
  }).exec();

  // Missing token only — allow events after refresh invalidation so dismiss/CTA
  // analytics are not lost when they race with invalidate.
  if (!selection) {
    res.status(404).json({ message: 'Selection not found', code: 'SELECTION_NOT_FOUND' });
    return;
  }
  if (selection.expiresAt < new Date()) {
    res.status(410).json({ message: 'Selection expired', code: 'SELECTION_EXPIRED' });
    return;
  }

  if (body.eventType === 'promotion_impression') {
    if (selection.contentType !== 'promotion') {
      res.status(400).json({ message: 'Not a promotion selection', code: 'INVALID_CONTENT_TYPE' });
      return;
    }
    if (selection.impressionRecorded) {
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }
    const promo = await Promotion.findById(selection.contentId).exec();
    if (!promo || promo.status !== 'active') {
      res.status(409).json({
        message: 'Promotion is no longer active',
        code: 'PROMOTION_INACTIVE',
      });
      return;
    }
  }

  try {
    await CampaignEvent.create({
      eventId: body.eventId ?? randomUUID(),
      idempotencyKey: body.idempotencyKey,
      eventType: body.eventType,
      selectionToken: body.selectionToken,
      userId,
      sessionId: body.sessionId ?? selection.sessionId,
      placement: selection.placement,
      contentType: selection.contentType,
      contentId: selection.contentId,
      modalSize: selection.modalSize,
      appVersion: body.appVersion,
      platform: body.platform,
      destinationType: body.destinationType,
      destinationValue: body.destinationValue,
      interactionType: body.interactionType,
      selectionAudit: selection.selectionAudit,
      metadata: body.metadata,
    });
  } catch (e) {
    if (isDuplicateKeyError(e)) {
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }
    logger.error('postCampaignEvent failed', e);
    res.status(500).json({ message: 'Failed to record event', code: 'INTERNAL' });
    return;
  }

  // Side effects for impressions / CTAs
  try {
    if (body.eventType === 'promotion_impression' && selection.contentType === 'promotion') {
      selection.impressionRecorded = true;
      await selection.save();

      await PromotionUserState.findOneAndUpdate(
        { userId, promotionId: selection.contentId },
        {
          $inc: { impressionCount: 1 },
          $set: {
            lastImpressionAt: new Date(),
            lastShownAt: new Date(),
            lastSessionId: body.sessionId ?? selection.sessionId,
            sessionShownAt: new Date(),
          },
        },
        { upsert: true },
      ).exec();

      const state = (await PromotionUserState.findOne({
        userId,
        promotionId: selection.contentId,
      })
        .select('impressionCount')
        .lean()
        .exec()) as { impressionCount?: number } | null;
      const isFirst = (state?.impressionCount ?? 1) === 1;

      await Promotion.findByIdAndUpdate(selection.contentId, {
        $inc: {
          'stats.impressions': 1,
          ...(isFirst ? { 'stats.uniqueUsers': 1 } : {}),
        },
      }).exec();
    }

    const promoStatField: Record<string, string> = {
      campaign_entry_tapped: 'stats.entryPointTaps',
      promotion_dismissed: 'stats.dismissals',
      promotion_primary_cta_clicked: 'stats.primaryCta',
      promotion_secondary_cta_clicked: 'stats.secondaryCta',
      promotion_video_started: 'stats.videoStarts',
      promotion_video_completed: 'stats.videoCompletions',
      promotion_media_failed: 'stats.mediaFailures',
    };
    const field = promoStatField[body.eventType];
    if (field && selection.contentType === 'promotion') {
      await Promotion.findByIdAndUpdate(selection.contentId, {
        $inc: { [field]: 1 },
      }).exec();
    }
    if (
      (body.eventType === 'promotion_primary_cta_clicked' ||
        body.eventType === 'promotion_secondary_cta_clicked') &&
      selection.contentType === 'promotion'
    ) {
      await PromotionUserState.findOneAndUpdate(
        { userId, promotionId: selection.contentId },
        { $inc: { interactionCount: 1 } },
        { upsert: true },
      ).exec();
    }
  } catch (e) {
    logger.warn('Campaign event side-effects failed', e);
  }

  res.status(201).json({ ok: true, duplicate: false });
}

export async function refreshCampaignContent(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'Unauthorized', code: 'UNAUTHORIZED' });
    return;
  }
  const body = req.body as { selectionToken: string };
  await CampaignSelection.updateOne(
    { token: body.selectionToken, userId },
    { $set: { invalidated: true } },
  ).exec();
  res.status(200).json({ ok: true });
}

export async function internalListPromotions(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const q = req.query as unknown as {
    page: number;
    limit: number;
    status?: string;
    placement?: string;
  };
  const filter: Record<string, unknown> = {};
  if (q.status) {
    filter.status = q.status;
  }
  if (q.placement) {
    filter.placements = q.placement;
  }
  const skip = (q.page - 1) * q.limit;
  const [items, total] = await Promise.all([
    Promotion.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(q.limit).lean().exec(),
    Promotion.countDocuments(filter).exec(),
  ]);
  res.status(200).json({
    items: items.map((p) => serializePromotion(p as Parameters<typeof serializePromotion>[0])),
    page: q.page,
    limit: q.limit,
    total,
  });
}

export async function internalCreatePromotion(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const doc = await Promotion.create(body);
  const s = doc.toObject();
  res.status(201).json(serializePromotion(s as Parameters<typeof serializePromotion>[0]));
}

export async function internalGetPromotion(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid id', code: 'INVALID_ID' });
    return;
  }
  const doc = await Promotion.findById(id).lean().exec();
  if (!doc) {
    res.status(404).json({ message: 'Promotion not found', code: 'NOT_FOUND' });
    return;
  }
  res.status(200).json(
    serializePromotion(doc as Parameters<typeof serializePromotion>[0]),
  );
}

export async function internalPatchPromotion(
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

  // Style rules span multiple fields; validate against the merged document
  // since a partial patch may only change one of them.
  const existing = (await Promotion.findById(id).lean().exec()) as {
    modalSize?: string;
    mediaType?: string;
    mediaUrl?: string;
    background?: string;
    htmlContent?: string;
  } | null;
  if (!existing) {
    res.status(404).json({ message: 'Promotion not found', code: 'NOT_FOUND' });
    return;
  }
  const merged = { ...existing, ...update } as {
    modalSize?: string;
    mediaType?: string;
    mediaUrl?: string;
    background?: string;
    htmlContent?: string;
  };
  const styleIssues = getPromotionStyleIssues({
    modalSize: merged.modalSize ?? 'medium',
    mediaType: merged.mediaType ?? 'none',
    mediaUrl: merged.mediaUrl ?? '',
    background: merged.background ?? '',
    htmlContent: merged.htmlContent ?? '',
  });
  if (styleIssues.length) {
    res.status(400).json({
      message: styleIssues.map((i) => i.message).join('; '),
      code: 'INVALID_PROMOTION_STYLE',
      issues: styleIssues,
    });
    return;
  }

  const doc = await Promotion.findByIdAndUpdate(id, { $set: update }, { new: true }).exec();
  if (!doc) {
    res.status(404).json({ message: 'Promotion not found', code: 'NOT_FOUND' });
    return;
  }
  const s = doc.toObject();
  res.status(200).json(serializePromotion(s as Parameters<typeof serializePromotion>[0]));
}

export async function internalGetPromotionReport(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid id', code: 'INVALID_ID' });
    return;
  }
  const promo = await Promotion.findById(id).lean().exec();
  if (!promo) {
    res.status(404).json({ message: 'Promotion not found', code: 'NOT_FOUND' });
    return;
  }

  const events = await CampaignEvent.aggregate([
    { $match: { contentId: id } },
    {
      $group: {
        _id: {
          day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          eventType: '$eventType',
          platform: '$platform',
          appVersion: '$appVersion',
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.day': 1 } },
  ]).exec();

  const stats = (promo as { stats?: Record<string, number> }).stats ?? {};
  const impressions = stats.impressions ?? 0;
  const primaryCta = stats.primaryCta ?? 0;
  const ctr = impressions > 0 ? primaryCta / impressions : 0;

  res.status(200).json({
    promotionId: id,
    stats: {
      ...stats,
      clickThroughRate: ctr,
    },
    series: events,
  });
}

export async function internalGetPlacementConfig(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { placement } = req.params;
  const doc = await getOrCreatePlacementConfig(placement);
  const o = doc.toObject();
  res.status(200).json({
    placement: o.placement,
    surveyContentTypeWeight: o.surveyContentTypeWeight,
    promotionContentTypeWeight: o.promotionContentTypeWeight,
    enabledContentTypes: o.enabledContentTypes,
    promotionsEnabled: o.promotionsEnabled,
    updatedAt: o.updatedAt,
  });
}

export async function internalPatchPlacementConfig(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { placement } = req.params;
  const body = req.body as {
    surveyContentTypeWeight: number;
    promotionContentTypeWeight: number;
    enabledContentTypes?: string[];
    promotionsEnabled?: boolean;
  };
  const update: Record<string, unknown> = {
    surveyContentTypeWeight: body.surveyContentTypeWeight,
    promotionContentTypeWeight: body.promotionContentTypeWeight,
  };
  if (body.enabledContentTypes) {
    update.enabledContentTypes = body.enabledContentTypes;
  }
  if (body.promotionsEnabled !== undefined) {
    update.promotionsEnabled = body.promotionsEnabled;
  }
  const doc = await CampaignPlacementConfig.findOneAndUpdate(
    { placement },
    { $set: update },
    { new: true, upsert: true },
  ).exec();
  if (!doc) {
    res.status(500).json({ message: 'Failed to update placement config', code: 'INTERNAL' });
    return;
  }
  const o = doc.toObject();
  res.status(200).json({
    placement: o.placement,
    surveyContentTypeWeight: o.surveyContentTypeWeight,
    promotionContentTypeWeight: o.promotionContentTypeWeight,
    enabledContentTypes: o.enabledContentTypes,
    promotionsEnabled: o.promotionsEnabled,
    updatedAt: o.updatedAt,
  });
}
