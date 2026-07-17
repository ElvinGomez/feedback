import express from 'express';
import {
  getCampaignContent,
  postCampaignEvent,
  refreshCampaignContent,
} from '../controllers/campaign-delivery.controller';
import { validate } from '../middleware/validation.middleware';
import {
  campaignContentQuerySchema,
  campaignEventBodySchema,
  campaignRefreshBodySchema,
} from '../validation/campaign.validation';

const router = express.Router();

router.get(
  '/content',
  validate(campaignContentQuerySchema, 'query'),
  getCampaignContent,
);

router.post(
  '/events',
  validate(campaignEventBodySchema),
  postCampaignEvent,
);

router.post(
  '/refresh',
  validate(campaignRefreshBodySchema),
  refreshCampaignContent,
);

export default router;
