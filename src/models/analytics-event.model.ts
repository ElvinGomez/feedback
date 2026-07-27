import mongoose from 'mongoose';
import {
  ANALYTICS_EVENT_NAMES,
  ANALYTICS_PLATFORMS,
  ANALYTICS_TTL_SECONDS,
} from '../constants/analytics.constants';

const analyticsEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true },
    idempotencyKey: { type: String, required: true, unique: true },
    eventName: { type: String, enum: ANALYTICS_EVENT_NAMES, required: true },
    userId: { type: String, index: true },
    sessionId: { type: String },
    appVersion: { type: String },
    platform: { type: String, enum: ANALYTICS_PLATFORMS },
    properties: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

analyticsEventSchema.index({ eventName: 1, createdAt: -1 });
analyticsEventSchema.index({ userId: 1, createdAt: -1 });
analyticsEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: ANALYTICS_TTL_SECONDS });

export type AnalyticsEventDoc = mongoose.InferSchemaType<typeof analyticsEventSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AnalyticsEvent =
  mongoose.models.AnalyticsEvent ||
  mongoose.model('AnalyticsEvent', analyticsEventSchema);
