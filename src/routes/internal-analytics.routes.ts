import express from 'express';
import {
  internalAnalyticsSeries,
  internalAnalyticsSummary,
  internalListAnalyticsEvents,
} from '../controllers/analytics.controller';
import { validate } from '../middleware/validation.middleware';
import {
  analyticsEventsListQuerySchema,
  analyticsSeriesQuerySchema,
  analyticsSummaryQuerySchema,
} from '../validation/analytics.validation';

const router = express.Router();

router.get(
  '/summary',
  validate(analyticsSummaryQuerySchema, 'query'),
  internalAnalyticsSummary,
);

router.get(
  '/series',
  validate(analyticsSeriesQuerySchema, 'query'),
  internalAnalyticsSeries,
);

router.get(
  '/events',
  validate(analyticsEventsListQuerySchema, 'query'),
  internalListAnalyticsEvents,
);

export default router;
