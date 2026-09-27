import express from 'express';
import {
  getCampaignContent,
  getPromotionContent,
  postCampaignEvent,
  refreshCampaignContent,
} from '../controllers/campaign-delivery.controller';
import { validate } from '../middleware/validation.middleware';
import {
  campaignContentQuerySchema,
  campaignEventBodySchema,
  campaignPromotionParamsSchema,
  campaignPromotionQuerySchema,
  campaignRefreshBodySchema,
} from '../validation/campaign.validation';

const router = express.Router();

router.get(
  '/content',
  validate(campaignContentQuerySchema, 'query'),
  getCampaignContent,
);

router.get(
  '/promotions/:id',
  validate(campaignPromotionParamsSchema, 'params'),
  validate(campaignPromotionQuerySchema, 'query'),
  getPromotionContent,
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
