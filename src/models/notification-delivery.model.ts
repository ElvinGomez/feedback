import mongoose, { Schema } from 'mongoose';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_DELIVERY_STATUSES,
  type NotificationChannel,
  type NotificationDeliveryStatus,
} from '../platform/notifications/constants';

export interface INotificationDelivery {
  notificationId: mongoose.Types.ObjectId;
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  error: string | null;
}

const NotificationDeliverySchema = new Schema<INotificationDelivery>(
  {
    notificationId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    channel: { type: String, enum: NOTIFICATION_CHANNELS, required: true },
    status: {
      type: String,
      enum: NOTIFICATION_DELIVERY_STATUSES,
      default: 'PENDING',
      index: true,
    },
    error: { type: String, default: null },
  },
  { timestamps: true },
);

export const NotificationDelivery =
  mongoose.models.NotificationDelivery ||
  mongoose.model('NotificationDelivery', NotificationDeliverySchema);
