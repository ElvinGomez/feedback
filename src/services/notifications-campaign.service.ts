import axios from 'axios';
import env from '../config/env';
import { Promotion } from '../models/promotion.model';
import { logger } from '../utils/logger';

export type DraftNotificationCampaignInput = {
  title: string;
  body: string;
  category: 'SURVEY' | 'ANNOUNCEMENT' | 'PROMOTION';
  imageUrl?: string | null;
  audience?: unknown;
};

function notificationsConfigured(): boolean {
  return Boolean(env.notificationsServiceBaseUrl && env.notificationsInternalApiKey);
}

/**
 * Fire-and-forget: creates a draft push campaign in backend/notifications so an
 * admin reviews and sends it from the Push Campaigns page. Never throws into
 * the caller's own create/update flow — call sites should `.catch(logger.warn)`
 * this rather than await it inline, same convention as domain-event publishers.
 */
export async function createDraftNotificationCampaign(
  input: DraftNotificationCampaignInput,
): Promise<void> {
  if (!notificationsConfigured()) {
    logger.warn(
      'Skipping notification campaign draft: NOTIFICATIONS_SERVICE_BASE_URL/NOTIFICATIONS_INTERNAL_API_KEY not configured',
    );
    return;
  }
  await axios.post(
    `${env.notificationsServiceBaseUrl}/notifications/internal/campaigns`,
    {
      title: input.title,
      body: input.body,
      category: input.category,
      imageUrl: input.imageUrl ?? null,
      audience: input.audience ?? { allowAll: true },
    },
    {
      headers: { Authorization: `Bearer ${env.notificationsInternalApiKey}` },
      timeout: 8000,
    },
  );
}

/** Deep link the app resolves to "open this promotion's modal on Home". */
export function promotionDeepLink(promotionId: string): string {
  return `tripsi://promotions/${promotionId}`;
}

const PUSH_TITLE_MAX = 200;
const PUSH_BODY_MAX = 1000;

type PromotionPushSource = {
  _id: unknown;
  internalName: string;
  title?: string;
  message?: string;
  mediaType?: string;
  mediaUrl?: string;
  targetAudience?: unknown;
  schedule?: { startAt?: Date | null; endAt?: Date | null } | null;
};

/** Campaign payload for a promotion's push; exported for tests. */
export function buildPromotionPushCampaign(promo: PromotionPushSource, now: Date) {
  const id = String(promo._id);
  const title = (promo.title?.trim() || promo.internalName.trim()).slice(0, PUSH_TITLE_MAX);
  // notifications requires a non-empty body; html promotions have no message.
  const body = (promo.message?.trim() || title).slice(0, PUSH_BODY_MAX);
  const mediaUrl = promo.mediaUrl?.trim() ?? '';
  const imageUrl = promo.mediaType === 'image' && /^https?:\/\//i.test(mediaUrl) ? mediaUrl : null;
  const startAt = promo.schedule?.startAt ? new Date(promo.schedule.startAt) : null;
  const endAt = promo.schedule?.endAt ? new Date(promo.schedule.endAt) : null;
  const scheduledAt = startAt && startAt > now ? startAt : null;
  return {
    title,
    body,
    category: 'PROMOTION' as const,
    deepLink: promotionDeepLink(id),
    imageUrl,
    audience: promo.targetAudience ?? { allowAll: true },
    scheduledAt: scheduledAt?.toISOString() ?? null,
    expiresAt: endAt?.toISOString() ?? null,
    // Send right away unless the promotion starts later; notifications sends scheduled ones when due.
    sendNow: !scheduledAt,
  };
}

function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: unknown } | undefined;
    const detail = typeof data?.message === 'string' ? data.message : err.message;
    return `notifications ${err.response?.status ?? 'unreachable'}: ${detail}`.slice(0, 300);
  }
  return (err instanceof Error ? err.message : String(err)).slice(0, 300);
}

/**
 * Sends a promotion's push once it is active. Claims the promotion atomically
 * (pushDispatchedAt) so create + patch races never send twice; on failure the
 * claim is released and `pushError` records why, so the next activation retries.
 * Never throws — call sites fire and forget.
 */
export async function dispatchPromotionPush(promotionId: string, now = new Date()): Promise<void> {
  const promo = await Promotion.findOneAndUpdate(
    {
      _id: promotionId,
      status: 'active',
      notifyChannel: { $in: ['push', 'both'] },
      pushDispatchedAt: null,
      $or: [{ 'schedule.endAt': null }, { 'schedule.endAt': { $exists: false } }, { 'schedule.endAt': { $gt: now } }],
    },
    { $set: { pushDispatchedAt: now, pushError: null } },
    { new: true },
  )
    .lean()
    .exec();
  if (!promo) {
    return;
  }

  const release = async (reason: string) => {
    await Promotion.updateOne(
      { _id: promotionId },
      { $set: { pushDispatchedAt: null, pushError: reason } },
    ).exec();
  };

  if (!notificationsConfigured()) {
    logger.warn(
      'Promotion push not sent: NOTIFICATIONS_SERVICE_BASE_URL/NOTIFICATIONS_INTERNAL_API_KEY not configured',
    );
    await release('notifications_not_configured');
    return;
  }

  try {
    const res = await axios.post<{ data?: { _id?: string } }>(
      `${env.notificationsServiceBaseUrl}/notifications/internal/campaigns`,
      buildPromotionPushCampaign(promo as unknown as PromotionPushSource, now),
      {
        headers: { Authorization: `Bearer ${env.notificationsInternalApiKey}` },
        timeout: 8000,
      },
    );
    const campaignId = res.data?.data?._id ?? null;
    await Promotion.updateOne(
      { _id: promotionId },
      { $set: { pushCampaignId: campaignId ? String(campaignId) : null } },
    ).exec();
  } catch (err) {
    const reason = errorMessage(err);
    logger.warn(`Promotion push not sent for ${promotionId}: ${reason}`);
    await release(reason);
  }
}
