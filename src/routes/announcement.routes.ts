import express from 'express';
import {
  getActiveAnnouncements,
  postAnnouncementEvent,
} from '../controllers/announcement.controller';
import { validate } from '../middleware/validation.middleware';
import {
  announcementActiveQuerySchema,
  announcementEventBodySchema,
} from '../validation/announcement.validation';
import { objectIdParamSchema } from '../validation/campaign.validation';

const router = express.Router();

router.get(
  '/active',
  validate(announcementActiveQuerySchema, 'query'),
  getActiveAnnouncements,
);

router.post(
  '/:id/events',
  validate(objectIdParamSchema, 'params'),
  validate(announcementEventBodySchema),
  postAnnouncementEvent,
);

export default router;
