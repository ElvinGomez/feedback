import axios from 'axios';
import env from '../config/env';
import { logger } from '../utils/logger';

export type DraftNotificationCampaignInput = {
  title: string;
  body: string;
  category: 'SURVEY' | 'ANNOUNCEMENT' | 'PROMOTION';
  imageUrl?: string | null;
  audience?: unknown;
};

/**
 * Fire-and-forget: creates a draft push campaign in backend/notifications so an
 * admin reviews and sends it from the Push Campaigns page. Never throws into
 * the caller's own create/update flow — call sites should `.catch(logger.warn)`
 * this rather than await it inline, same convention as domain-event publishers.
 */
export async function createDraftNotificationCampaign(
  input: DraftNotificationCampaignInput,
): Promise<void> {
  if (!env.notificationsServiceBaseUrl || !env.notificationsInternalApiKey) {
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
