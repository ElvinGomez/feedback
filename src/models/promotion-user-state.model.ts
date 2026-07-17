import mongoose from 'mongoose';

const promotionUserStateSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    promotionId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Promotion' },
    impressionCount: { type: Number, default: 0 },
    interactionCount: { type: Number, default: 0 },
    lastShownAt: { type: Date },
    lastImpressionAt: { type: Date },
    lastSessionId: { type: String },
    sessionShownAt: { type: Date },
  },
  { timestamps: true },
);

promotionUserStateSchema.index({ userId: 1, promotionId: 1 }, { unique: true });

export type PromotionUserStateDoc = mongoose.InferSchemaType<
  typeof promotionUserStateSchema
> & {
  _id: mongoose.Types.ObjectId;
};

export const PromotionUserState =
  mongoose.models.PromotionUserState ||
  mongoose.model('PromotionUserState', promotionUserStateSchema);
