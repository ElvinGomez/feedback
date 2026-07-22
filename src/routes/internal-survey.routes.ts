import express from 'express';
import {
  internalCreateSurvey,
  internalExportSurveyResponses,
  internalGetSurvey,
  internalListSurveyResponses,
  internalListSurveys,
  internalPatchSurvey,
  internalSurveyResponseStats,
} from '../controllers/survey.controller';
import { validate } from '../middleware/validation.middleware';
import {
  internalCreateSurveyBodySchema,
  internalPatchSurveyBodySchema,
  internalSurveyListQuerySchema,
  internalSurveyResponsesExportQuerySchema,
  internalSurveyResponsesQuerySchema,
} from '../validation/survey.validation';
import { z } from 'zod';

const idParamSchema = z.object({
  id: z.string().refine((id) => /^[a-f0-9]{24}$/i.test(id), {
    message: 'Invalid id',
  }),
});

const router = express.Router();

router.get(
  '/',
  validate(internalSurveyListQuerySchema, 'query'),
  internalListSurveys,
);

router.post('/', validate(internalCreateSurveyBodySchema), internalCreateSurvey);

router.get(
  '/:id',
  validate(idParamSchema, 'params'),
  internalGetSurvey,
);

router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(internalPatchSurveyBodySchema),
  internalPatchSurvey,
);

router.get(
  '/:id/responses/stats',
  validate(idParamSchema, 'params'),
  internalSurveyResponseStats,
);

router.get(
  '/:id/responses/export',
  validate(idParamSchema, 'params'),
  validate(internalSurveyResponsesExportQuerySchema, 'query'),
  internalExportSurveyResponses,
);

router.get(
  '/:id/responses',
  validate(idParamSchema, 'params'),
  validate(internalSurveyResponsesQuerySchema, 'query'),
  internalListSurveyResponses,
);

export default router;
