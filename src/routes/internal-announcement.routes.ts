import express from 'express';
import {
  internalCreateAnnouncement,
  internalGetAnnouncement,
  internalListAnnouncements,
  internalPatchAnnouncement,
} from '../controllers/announcement.controller';
import { validate } from '../middleware/validation.middleware';
import {
  internalAnnouncementListQuerySchema,
  internalCreateAnnouncementBodySchema,
  internalPatchAnnouncementBodySchema,
} from '../validation/announcement.validation';
import { objectIdParamSchema } from '../validation/campaign.validation';

const router = express.Router();

router.get(
  '/',
  validate(internalAnnouncementListQuerySchema, 'query'),
  internalListAnnouncements,
);

router.post('/', validate(internalCreateAnnouncementBodySchema), internalCreateAnnouncement);

router.get('/:id', validate(objectIdParamSchema, 'params'), internalGetAnnouncement);

router.patch(
  '/:id',
  validate(objectIdParamSchema, 'params'),
  validate(internalPatchAnnouncementBodySchema),
  internalPatchAnnouncement,
);

export default router;
