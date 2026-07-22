import mongoose from 'mongoose';
import { z } from 'zod';
import type { SurveyQuestion } from '../models/survey.model';
import {
  optionalLatLngQuerySchema,
  targetAudienceSchema,
} from './target-audience.validation';

export const surveySubmitParamsSchema = z.object({
  surveyId: z.string().refine((id) => mongoose.Types.ObjectId.isValid(id), {
    message: 'Invalid survey id',
  }),
});

export const activeSurveyQuerySchema = z.object({
  placement: z.string().min(1),
  /** App locale (e.g. `en`, `es_PA`); picks matching copy from `translations`. */
  locale: z.string().min(2).max(32).optional(),
  ...optionalLatLngQuerySchema,
});

const questionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['nps', 'rating', 'single_choice', 'open_text']),
  label: z.string().min(1),
  options: z
    .array(z.object({ id: z.string(), label: z.string() }))
    .optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});

export const submitSurveyResponseBodySchema = z.object({
  placement: z.string().min(1),
  answers: z.record(z.unknown()),
});

export const internalSurveyListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  placement: z.string().optional(),
});

/** Translation copy: labels may be empty (client falls back to primary strings). */
const translationQuestionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['nps', 'rating', 'single_choice', 'open_text']),
  label: z.string(),
  options: z
    .array(z.object({ id: z.string(), label: z.string() }))
    .optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});

const translationBundleSchema = z.object({
  title: z.string(),
  questions: z.array(translationQuestionSchema).min(1),
});

export const internalCreateSurveyBodySchema = z.object({
  defaultLocale: z.string().min(2).max(32).default('en'),
  translations: z.record(z.string().min(2).max(32), translationBundleSchema).optional(),
  title: z.string().min(1),
  questions: z.array(questionSchema).min(1),
  placements: z.array(z.string().min(1)).default([]),
  priority: z.number().int().default(0),
  selectionWeight: z.number().int().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  schedule: z
    .object({
      startAt: z.coerce.date().optional(),
      endAt: z.coerce.date().optional(),
    })
    .optional(),
  targetAudience: targetAudienceSchema.optional(),
});

export const internalPatchSurveyBodySchema = z.object({
  defaultLocale: z.string().min(2).max(32).optional(),
  translations: z.record(z.string().min(2).max(32), translationBundleSchema).optional(),
  title: z.string().min(1).optional(),
  questions: z.array(questionSchema).min(1).optional(),
  placements: z.array(z.string().min(1)).optional(),
  priority: z.number().int().optional(),
  selectionWeight: z.number().int().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  schedule: z
    .object({
      startAt: z.coerce.date().optional().nullable(),
      endAt: z.coerce.date().optional().nullable(),
    })
    .optional(),
  targetAudience: targetAudienceSchema.optional(),
});

export const internalSurveyResponsesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  placement: z.string().min(1).optional(),
});

/** Ensures translated questions mirror primary ids/types/option ids (labels may differ). */
export function translationQuestionsMismatchMessage(
  base: SurveyQuestion[],
  tr: SurveyQuestion[],
): string | null {
  if (base.length !== tr.length) {
    return 'Each translation must have the same number of questions as the primary copy.';
  }
  for (let i = 0; i < base.length; i++) {
    const b = base[i];
    const t = tr[i];
    if (b.id !== t.id || b.type !== t.type) {
      return `Translation for question index ${i + 1}: id and type must match the primary copy.`;
    }
    if (b.type === 'rating') {
      if ((b.min ?? 1) !== (t.min ?? 1) || (b.max ?? 5) !== (t.max ?? 5)) {
        return `Translation for "${b.id}": rating min/max must match the primary copy.`;
      }
    }
    if (b.type === 'single_choice') {
      const bo = b.options ?? [];
      const to = t.options ?? [];
      if (bo.length !== to.length) {
        return `Translation for "${b.id}": same number of choices as the primary copy.`;
      }
      for (let j = 0; j < bo.length; j++) {
        if (bo[j].id !== to[j].id) {
          return `Translation for "${b.id}": choice ids must match the primary copy.`;
        }
      }
    }
  }
  return null;
}
