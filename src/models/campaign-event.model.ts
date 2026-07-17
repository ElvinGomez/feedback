import mongoose from 'mongoose';
import { CAMPAIGN_CONTENT_TYPES, CAMPAIGN_EVENT_TYPES } from '../constants/campaign.constants';

const campaignEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true },
    idempotencyKey: { type: String, required: true, unique: true },
    eventType: { type: String, enum: CAMPAIGN_EVENT_TYPES, required: true },
    selectionToken: { type: String, index: true },
    userId: { type: String, index: true },
    anonymousId: { type: String },
    sessionId: { type: String },
    placement: { type: String, required: true },
    contentType: { type: String, enum: CAMPAIGN_CONTENT_TYPES },
    contentId: { type: String, index: true },
    modalSize: { type: String },
    appVersion: { type: String },
    platform: { type: String },
    destinationType: { type: String },
    destinationValue: { type: String },
    interactionType: { type: String },
    selectionAudit: { type: mongoose.Schema.Types.Mixed },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

campaignEventSchema.index({ contentId: 1, eventType: 1, createdAt: -1 });
campaignEventSchema.index({ placement: 1, createdAt: -1 });

export type CampaignEventDoc = mongoose.InferSchemaType<typeof campaignEventSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const CampaignEvent =
  mongoose.models.CampaignEvent || mongoose.model('CampaignEvent', campaignEventSchema);
