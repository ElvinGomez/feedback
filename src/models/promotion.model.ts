import mongoose from 'mongoose';
import {
  ACTION_TYPES,
  FREQUENCY_RULES,
  MEDIA_TYPES,
  MODAL_SIZES,
  PROMOTION_STATUSES,
} from '../constants/campaign.constants';

const actionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    type: { type: String, enum: ACTION_TYPES, required: true },
    value: { type: String, default: '' },
  },
  { _id: false },
);

const promotionSchema = new mongoose.Schema(
  {
    internalName: { type: String, required: true },
    internalDescription: { type: String, default: '' },
    status: {
      type: String,
      enum: PROMOTION_STATUSES,
      default: 'draft',
    },
    placements: { type: [String], required: true, default: ['home'] },
    contentType: { type: String, default: 'promotion' },
    selectionWeight: { type: Number, default: 100, min: 0 },
    defaultLocale: { type: String, required: true, default: 'en' },
    translations: { type: mongoose.Schema.Types.Mixed, default: undefined },
    title: { type: String, required: true },
    message: { type: String, default: '' },
    mediaType: { type: String, enum: MEDIA_TYPES, default: 'none' },
    mediaUrl: { type: String, default: '' },
    /** Raw HTML rendered in a WebView; only used when mediaType is `html` (full_screen). */
    htmlContent: { type: String, default: '' },
    mediaLayout: { type: String, default: 'top' },
    textAlignment: { type: String, default: 'center' },
    background: { type: String, default: '' },
    primaryAction: { type: actionSchema, required: true },
    secondaryAction: { type: actionSchema, default: undefined },
    dismissible: { type: Boolean, default: true },
    modalSize: { type: String, enum: MODAL_SIZES, default: 'medium' },
    schedule: {
      startAt: { type: Date },
      endAt: { type: Date },
      timezone: { type: String, default: 'UTC' },
    },
    frequencyRule: {
      type: String,
      enum: FREQUENCY_RULES,
      default: 'none',
    },
    frequencyHours: { type: Number, min: 1 },
    maxImpressionsPerUser: { type: Number, min: 1 },
    maxTotalImpressions: { type: Number, min: 1 },
    maxInteractions: { type: Number, min: 1 },
    platforms: { type: [String], default: undefined },
    minAppVersion: { type: String, default: '' },
    maxAppVersion: { type: String, default: '' },
    targetAudience: { type: mongoose.Schema.Types.Mixed, default: { allowAll: true } },
    stats: {
      impressions: { type: Number, default: 0 },
      uniqueUsers: { type: Number, default: 0 },
      entryPointTaps: { type: Number, default: 0 },
      primaryCta: { type: Number, default: 0 },
      secondaryCta: { type: Number, default: 0 },
      dismissals: { type: Number, default: 0 },
      videoStarts: { type: Number, default: 0 },
      videoCompletions: { type: Number, default: 0 },
      mediaFailures: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

promotionSchema.index({ status: 1, placements: 1, 'schedule.startAt': 1, 'schedule.endAt': 1 });
promotionSchema.index({ status: 1, selectionWeight: -1 });

export type PromotionDoc = mongoose.InferSchemaType<typeof promotionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Promotion =
  mongoose.models.Promotion || mongoose.model('Promotion', promotionSchema);
