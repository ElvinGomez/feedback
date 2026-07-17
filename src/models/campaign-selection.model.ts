import mongoose from 'mongoose';
import { CAMPAIGN_CONTENT_TYPES, MODAL_SIZES } from '../constants/campaign.constants';

const campaignSelectionSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    sessionId: { type: String },
    placement: { type: String, required: true },
    contentType: { type: String, enum: CAMPAIGN_CONTENT_TYPES, required: true },
    contentId: { type: String, required: true },
    modalSize: { type: String, enum: MODAL_SIZES, default: 'medium' },
    expiresAt: { type: Date, required: true },
    selectionAudit: { type: mongoose.Schema.Types.Mixed, required: true },
    impressionRecorded: { type: Boolean, default: false },
    invalidated: { type: Boolean, default: false },
  },
  { timestamps: true },
);

campaignSelectionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type CampaignSelectionDoc = mongoose.InferSchemaType<
  typeof campaignSelectionSchema
> & {
  _id: mongoose.Types.ObjectId;
};

export const CampaignSelection =
  mongoose.models.CampaignSelection ||
  mongoose.model('CampaignSelection', campaignSelectionSchema);
