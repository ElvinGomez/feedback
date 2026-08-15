import mongoose, { Schema } from 'mongoose';
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from '../platform/notifications/constants';

export interface INotificationPreference {
  userId: string;
  category: NotificationCategory;
  inApp: boolean;
  push: boolean;
}

const NotificationPreferenceSchema = new Schema<INotificationPreference>(
  {
    userId: { type: String, required: true },
    category: { type: String, enum: NOTIFICATION_CATEGORIES, required: true },
    inApp: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
  },
  { timestamps: true },
);

NotificationPreferenceSchema.index({ userId: 1, category: 1 }, { unique: true });

export const NotificationPreference =
  mongoose.models.NotificationPreference ||
  mongoose.model('NotificationPreference', NotificationPreferenceSchema);
