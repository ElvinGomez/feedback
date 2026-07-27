import express from 'express';
import { postAnalyticsEvent } from '../controllers/analytics.controller';
import { validate } from '../middleware/validation.middleware';
import { analyticsEventBodySchema } from '../validation/analytics.validation';

const router = express.Router();

router.post('/events', validate(analyticsEventBodySchema), postAnalyticsEvent);

export default router;
