import mongoose from 'mongoose';
import { CAMPAIGN_CONTENT_TYPES } from '../constants/campaign.constants';

const campaignPlacementConfigSchema = new mongoose.Schema(
  {
    placement: { type: String, required: true, unique: true },
    surveyContentTypeWeight: { type: Number, default: 50, min: 0 },
    promotionContentTypeWeight: { type: Number, default: 50, min: 0 },
    enabledContentTypes: {
      type: [String],
      enum: CAMPAIGN_CONTENT_TYPES,
      default: ['survey', 'promotion'],
    },
    promotionsEnabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type CampaignPlacementConfigDoc = mongoose.InferSchemaType<
  typeof campaignPlacementConfigSchema
> & {
  _id: mongoose.Types.ObjectId;
};

export const CampaignPlacementConfig =
  mongoose.models.CampaignPlacementConfig ||
  mongoose.model('CampaignPlacementConfig', campaignPlacementConfigSchema);

export async function getOrCreatePlacementConfig(placement: string) {
  const existing = await CampaignPlacementConfig.findOne({ placement }).exec();
  if (existing) {
    return existing;
  }
  return CampaignPlacementConfig.create({
    placement,
    surveyContentTypeWeight: 50,
    promotionContentTypeWeight: 50,
    enabledContentTypes: ['survey', 'promotion'],
    promotionsEnabled: placement === 'home',
  });
}
