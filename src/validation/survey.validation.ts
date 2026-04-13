import mongoose from 'mongoose';
import { z } from 'zod';

export const surveySubmitParamsSchema = z.object({
  surveyId: z.string().refine((id) => mongoose.Types.ObjectId.isValid(id), {
    message: 'Invalid survey id',
  }),
});

export const activeSurveyQuerySchema = z.object({
  placement: z.string().min(1),
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

export const internalCreateSurveyBodySchema = z.object({
  title: z.string().min(1),
  questions: z.array(questionSchema).min(1),
  placements: z.array(z.string().min(1)).default([]),
  priority: z.number().int().default(0),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  schedule: z
    .object({
      startAt: z.coerce.date().optional(),
      endAt: z.coerce.date().optional(),
    })
    .optional(),
});

export const internalPatchSurveyBodySchema = z.object({
  title: z.string().min(1).optional(),
  questions: z.array(questionSchema).min(1).optional(),
  placements: z.array(z.string().min(1)).optional(),
  priority: z.number().int().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  schedule: z
    .object({
      startAt: z.coerce.date().optional().nullable(),
      endAt: z.coerce.date().optional().nullable(),
    })
    .optional(),
});

export const internalSurveyResponsesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
