export const NOTIFICATION_CATEGORIES = [
  'CREATOR',
  'COLLECTION',
  'REWARD',
  'TRIP',
  'PROMOTION',
  'SYSTEM',
  'SAFETY',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_CHANNELS = ['IN_APP', 'PUSH'] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_DELIVERY_STATUSES = [
  'PENDING',
  'SENT',
  'DELIVERED',
  'FAILED',
  'SUPPRESSED',
] as const;

export type NotificationDeliveryStatus =
  (typeof NOTIFICATION_DELIVERY_STATUSES)[number];

export const PUSH_DEVICE_STATUSES = [
  'active',
  'invalid',
  'unregistered',
] as const;

export type PushDeviceStatus = (typeof PUSH_DEVICE_STATUSES)[number];
