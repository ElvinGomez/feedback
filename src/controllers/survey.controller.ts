import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { Survey } from '../models/survey.model';
import type { SurveyQuestion } from '../models/survey.model';
import { SurveyResponse } from '../models/survey-response.model';
import { translationQuestionsMismatchMessage } from '../validation/survey.validation';
import { logger } from '../utils/logger';

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

type SurveyTranslations = Record<
  string,
  { title: string; questions: SurveyQuestion[] }
>;

function serializeSurvey(s: {
  _id: mongoose.Types.ObjectId;
  defaultLocale?: string;
  translations?: SurveyTranslations;
  title: string;
  questions: unknown[];
  placements: string[];
  priority: number;
  status: string;
  schedule?: { startAt?: Date; endAt?: Date };
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: s._id.toString(),
    defaultLocale: s.defaultLocale ?? 'en',
    translations: s.translations ?? {},
    title: s.title,
    questions: s.questions,
    placements: s.placements,
    priority: s.priority,
    status: s.status,
    schedule: s.schedule
      ? {
          startAt: s.schedule.startAt?.toISOString() ?? null,
          endAt: s.schedule.endAt?.toISOString() ?? null,
        }
      : null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

function pickTranslationBundle(
  translations: SurveyTranslations | undefined,
  locale: string,
): { title: string; questions: SurveyQuestion[] } | null {
  if (!translations || typeof translations !== 'object') {
    return null;
  }
  const exact = translations[locale];
  if (exact) {
    return exact;
  }
  const short = locale.split(/[-_]/)[0];
  if (short && translations[short]) {
    return translations[short];
  }
  return null;
}

function mergeQuestionDisplayLabels(
  base: SurveyQuestion[],
  tr: SurveyQuestion[],
): SurveyQuestion[] {
  const trById = new Map(tr.map((q) => [q.id, q]));
  return base.map((bq) => {
    const t = trById.get(bq.id);
    if (!t) {
      return bq;
    }
    const next: SurveyQuestion = {
      ...bq,
      label: (t.label ?? '').trim() || bq.label,
    };
    if (bq.type === 'single_choice' && bq.options && t.options) {
      const tm = new Map(t.options.map((o) => [o.id, o]));
      next.options = bq.options.map((o) => ({
        ...o,
        label: (tm.get(o.id)?.label ?? '').trim() || o.label,
      }));
    }
    return next;
  });
}

function displaySurveyForLocale(
  survey: {
    title: string;
    questions: unknown;
    defaultLocale?: string;
    translations?: SurveyTranslations;
  },
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
    questions: mergeQuestionDisplayLabels(primary.questions, bundle.questions),
  };
}

function validateTranslationsPayload(
  defaultLocale: string,
  baseQuestions: SurveyQuestion[],
  translations: SurveyTranslations | undefined,
): string | null {
  if (!translations) {
    return null;
  }
  for (const loc of Object.keys(translations)) {
    if (loc === defaultLocale) {
      return `Translation locale "${loc}" cannot duplicate defaultLocale.`;
    }
    const msg = translationQuestionsMismatchMessage(
      baseQuestions,
      translations[loc].questions,
    );
    if (msg) {
      return `${loc}: ${msg}`;
    }
  }
  return null;
}

function validateAnswersForQuestions(
  questions: SurveyQuestion[],
  answers: Record<string, unknown>,
): string | null {
  for (const q of questions) {
    const v = answers[q.id];
    if (v === undefined || v === null) {
      return `Missing answer for question ${q.id}`;
    }
    switch (q.type) {
      case 'nps': {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0 || n > 10) {
          return `Invalid NPS for ${q.id}`;
        }
        break;
      }
      case 'rating': {
        const n = Number(v);
        const min = q.min ?? 1;
        const max = q.max ?? 5;
        if (!Number.isFinite(n) || n < min || n > max) {
          return `Invalid rating for ${q.id}`;
        }
        break;
      }
      case 'single_choice': {
        if (typeof v !== 'string' || !v.length) {
          return `Invalid choice for ${q.id}`;
        }
        const opts = q.options ?? [];
        if (!opts.some((o) => o.id === v)) {
          return `Invalid option for ${q.id}`;
        }
        break;
      }
      case 'open_text': {
        if (typeof v !== 'string') {
          return `Invalid text for ${q.id}`;
        }
        break;
      }
      default:
        return `Unknown question type for ${q.id}`;
    }
  }
  return null;
}

export async function getActiveSurvey(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'Unauthorized', code: 'UNAUTHORIZED' });
    return;
  }

  const { placement, locale } = req.query as { placement: string; locale?: string };
  const now = new Date();

  const filter: Record<string, unknown> = {
    status: 'published',
    placements: placement,
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

  try {
    const candidates = await Survey.find(filter)
      .sort({ priority: -1, updatedAt: -1 })
      .lean()
      .exec();

    for (const s of candidates) {
      const sid = s._id as mongoose.Types.ObjectId;
      const existing = await SurveyResponse.findOne({
        surveyId: sid,
        userId,
      })
        .select('_id')
        .lean()
        .exec();
      if (!existing) {
        const shown = displaySurveyForLocale(
          {
            title: s.title,
            questions: s.questions,
            defaultLocale: (s as { defaultLocale?: string }).defaultLocale,
            translations: (s as { translations?: SurveyTranslations }).translations,
          },
          locale,
        );
        res.status(200).json({
          survey: {
            id: sid.toString(),
            title: shown.title,
            questions: shown.questions,
          },
        });
        return;
      }
    }

    res.status(200).json({ survey: null });
  } catch (e) {
    logger.error('getActiveSurvey failed', e);
    res.status(500).json({ message: 'Failed to load survey', code: 'INTERNAL' });
  }
}

export async function submitSurveyResponse(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'Unauthorized', code: 'UNAUTHORIZED' });
    return;
  }

  const { surveyId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(surveyId)) {
    res.status(400).json({ message: 'Invalid survey id', code: 'INVALID_ID' });
    return;
  }

  const body = req.body as { placement: string; answers: Record<string, unknown> };
  const survey = (await Survey.findById(surveyId).lean().exec()) as {
    status: string;
    placements: string[];
    questions: SurveyQuestion[];
  } | null;
  if (!survey || survey.status !== 'published') {
    res.status(404).json({ message: 'Survey not found', code: 'NOT_FOUND' });
    return;
  }

  if (!survey.placements.includes(body.placement)) {
    res.status(400).json({
      message: 'Invalid placement for this survey',
      code: 'INVALID_PLACEMENT',
    });
    return;
  }

  const questions = survey.questions as SurveyQuestion[];
  const err = validateAnswersForQuestions(questions, body.answers);
  if (err) {
    res.status(400).json({ message: err, code: 'INVALID_ANSWERS' });
    return;
  }

  try {
    await SurveyResponse.create({
      surveyId,
      userId,
      placement: body.placement,
      answers: body.answers,
    });
    res.status(201).json({ ok: true });
  } catch (e) {
    if (isDuplicateKeyError(e)) {
      res.status(409).json({
        message: 'You have already responded to this survey',
        code: 'SURVEY_DUPLICATE',
      });
      return;
    }
    logger.error('submitSurveyResponse failed', e);
    res.status(500).json({ message: 'Failed to save response', code: 'INTERNAL' });
  }
}

export async function internalListSurveys(
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
    Survey.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(q.limit)
      .lean()
      .exec(),
    Survey.countDocuments(filter).exec(),
  ]);

  res.status(200).json({
    items: items.map((s) => serializeSurvey(s as Parameters<typeof serializeSurvey>[0])),
    page: q.page,
    limit: q.limit,
    total,
  });
}

export async function internalCreateSurvey(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const body = req.body as {
    defaultLocale: string;
    translations?: SurveyTranslations;
    title: string;
    questions: SurveyQuestion[];
    placements: string[];
    priority: number;
    status: string;
    schedule?: { startAt?: Date; endAt?: Date };
  };

  const trErr = validateTranslationsPayload(
    body.defaultLocale,
    body.questions,
    body.translations,
  );
  if (trErr) {
    res.status(400).json({ message: trErr, code: 'INVALID_TRANSLATIONS' });
    return;
  }

  const doc = await Survey.create({
    defaultLocale: body.defaultLocale,
    translations: body.translations,
    title: body.title,
    questions: body.questions,
    placements: body.placements,
    priority: body.priority,
    status: body.status,
    schedule: body.schedule,
  });

  const s = doc.toObject();
  res.status(201).json(serializeSurvey(s as Parameters<typeof serializeSurvey>[0]));
}

export async function internalPatchSurvey(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid id', code: 'INVALID_ID' });
    return;
  }

  const body = req.body as {
    defaultLocale?: string;
    translations?: SurveyTranslations;
    title?: string;
    questions?: SurveyQuestion[];
    placements?: string[];
    priority?: number;
    status?: string;
    schedule?: { startAt?: Date | null; endAt?: Date | null };
  };

  const existing = await Survey.findById(id).lean().exec();
  if (!existing) {
    res.status(404).json({ message: 'Survey not found', code: 'NOT_FOUND' });
    return;
  }

  const existingSurvey = existing as unknown as {
    questions: SurveyQuestion[];
    defaultLocale?: string;
    translations?: SurveyTranslations;
  };

  const nextDefault = body.defaultLocale ?? existingSurvey.defaultLocale ?? 'en';
  const nextQuestions = (body.questions ?? existingSurvey.questions) as SurveyQuestion[];
  const nextTranslations =
    body.translations !== undefined
      ? body.translations
      : (existingSurvey.translations ?? undefined);

  const trErr = validateTranslationsPayload(nextDefault, nextQuestions, nextTranslations);
  if (trErr) {
    res.status(400).json({ message: trErr, code: 'INVALID_TRANSLATIONS' });
    return;
  }

  const update: Record<string, unknown> = {};
  if (body.defaultLocale !== undefined) {
    update.defaultLocale = body.defaultLocale;
  }
  if (body.translations !== undefined) {
    update.translations = body.translations;
  }
  if (body.title !== undefined) {
    update.title = body.title;
  }
  if (body.questions !== undefined) {
    update.questions = body.questions;
  }
  if (body.placements !== undefined) {
    update.placements = body.placements;
  }
  if (body.priority !== undefined) {
    update.priority = body.priority;
  }
  if (body.status !== undefined) {
    update.status = body.status;
  }
  if (body.schedule !== undefined) {
    const sched: Record<string, unknown> = {};
    if (body.schedule.startAt !== undefined) {
      sched.startAt = body.schedule.startAt;
    }
    if (body.schedule.endAt !== undefined) {
      sched.endAt = body.schedule.endAt;
    }
    update.schedule = sched;
  }

  const doc = await Survey.findByIdAndUpdate(id, { $set: update }, { new: true }).exec();
  if (!doc) {
    res.status(404).json({ message: 'Survey not found', code: 'NOT_FOUND' });
    return;
  }

  const s = doc.toObject();
  res.status(200).json(serializeSurvey(s as Parameters<typeof serializeSurvey>[0]));
}

export async function internalListSurveyResponses(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid id', code: 'INVALID_ID' });
    return;
  }

  const q = req.query as unknown as { page: number; limit: number };
  const skip = (q.page - 1) * q.limit;

  const [items, total] = await Promise.all([
    SurveyResponse.find({ surveyId: id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(q.limit)
      .lean()
      .exec(),
    SurveyResponse.countDocuments({ surveyId: id }).exec(),
  ]);

  res.status(200).json({
    items: items.map((r) => {
      const row = r as {
        _id: mongoose.Types.ObjectId;
        surveyId: mongoose.Types.ObjectId;
        userId: string;
        placement: string;
        answers: unknown;
        createdAt: Date;
      };
      return {
        id: row._id.toString(),
        surveyId: String(row.surveyId),
        userId: row.userId,
        placement: row.placement,
        answers: row.answers,
        createdAt: row.createdAt,
      };
    }),
    page: q.page,
    limit: q.limit,
    total,
  });
}
