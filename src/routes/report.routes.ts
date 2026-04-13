import express from 'express';
import {
  createReport,
  getEligibility,
} from '../controllers/content-report.controller';
import { validate } from '../middleware/validation.middleware';
import {
  createReportBodySchema,
  eligibilityQuerySchema,
} from '../validation/report.validation';

const router = express.Router();

router.get(
  '/eligibility',
  validate(eligibilityQuerySchema, 'query'),
  getEligibility,
);

router.post('/', validate(createReportBodySchema), createReport);

export default router;
