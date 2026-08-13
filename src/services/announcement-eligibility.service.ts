import mongoose from 'mongoose';
import type { AnnouncementFrequencyRule } from '../constants/announcement.constants';
import { Announcement } from '../models/announcement.model';
import { AnnouncementUserState } from '../models/announcement-user-state.model';
import { sanitizeAnnouncementStyle } from '../validation/announcement.validation';
import {
  matchesTargetAudience,
  type AudienceContext,
} from './audience-matching.service';

type AnnouncementCandidate = {
  _id: mongoose.Types.ObjectId;
  displayStyle: string;
  modalSize?: string;
  priority: number;
  defaultLocale?: string;
  translations?: Record<
    string,
    {
      title?: string;
      message?: string;
      primaryAction?: { label: string };
      secondaryAction?: { label: string };
    }
  >;
  title: string;
  message?: string;
  mediaType?: string;
  mediaUrl?: string;
  background?: string;
  htmlContent?: string;
  icon?: string;
  primaryAction?: { label: string; type: string; value?: string } | null;
  secondaryAction?: { label: string; type: string; value?: string } | null;
  dismissible?: boolean;
  frequencyRule?: AnnouncementFrequencyRule;
  platforms?: string[];
  minAppVersion?: string;
  maxAppVersion?: string;
  targetAudience?: unknown;
  schedule?: { startAt?: Date; endAt?: Date };
};

export type AnnouncementPayload = {
  id: string;
  displayStyle: string;
  modalSize: string;
  title: string;
  message: string;
  mediaType: string;
  mediaUrl: string;
  background: string;
  htmlContent: string;
  icon: string;
  primaryAction: { label: string; type: string; value: string } | null;
  secondaryAction: { label: string; type: string; value: string } | null;
  dismissible: boolean;
};

/** Local copy of the semver comparator (see campaign-selection.service.ts) — kept
 * independent so Announcements has no coupling to Promotion's selection engine. */
function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, '').split('.').map((n) => Number.parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) {
      return da < db ? -1 : 1;
    }
  }
  return 0;
}

function pickTranslationBundle<T>(
  translations: Record<string, T> | undefined,
  locale: string | undefined,
): T | null {
  if (!translations || !locale) {
    return null;
  }
  if (translations[locale]) {
    return translations[locale];
  }
  const short = locale.split(/[-_]/)[0];
  if (short && translations[short]) {
    return translations[short];
  }
  return null;
}

function displayAnnouncement(
  a: AnnouncementCandidate,
  locale: string | undefined,
): AnnouncementPayload {
  const def = a.defaultLocale ?? 'en';
  const bundle =
    locale && locale !== def ? pickTranslationBundle(a.translations, locale) : null;
  const style = sanitizeAnnouncementStyle({
    displayStyle: a.displayStyle,
    modalSize: a.modalSize ?? 'medium',
    mediaType: a.mediaType ?? 'text',
    mediaUrl: a.mediaUrl ?? '',
    background: a.background ?? '',
    htmlContent: a.htmlContent ?? '',
  });
  return {
    id: a._id.toString(),
    displayStyle: a.displayStyle,
    modalSize: a.displayStyle === 'modal' ? style.modalSize : 'medium',
    title: bundle?.title || a.title,
    message: style.mediaType === 'html' ? '' : bundle?.message ?? a.message ?? '',
    mediaType: style.mediaType,
    mediaUrl: style.mediaUrl,
    background: style.background,
    htmlContent: style.htmlContent,
    icon: a.icon ?? '',
    primaryAction: a.primaryAction
      ? {
          label: bundle?.primaryAction?.label || a.primaryAction.label,
          type: a.primaryAction.type,
          value: a.primaryAction.value ?? '',
        }
      : null,
    secondaryAction: a.secondaryAction
      ? {
          label: bundle?.secondaryAction?.label || a.secondaryAction.label,
          type: a.secondaryAction.type,
          value: a.secondaryAction.value ?? '',
        }
      : null,
    dismissible: a.dismissible !== false,
  };
}

function passesFrequencyRule(
  rule: AnnouncementFrequencyRule | undefined,
  state: {
    seenCount: number;
    lastSeenSessionId?: string | null;
    lastDismissedSessionId?: string | null;
  } | null,
  sessionId: string | undefined,
): boolean {
  if (!state) {
    return true;
  }
  const r = rule ?? 'once_ever';
  if (r === 'once_ever') {
    return state.seenCount <= 0;
  }
  if (r === 'once_per_session') {
    return !sessionId || state.lastSeenSessionId !== sessionId;
  }
  // repeat_until_end_date: hidden for the rest of the session it was dismissed
  // in; reappears on the next session (bounded by the schedule end date, which
  // is already enforced by the schedule-window query).
  return !sessionId || state.lastDismissedSessionId !== sessionId;
}

export async function getActiveAnnouncementsForUser(opts: {
  userId: string;
  locale?: string;
  sessionId?: string;
  appVersion?: string;
  platform?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
}): Promise<{ banner: AnnouncementPayload | null; modal: AnnouncementPayload | null }> {
  const now = new Date();
  const audienceCtx = {
    userId: opts.userId,
    locale: opts.locale,
    platform: opts.platform,
    appVersion: opts.appVersion,
    countryCode: opts.countryCode,
    latitude: opts.latitude,
    longitude: opts.longitude,
  } satisfies AudienceContext;

  const candidates = (await Announcement.find({
    status: 'active',
    $and: [
      {
        $or: [
          { 'schedule.startAt': { $exists: false } },
          { 'schedule.startAt': null },
          { 'schedule.startAt': { $lte: now } },
        ],
      },
      {
        $or: [
          { 'schedule.endAt': { $exists: false } },
          { 'schedule.endAt': null },
          { 'schedule.endAt': { $gte: now } },
        ],
      },
    ],
  })
    .sort({ priority: -1, createdAt: -1 })
    .limit(100)
    .lean()
    .exec()) as AnnouncementCandidate[];

  const filtered: AnnouncementCandidate[] = [];
  for (const a of candidates) {
    if (a.platforms?.length && opts.platform && !a.platforms.includes(opts.platform)) {
      continue;
    }
    if (a.minAppVersion && opts.appVersion && compareSemver(opts.appVersion, a.minAppVersion) < 0) {
      continue;
    }
    if (a.maxAppVersion && opts.appVersion && compareSemver(opts.appVersion, a.maxAppVersion) > 0) {
      continue;
    }
    const audienceMatch = matchesTargetAudience(a.targetAudience, audienceCtx);
    if (!audienceMatch.matched) {
      continue;
    }
    filtered.push(a);
  }

  if (!filtered.length) {
    return { banner: null, modal: null };
  }

  const states = (await AnnouncementUserState.find({
    userId: opts.userId,
    announcementId: { $in: filtered.map((a) => a._id) },
  })
    .lean()
    .exec()) as unknown as Array<{
    announcementId: mongoose.Types.ObjectId;
    seenCount: number;
    lastSeenSessionId?: string | null;
    lastDismissedSessionId?: string | null;
  }>;
  const stateById = new Map(states.map((s) => [s.announcementId.toString(), s]));

  let banner: AnnouncementCandidate | null = null;
  let modal: AnnouncementCandidate | null = null;
  for (const a of filtered) {
    if (banner && modal) {
      break;
    }
    const isBannerSlot = a.displayStyle === 'banner' && !banner;
    const isModalSlot = a.displayStyle === 'modal' && !modal;
    if (!isBannerSlot && !isModalSlot) {
      continue;
    }
    const state = stateById.get(a._id.toString()) ?? null;
    if (!passesFrequencyRule(a.frequencyRule, state, opts.sessionId)) {
      continue;
    }
    if (isBannerSlot) {
      banner = a;
    } else if (isModalSlot) {
      modal = a;
    }
  }

  return {
    banner: banner ? displayAnnouncement(banner, opts.locale) : null,
    modal: modal ? displayAnnouncement(modal, opts.locale) : null,
  };
}
