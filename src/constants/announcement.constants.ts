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

/** Modal chrome size — only applies when `displayStyle` is `modal`. */
export const ANNOUNCEMENT_MODAL_SIZES = ['medium', 'full_screen'] as const;
export type AnnouncementModalSize = (typeof ANNOUNCEMENT_MODAL_SIZES)[number];

/**
 * Content kinds for announcements:
 * - text: title + message (optional icon on banners)
 * - image / video: remote media via `mediaUrl`
 * - html: raw HTML rendered in a WebView
 */
export const ANNOUNCEMENT_MEDIA_TYPES = ['text', 'image', 'video', 'html'] as const;
export type AnnouncementMediaType = (typeof ANNOUNCEMENT_MEDIA_TYPES)[number];

/**
 * Allowed media by display style (+ modal size for modals):
 * - banner: text or compact html strip
 * - modal medium: text, optional image, or html sheet
 * - modal full_screen: text, image, video, or html (optional background)
 */
export const ANNOUNCEMENT_MEDIA_TYPES_BY_DISPLAY_STYLE: Record<
  AnnouncementDisplayStyle,
  readonly AnnouncementMediaType[]
> = {
  banner: ['text', 'html'],
  modal: ['text', 'image', 'video', 'html'],
};

export const ANNOUNCEMENT_MEDIA_TYPES_BY_MODAL_SIZE: Record<
  AnnouncementModalSize,
  readonly AnnouncementMediaType[]
> = {
  medium: ['text', 'image', 'html'],
  full_screen: ['text', 'image', 'video', 'html'],
};

export const ANNOUNCEMENT_BACKGROUND_ALLOWED_MODAL_SIZES: readonly AnnouncementModalSize[] = [
  'full_screen',
];

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
