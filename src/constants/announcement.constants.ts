export const ANNOUNCEMENT_STATUSES = [
  'draft',
  'scheduled',
  'active',
  'paused',
  'expired',
  'archived',
] as const;
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

export const ANNOUNCEMENT_DISPLAY_STYLES = ['banner', 'modal'] as const;
export type AnnouncementDisplayStyle = (typeof ANNOUNCEMENT_DISPLAY_STYLES)[number];

export const ANNOUNCEMENT_MEDIA_TYPES = ['text', 'html'] as const;
export type AnnouncementMediaType = (typeof ANNOUNCEMENT_MEDIA_TYPES)[number];

/** html content is only allowed on the modal display style. */
export const ANNOUNCEMENT_MEDIA_TYPES_BY_DISPLAY_STYLE: Record<
  AnnouncementDisplayStyle,
  readonly AnnouncementMediaType[]
> = {
  banner: ['text'],
  modal: ['text', 'html'],
};

export const ANNOUNCEMENT_FREQUENCY_RULES = [
  'once_ever',
  'once_per_session',
  'repeat_until_end_date',
] as const;
export type AnnouncementFrequencyRule = (typeof ANNOUNCEMENT_FREQUENCY_RULES)[number];

export const ANNOUNCEMENT_EVENT_TYPES = [
  'announcement_seen',
  'announcement_dismissed',
  'announcement_primary_cta_clicked',
  'announcement_secondary_cta_clicked',
] as const;
export type AnnouncementEventType = (typeof ANNOUNCEMENT_EVENT_TYPES)[number];
