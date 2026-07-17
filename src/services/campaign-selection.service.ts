import { randomInt, randomUUID } from 'crypto';
import mongoose from 'mongoose';
import {
  PROMOTION_PLACEMENTS_V1,
  SELECTION_TOKEN_TTL_MS,
  type CampaignContentType,
  type FrequencyRule,
  type ModalSize,
} from '../constants/campaign.constants';
import { getOrCreatePlacementConfig } from '../models/campaign-placement-config.model';
import { CampaignSelection } from '../models/campaign-selection.model';
import { Promotion } from '../models/promotion.model';
import { PromotionUserState } from '../models/promotion-user-state.model';
import { Survey } from '../models/survey.model';
import type { SurveyQuestion } from '../models/survey.model';
import { SurveyResponse } from '../models/survey-response.model';
import { logger } from '../utils/logger';

export type WeightedItem = { id: string; weight: number };

export function weightedPick<T extends WeightedItem>(items: T[]): T | null {
  const pool = items.filter((i) => i.weight > 0);
  if (!pool.length) {
    return null;
  }
  const total = pool.reduce((s, i) => s + i.weight, 0);
  let r = randomInt(0, total);
  for (const item of pool) {
    r -= item.weight;
    if (r < 0) {
      return item;
    }
  }
  return pool[pool.length - 1];
}

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

function isWithinSchedule(
  schedule: { startAt?: Date | null; endAt?: Date | null } | undefined,
  now: Date,
): boolean {
  if (!schedule) {
    return true;
  }
  if (schedule.startAt && schedule.startAt > now) {
    return false;
  }
  if (schedule.endAt && schedule.endAt < now) {
    return false;
  }
  return true;
}

function passesFrequencyCap(
  rule: FrequencyRule | undefined,
  state: {
    impressionCount: number;
    lastImpressionAt?: Date | null;
    lastSessionId?: string | null;
  } | null,
  opts: {
    sessionId?: string;
    frequencyHours?: number;
    maxImpressionsPerUser?: number;
    now: Date;
  },
): boolean {
  const r = rule ?? 'none';
  if (r === 'none') {
    return true;
  }
  if (!state) {
    return true;
  }
  if (r === 'once_per_session') {
    if (opts.sessionId && state.lastSessionId === opts.sessionId && state.impressionCount > 0) {
      return false;
    }
    return true;
  }
  if (r === 'once_per_day') {
    if (!state.lastImpressionAt) {
      return true;
    }
    const last = state.lastImpressionAt;
    return !(
      last.getUTCFullYear() === opts.now.getUTCFullYear() &&
      last.getUTCMonth() === opts.now.getUTCMonth() &&
      last.getUTCDate() === opts.now.getUTCDate()
    );
  }
  if (r === 'every_n_hours') {
    const hours = opts.frequencyHours ?? 24;
    if (!state.lastImpressionAt) {
      return true;
    }
    const elapsedMs = opts.now.getTime() - state.lastImpressionAt.getTime();
    return elapsedMs >= hours * 60 * 60 * 1000;
  }
  if (r === 'max_impressions_per_user') {
    const cap = opts.maxImpressionsPerUser ?? 1;
    return state.impressionCount < cap;
  }
  return true;
}

type SurveyCandidate = {
  _id: mongoose.Types.ObjectId;
  title: string;
  questions: unknown[];
  defaultLocale?: string;
  translations?: Record<string, { title: string; questions: SurveyQuestion[] }>;
  priority: number;
  selectionWeight?: number;
  placements: string[];
  status: string;
  schedule?: { startAt?: Date; endAt?: Date };
};

type PromotionCandidate = {
  _id: mongoose.Types.ObjectId;
  internalName?: string;
  title: string;
  message?: string;
  mediaType?: string;
  mediaUrl?: string;
  mediaLayout?: string;
  textAlignment?: string;
  background?: string;
  dismissible?: boolean;
  modalSize?: string;
  primaryAction: { label: string; type: string; value?: string };
  secondaryAction?: { label: string; type: string; value?: string } | null;
  selectionWeight: number;
  status: string;
  placements: string[];
  schedule?: { startAt?: Date; endAt?: Date };
  frequencyRule?: FrequencyRule;
  frequencyHours?: number;
  maxImpressionsPerUser?: number;
  maxTotalImpressions?: number;
  maxInteractions?: number;
  platforms?: string[];
  minAppVersion?: string;
  maxAppVersion?: string;
  stats?: { impressions?: number; primaryCta?: number; secondaryCta?: number };
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
};

export type CampaignContentResult = {
  contentId: string;
  contentType: CampaignContentType;
  placement: string;
  selectionToken: string;
  modalSize: ModalSize;
  selectionAudit: Record<string, unknown>;
  content: Record<string, unknown>;
} | null;

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

function displaySurvey(
  survey: SurveyCandidate,
  locale: string | undefined,
): { title: string; questions: SurveyQuestion[] } {
  const primary = {
    title: survey.title,
    questions: survey.questions as SurveyQuestion[],
  };
  const def = survey.defaultLocale ?? 'en';
  if (!locale || locale === def) {
    return primary;
  }
  const bundle = pickTranslationBundle(survey.translations, locale);
  if (!bundle) {
    return primary;
  }
  return {
    title: bundle.title || primary.title,
    questions: primary.questions,
  };
}

function displayPromotion(promo: PromotionCandidate, locale: string | undefined) {
  const def = promo.defaultLocale ?? 'en';
  const bundle =
    locale && locale !== def ? pickTranslationBundle(promo.translations, locale) : null;
  return {
    title: bundle?.title || promo.title,
    message: bundle?.message ?? promo.message ?? '',
    mediaType: promo.mediaType ?? 'none',
    mediaUrl: promo.mediaUrl ?? '',
    mediaLayout: promo.mediaLayout ?? 'top',
    textAlignment: promo.textAlignment ?? 'center',
    background: promo.background ?? '',
    dismissible: promo.dismissible !== false,
    primaryAction: {
      label: bundle?.primaryAction?.label || promo.primaryAction.label,
      type: promo.primaryAction.type,
      value: promo.primaryAction.value ?? '',
    },
    secondaryAction: promo.secondaryAction
      ? {
          label:
            bundle?.secondaryAction?.label || promo.secondaryAction.label,
          type: promo.secondaryAction.type,
          value: promo.secondaryAction.value ?? '',
        }
      : null,
  };
}

export async function selectCampaignContent(opts: {
  userId: string;
  placement: string;
  locale?: string;
  sessionId?: string;
  appVersion?: string;
  platform?: string;
  stableToken?: string;
  promotionsFeatureEnabled: boolean;
  surveysFeatureEnabled: boolean;
}): Promise<CampaignContentResult> {
  const now = new Date();

  if (opts.stableToken) {
    const existing = (await CampaignSelection.findOne({
      token: opts.stableToken,
      userId: opts.userId,
      invalidated: false,
      expiresAt: { $gt: now },
    })
      .lean()
      .exec()) as {
      token: string;
      placement: string;
      contentType: string;
      contentId: string;
      modalSize?: string;
      selectionAudit?: unknown;
    } | null;
    if (existing && existing.placement === opts.placement) {
      return rebuildResponseFromSelection(existing, opts.locale);
    }
  }

  const placementConfig = await getOrCreatePlacementConfig(opts.placement);
  const enabledTypes = new Set(placementConfig.enabledContentTypes ?? ['survey', 'promotion']);

  const eligibleSurveys: WeightedItem[] = [];
  const surveyById = new Map<string, SurveyCandidate>();

  if (opts.surveysFeatureEnabled && enabledTypes.has('survey')) {
    const surveyFilter: Record<string, unknown> = {
      status: 'published',
      placements: opts.placement,
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
    };
    const candidates = (await Survey.find(surveyFilter).lean().exec()) as SurveyCandidate[];
    for (const s of candidates) {
      const sid = s._id;
      const answered = await SurveyResponse.findOne({
        surveyId: sid,
        userId: opts.userId,
      })
        .select('_id')
        .lean()
        .exec();
      if (answered) {
        continue;
      }
      const id = sid.toString();
      const weight =
        typeof s.selectionWeight === 'number' && Number.isFinite(s.selectionWeight)
          ? s.selectionWeight
          : s.priority ?? 0;
      if (weight <= 0) {
        continue;
      }
      eligibleSurveys.push({ id, weight });
      surveyById.set(id, s);
    }
  }

  const eligiblePromotions: WeightedItem[] = [];
  const promoById = new Map<string, PromotionCandidate>();
  const promoRejections: Array<{ id: string; name?: string; reason: string }> = [];
  const promotionsAllowedForPlacement =
    (PROMOTION_PLACEMENTS_V1 as readonly string[]).includes(opts.placement) &&
    placementConfig.promotionsEnabled !== false;

  const promoGateReason =
    !opts.promotionsFeatureEnabled
      ? 'promotions_feature_disabled'
      : !enabledTypes.has('promotion')
        ? 'placement_config_promotion_type_disabled'
        : !(PROMOTION_PLACEMENTS_V1 as readonly string[]).includes(opts.placement)
          ? 'placement_not_in_promotion_placements_v1'
          : placementConfig.promotionsEnabled === false
            ? 'placement_config_promotionsEnabled_false'
            : null;

  if (
    opts.promotionsFeatureEnabled &&
    enabledTypes.has('promotion') &&
    promotionsAllowedForPlacement
  ) {
    const promoCandidates = (await Promotion.find({
      status: 'active',
      placements: opts.placement,
    })
      .lean()
      .exec()) as PromotionCandidate[];

    for (const p of promoCandidates) {
      const pid = p._id.toString();
      if (!isWithinSchedule(p.schedule, now)) {
        promoRejections.push({ id: pid, name: p.internalName, reason: 'outside_schedule' });
        continue;
      }
      if (p.platforms?.length && opts.platform && !p.platforms.includes(opts.platform)) {
        promoRejections.push({ id: pid, name: p.internalName, reason: `platform_mismatch(need=${p.platforms.join('|')},got=${opts.platform})` });
        continue;
      }
      if (p.minAppVersion && opts.appVersion) {
        if (compareSemver(opts.appVersion, p.minAppVersion) < 0) {
          promoRejections.push({ id: pid, name: p.internalName, reason: `below_min_app_version(min=${p.minAppVersion},got=${opts.appVersion})` });
          continue;
        }
      }
      if (p.maxAppVersion && opts.appVersion) {
        if (compareSemver(opts.appVersion, p.maxAppVersion) > 0) {
          promoRejections.push({ id: pid, name: p.internalName, reason: `above_max_app_version(max=${p.maxAppVersion},got=${opts.appVersion})` });
          continue;
        }
      }
      if (
        typeof p.maxTotalImpressions === 'number' &&
        (p.stats?.impressions ?? 0) >= p.maxTotalImpressions
      ) {
        promoRejections.push({ id: pid, name: p.internalName, reason: 'max_total_impressions_reached' });
        continue;
      }
      if (
        typeof p.maxInteractions === 'number' &&
        (p.stats?.primaryCta ?? 0) + (p.stats?.secondaryCta ?? 0) >= p.maxInteractions
      ) {
        promoRejections.push({ id: pid, name: p.internalName, reason: 'max_interactions_reached' });
        continue;
      }

      const state = (await PromotionUserState.findOne({
        userId: opts.userId,
        promotionId: p._id,
      })
        .lean()
        .exec()) as {
        impressionCount: number;
        lastImpressionAt?: Date | null;
        lastSessionId?: string | null;
      } | null;

      if (
        !passesFrequencyCap(p.frequencyRule, state, {
          sessionId: opts.sessionId,
          frequencyHours: p.frequencyHours,
          maxImpressionsPerUser: p.maxImpressionsPerUser,
          now,
        })
      ) {
        promoRejections.push({ id: pid, name: p.internalName, reason: `frequency_cap(rule=${p.frequencyRule ?? 'none'})` });
        continue;
      }

      if (
        typeof p.maxImpressionsPerUser === 'number' &&
        state &&
        state.impressionCount >= p.maxImpressionsPerUser
      ) {
        promoRejections.push({ id: pid, name: p.internalName, reason: 'max_impressions_per_user_reached' });
        continue;
      }

      const id = pid;
      const weight = p.selectionWeight ?? 0;
      if (weight <= 0) {
        promoRejections.push({ id: pid, name: p.internalName, reason: `weight_zero(selectionWeight=${p.selectionWeight ?? 'undefined'})` });
        continue;
      }
      eligiblePromotions.push({ id, weight });
      promoById.set(id, p);
    }
  }
  const typePool: Array<{ id: CampaignContentType; weight: number }> = [];
  if (eligibleSurveys.length > 0 && (placementConfig.surveyContentTypeWeight ?? 0) > 0) {
    typePool.push({
      id: 'survey',
      weight: placementConfig.surveyContentTypeWeight ?? 50,
    });
  }
  if (eligiblePromotions.length > 0 && (placementConfig.promotionContentTypeWeight ?? 0) > 0) {
    typePool.push({
      id: 'promotion',
      weight: placementConfig.promotionContentTypeWeight ?? 50,
    });
  }

  if (!typePool.length) {
    return null;
  }

  const pickedType = weightedPick(typePool);
  if (!pickedType) {
    return null;
  }

  const selectionAudit = {
    eligibleSurveyIds: eligibleSurveys.map((s) => s.id),
    eligiblePromotionIds: eligiblePromotions.map((p) => p.id),
    surveyContentTypeWeight: placementConfig.surveyContentTypeWeight ?? 50,
    promotionContentTypeWeight: placementConfig.promotionContentTypeWeight ?? 50,
    promotionWeights: Object.fromEntries(eligiblePromotions.map((p) => [p.id, p.weight])),
    surveyWeights: Object.fromEntries(eligibleSurveys.map((s) => [s.id, s.weight])),
    selectedContentTypeWeight: pickedType.weight,
    selectionSource: 'server_weighted_random' as const,
    promotionsFeatureEnabled: opts.promotionsFeatureEnabled,
    surveysFeatureEnabled: opts.surveysFeatureEnabled,
    promotionsEnabled: placementConfig.promotionsEnabled !== false,
    promoGateReason,
    promoRejections: promoRejections.slice(0, 20),
  };

  let contentId: string;
  let modalSize: ModalSize = 'medium';
  let content: Record<string, unknown>;
  let selectedContentWeight = 0;

  if (pickedType.id === 'survey') {
    const picked = weightedPick(eligibleSurveys);
    if (!picked) {
      return null;
    }
    const survey = surveyById.get(picked.id);
    if (!survey) {
      return null;
    }
    contentId = picked.id;
    selectedContentWeight = picked.weight;
    const shown = displaySurvey(survey, opts.locale);
    content = {
      id: contentId,
      title: shown.title,
      questions: shown.questions,
    };
    modalSize = 'medium';
  } else {
    const picked = weightedPick(eligiblePromotions);
    if (!picked) {
      return null;
    }
    const promo = promoById.get(picked.id);
    if (!promo) {
      return null;
    }
    contentId = picked.id;
    selectedContentWeight = picked.weight;
    modalSize = (promo.modalSize as ModalSize) || 'medium';
    content = displayPromotion(promo, opts.locale);
  }

  const token = randomUUID();
  const audit = {
    ...selectionAudit,
    selectedContentWeight,
    finalSelectedContentId: contentId,
    finalSelectedContentType: pickedType.id,
  };

  await CampaignSelection.create({
    token,
    userId: opts.userId,
    sessionId: opts.sessionId,
    placement: opts.placement,
    contentType: pickedType.id,
    contentId,
    modalSize,
    expiresAt: new Date(now.getTime() + SELECTION_TOKEN_TTL_MS),
    selectionAudit: audit,
    impressionRecorded: false,
    invalidated: false,
  });

  return {
    contentId,
    contentType: pickedType.id,
    placement: opts.placement,
    selectionToken: token,
    modalSize,
    selectionAudit: audit,
    content,
  };
}

async function rebuildResponseFromSelection(
  selection: {
    token: string;
    placement: string;
    contentType: string;
    contentId: string;
    modalSize?: string;
    selectionAudit?: unknown;
  },
  locale?: string,
): Promise<CampaignContentResult> {
  if (selection.contentType === 'survey') {
    const survey = (await Survey.findById(selection.contentId).lean().exec()) as
      | SurveyCandidate
      | null;
    if (!survey || survey.status !== 'published') {
      return null;
    }
    const shown = displaySurvey(survey, locale);
    return {
      contentId: selection.contentId,
      contentType: 'survey',
      placement: selection.placement,
      selectionToken: selection.token,
      modalSize: (selection.modalSize as ModalSize) || 'medium',
      selectionAudit: (selection.selectionAudit as Record<string, unknown>) ?? {},
      content: {
        id: selection.contentId,
        title: shown.title,
        questions: shown.questions,
      },
    };
  }

  const promo = (await Promotion.findById(selection.contentId).lean().exec()) as
    | PromotionCandidate
    | null;
  if (!promo || promo.status !== 'active') {
    return null;
  }
  return {
    contentId: selection.contentId,
    contentType: 'promotion',
    placement: selection.placement,
    selectionToken: selection.token,
    modalSize: (selection.modalSize as ModalSize) || 'medium',
    selectionAudit: (selection.selectionAudit as Record<string, unknown>) ?? {},
    content: displayPromotion(promo, locale),
  };
}
