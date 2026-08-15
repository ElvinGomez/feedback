import mongoose, { Schema } from 'mongoose';
import {
  PUSH_DEVICE_STATUSES,
  type PushDeviceStatus,
} from '../platform/notifications/constants';

export interface IPushDevice {
  userId: string;
  platform: 'ios' | 'android';
  token: string;
  appVersion: string | null;
  locale: string | null;
  timezone: string | null;
  lastSeen: Date | null;
  status: PushDeviceStatus;
}

const PushDeviceSchema = new Schema<IPushDevice>(
  {
    userId: { type: String, required: true, index: true },
    platform: { type: String, enum: ['ios', 'android'], required: true },
    token: { type: String, required: true },
    appVersion: { type: String, default: null },
    locale: { type: String, default: null },
    timezone: { type: String, default: null },
    lastSeen: { type: Date, default: null },
    status: {
      type: String,
      enum: PUSH_DEVICE_STATUSES,
      default: 'active',
      index: true,
    },
  },
  { timestamps: true },
);

PushDeviceSchema.index({ token: 1 }, { unique: true });

export const PushDevice =
  mongoose.models.PushDevice ||
  mongoose.model('PushDevice', PushDeviceSchema);
