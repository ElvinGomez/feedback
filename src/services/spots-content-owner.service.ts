import env from '../config/env';
import { logger } from '../utils/logger';

type OwnerLookupResult =
  | { status: 'ok'; ownerUserId: string | null }
  | { status: 'skipped' }
  | { status: 'error' };

function parseVisitImageTargetId(
  targetId: string,
): { visitId: string } | null {
  const match = /^(.+):img:(\d+)$/.exec(targetId.trim());
  if (!match) {
    return null;
  }
  return { visitId: match[1] };
}

async function spotsInternalGet<T>(path: string): Promise<T | null> {
  const base = env.spotsServiceBaseUrl;
  const key = env.spotsInternalApiKey;
  if (!base || !key) {
    return null;
  }
  const res = await fetch(`${base}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Spots owner lookup ${res.status} ${detail}`);
  }
  return (await res.json()) as T;
}

async function lookupVisitOwner(visitId: string): Promise<string | null> {
  const json = await spotsInternalGet<{
    data?: { visit?: { userId?: string } } | null;
  }>(`/spots/internal/moderation/visits/${encodeURIComponent(visitId)}`);
  const owner = json?.data?.visit?.userId?.trim();
  return owner || null;
}

async function lookupVisitCommentOwner(commentId: string): Promise<string | null> {
  const json = await spotsInternalGet<{
    data?: { comment?: { userId?: string } } | null;
  }>(
    `/spots/internal/moderation/visit-comments/${encodeURIComponent(commentId)}`,
  );
  const owner = json?.data?.comment?.userId?.trim();
  return owner || null;
}

export async function lookupReportTargetOwner(
  targetType: string,
  targetId: string,
): Promise<OwnerLookupResult> {
  if (targetType === 'user') {
    const id = targetId.trim();
    return { status: 'ok', ownerUserId: id || null };
  }

  const needsSpots =
    targetType === 'spot_visit' ||
    targetType === 'spot_visit_image' ||
    targetType === 'spot_visit_comment';
  if (!needsSpots) {
    return { status: 'skipped' };
  }
  if (!env.spotsServiceBaseUrl || !env.spotsInternalApiKey) {
    return { status: 'skipped' };
  }

  try {
    if (targetType === 'spot_visit') {
      return {
        status: 'ok',
        ownerUserId: await lookupVisitOwner(targetId.trim()),
      };
    }
    if (targetType === 'spot_visit_image') {
      const parsed = parseVisitImageTargetId(targetId);
      if (!parsed) {
        return { status: 'ok', ownerUserId: null };
      }
      return {
        status: 'ok',
        ownerUserId: await lookupVisitOwner(parsed.visitId),
      };
    }
    return {
      status: 'ok',
      ownerUserId: await lookupVisitCommentOwner(targetId.trim()),
    };
  } catch (err) {
    logger.warn('lookupReportTargetOwner failed', err);
    return { status: 'error' };
  }
}

export async function isSelfReport(
  reporterUserId: string,
  targetType: string,
  targetId: string,
): Promise<boolean> {
  const result = await lookupReportTargetOwner(targetType, targetId);
  if (result.status !== 'ok' || !result.ownerUserId) {
    return false;
  }
  return result.ownerUserId === reporterUserId;
}
