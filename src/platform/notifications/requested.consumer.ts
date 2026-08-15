/**
 * Stub consumer for `notification.requested` (Phase 0).
 * Phase 2 will subscribe to `tripsi.events.notifications` and deliver via
 * APNs/FCM. Do not send push from this module yet.
 */
export async function handleNotificationRequested(_event: {
  event_id: string;
  event_type: 'notification.requested';
  entity_id: string;
  payload?: Record<string, unknown>;
}): Promise<{ accepted: true; delivered: false }> {
  return { accepted: true, delivered: false };
}
