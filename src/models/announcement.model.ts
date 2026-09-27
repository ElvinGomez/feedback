import mongoose from 'mongoose';
import { ACTION_TYPES } from '../constants/campaign.constants';
import {
  ANNOUNCEMENT_DISPLAY_STYLES,
  ANNOUNCEMENT_FREQUENCY_RULES,
  ANNOUNCEMENT_MEDIA_TYPES,
  ANNOUNCEMENT_MODAL_SIZES,
  ANNOUNCEMENT_STATUSES,
} from '../constants/announcement.constants';

const actionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    type: { type: String, enum: ACTION_TYPES, required: true },
    value: { type: String, default: '' },
  },
  { _id: false },
);

const announcementSchema = new mongoose.Schema(
  {
    internalName: { type: String, required: true },
    internalDescription: { type: String, default: '' },
    status: {
      type: String,
      enum: ANNOUNCEMENT_STATUSES,
      default: 'draft',
    },
    displayStyle: {
      type: String,
      enum: ANNOUNCEMENT_DISPLAY_STYLES,
      default: 'banner',
    },
    /** Only used when displayStyle is `modal`. Defaults to medium (bottom sheet). */
    modalSize: {
      type: String,
      enum: ANNOUNCEMENT_MODAL_SIZES,
      default: 'medium',
    },
    priority: { type: Number, default: 0 },
    defaultLocale: { type: String, required: true, default: 'en' },
    translations: { type: mongoose.Schema.Types.Mixed, default: undefined },
    title: { type: String, required: true },
    message: { type: String, default: '' },
    mediaType: { type: String, enum: ANNOUNCEMENT_MEDIA_TYPES, default: 'text' },
    /** Remote image/video URL when mediaType is `image` or `video`. */
    mediaUrl: { type: String, default: '' },
    /** Full-screen modal background color (hex/CSS). Only for modal + full_screen. */
    background: { type: String, default: '' },
    /** Raw HTML rendered in a WebView; used when mediaType is `html`. */
    htmlContent: { type: String, default: '' },
    icon: { type: String, default: '' },
    primaryAction: { type: actionSchema, default: undefined },
    secondaryAction: { type: actionSchema, default: undefined },
    dismissible: { type: Boolean, default: true },
    schedule: {
      startAt: { type: Date },
      endAt: { type: Date },
      timezone: { type: String, default: 'UTC' },
    },
    frequencyRule: {
      type: String,
      enum: ANNOUNCEMENT_FREQUENCY_RULES,
      default: 'once_ever',
    },
    platforms: { type: [String], default: undefined },
    minAppVersion: { type: String, default: '' },
    maxAppVersion: { type: String, default: '' },
    targetAudience: { type: mongoose.Schema.Types.Mixed, default: { allowAll: true } },
    /** Companion push notification: skip, create a draft campaign, or both. */
    notifyChannel: {
      type: String,
      enum: ['in_app', 'push', 'both'],
      default: 'in_app',
    },
    stats: {
      seenTotal: { type: Number, default: 0 },
      uniqueUsersSeen: { type: Number, default: 0 },
      dismissedTotal: { type: Number, default: 0 },
      primaryCtaClicks: { type: Number, default: 0 },
      secondaryCtaClicks: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

announcementSchema.index({ status: 1, 'schedule.startAt': 1, 'schedule.endAt': 1 });
announcementSchema.index({ status: 1, priority: -1 });

export type AnnouncementDoc = mongoose.InferSchemaType<typeof announcementSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Announcement =
  mongoose.models.Announcement || mongoose.model('Announcement', announcementSchema);
