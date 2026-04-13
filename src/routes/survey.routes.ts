import express from 'express';
import {
  getActiveSurvey,
  submitSurveyResponse,
} from '../controllers/survey.controller';
import { validate } from '../middleware/validation.middleware';
import {
  activeSurveyQuerySchema,
  submitSurveyResponseBodySchema,
  surveySubmitParamsSchema,
} from '../validation/survey.validation';

const router = express.Router();

router.get(
  '/active',
  validate(activeSurveyQuerySchema, 'query'),
  getActiveSurvey,
);

router.post(
  '/:surveyId/responses',
  validate(surveySubmitParamsSchema, 'params'),
  validate(submitSurveyResponseBodySchema),
  submitSurveyResponse,
);

export default router;
