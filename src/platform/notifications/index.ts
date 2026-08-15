/**
 * Notification platform skeleton (Phase 0).
 * Device registration, delivery, templates, and APNs/FCM land in Phase 2.
 * Consumers of `notification.requested` should live here — never in AnalyticsEvent.
 */
export {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_DELIVERY_STATUSES,
} from './constants';
export { handleNotificationRequested } from './requested.consumer';
