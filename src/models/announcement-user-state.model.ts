import mongoose from 'mongoose';

const announcementUserStateSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    announcementId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Announcement',
    },
    seenCount: { type: Number, default: 0 },
    firstSeenAt: { type: Date },
    lastSeenAt: { type: Date },
    lastSeenSessionId: { type: String },
    dismissedAt: { type: Date },
    lastDismissedSessionId: { type: String },
    ctaClickCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

announcementUserStateSchema.index({ userId: 1, announcementId: 1 }, { unique: true });

export type AnnouncementUserStateDoc = mongoose.InferSchemaType<
  typeof announcementUserStateSchema
> & {
  _id: mongoose.Types.ObjectId;
};

export const AnnouncementUserState =
  mongoose.models.AnnouncementUserState ||
  mongoose.model('AnnouncementUserState', announcementUserStateSchema);
