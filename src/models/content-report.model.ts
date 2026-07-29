import mongoose, { Schema, Document } from 'mongoose';

export type ReportTargetType =
  | 'spot'
  | 'spot_image'
  | 'story'
  | 'post'
  | 'user'
  | 'review';
export type ReportStatus = 'pending' | 'reviewed' | 'dismissed';

export interface IReportLatLng {
  latitude: number;
  longitude: number;
}

/** Spot pin correction for `wrong_location` reports. */
export interface IReportLocationCorrection {
  current: IReportLatLng;
  suggested: IReportLatLng;
}

export interface IContentReport extends Document {
  targetType: ReportTargetType;
  targetId: string;
  reporterUserId: string;
  reason: string;
  comment: string;
  status: ReportStatus;
  adminNotes?: string;
  locationCorrection?: IReportLocationCorrection;
  createdAt: Date;
  updatedAt: Date;
}

const latLngSchema = new Schema<IReportLatLng>(
  {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
  },
  { _id: false },
);

const locationCorrectionSchema = new Schema<IReportLocationCorrection>(
  {
    current: { type: latLngSchema, required: true },
    suggested: { type: latLngSchema, required: true },
  },
  { _id: false },
);

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
    comment: { type: String, maxlength: 200, default: '' },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'reviewed', 'dismissed'],
      default: 'pending',
      index: true,
    },
    adminNotes: { type: String, maxlength: 5000 },
    locationCorrection: { type: locationCorrectionSchema, required: false },
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
