import express from 'express';
import {
  internalCreatePromotion,
  internalGetPlacementConfig,
  internalGetPromotionReport,
  internalListPromotions,
  internalPatchPlacementConfig,
  internalPatchPromotion,
} from '../controllers/campaign-delivery.controller';
import { validate } from '../middleware/validation.middleware';
import {
  internalCreatePromotionBodySchema,
  internalPatchPromotionBodySchema,
  internalPlacementConfigBodySchema,
  internalPromotionListQuerySchema,
  objectIdParamSchema,
  placementParamSchema,
} from '../validation/campaign.validation';

const router = express.Router();

router.get(
  '/promotions',
  validate(internalPromotionListQuerySchema, 'query'),
  internalListPromotions,
);

router.post(
  '/promotions',
  validate(internalCreatePromotionBodySchema),
  internalCreatePromotion,
);

router.patch(
  '/promotions/:id',
  validate(objectIdParamSchema, 'params'),
  validate(internalPatchPromotionBodySchema),
  internalPatchPromotion,
);

router.get(
  '/promotions/:id/report',
  validate(objectIdParamSchema, 'params'),
  internalGetPromotionReport,
);

router.get(
  '/placements/:placement',
  validate(placementParamSchema, 'params'),
  internalGetPlacementConfig,
);

router.patch(
  '/placements/:placement',
  validate(placementParamSchema, 'params'),
  validate(internalPlacementConfigBodySchema),
  internalPatchPlacementConfig,
);

export default router;
