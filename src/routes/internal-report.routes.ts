import express from 'express';
import {
  internalListReports,
  internalPatchReport,
} from '../controllers/content-report.controller';
import { validate } from '../middleware/validation.middleware';
import {
  internalListQuerySchema,
  internalPatchBodySchema,
} from '../validation/report.validation';

const router = express.Router();

router.get(
  '/',
  validate(internalListQuerySchema, 'query'),
  internalListReports,
);

router.patch(
  '/:id',
  validate(internalPatchBodySchema),
  internalPatchReport,
);

export default router;
