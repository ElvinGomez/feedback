import mongoose, { Schema, Document } from 'mongoose';

export type ReportTargetType =
  | 'spot'
  | 'spot_image'
  | 'story'
  | 'post'
  | 'user'
  | 'review';
export type ReportStatus = 'pending' | 'reviewed' | 'dismissed';

export interface IContentReport extends Document {
  targetType: ReportTargetType;
  targetId: string;
  reporterUserId: string;
  reason: string;
  comment: string;
  status: ReportStatus;
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const contentReportSchema = new Schema<IContentReport>(
  {
    targetType: {
      type: String,
      required: true,
      enum: ['spot', 'spot_image', 'story', 'post', 'user', 'review'],
      index: true,
    },
    targetId: { type: String, required: true, index: true },
    reporterUserId: { type: String, required: true, index: true },
    reason: { type: String, required: true, index: true, maxlength: 64 },
    comment: { type: String, required: true, maxlength: 2000, default: '' },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'reviewed', 'dismissed'],
      default: 'pending',
      index: true,
    },
    adminNotes: { type: String, maxlength: 5000 },
  },
  { timestamps: true },
);

contentReportSchema.index(
  { reporterUserId: 1, targetType: 1, targetId: 1 },
  { unique: true },
);

export const ContentReport = mongoose.model<IContentReport>(
  'ContentReport',
  contentReportSchema,
);
