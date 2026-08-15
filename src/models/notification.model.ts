import mongoose, { Schema } from 'mongoose';
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from '../platform/notifications/constants';

export interface INotification {
  userId: string;
  category: NotificationCategory;
  templateId: string | null;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  deepLink: string | null;
  readAt: Date | null;
  expiresAt: Date | null;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: String, required: true, index: true },
    category: { type: String, enum: NOTIFICATION_CATEGORIES, required: true },
    templateId: { type: String, default: null },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: Schema.Types.Mixed, default: null },
    deepLink: { type: String, default: null },
    readAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

NotificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification =
  mongoose.models.Notification ||
  mongoose.model('Notification', NotificationSchema);
