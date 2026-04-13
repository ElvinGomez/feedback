import type { ReportTargetType } from '../models/content-report.model';

export const REPORT_REASONS_BY_TARGET: Record<
  ReportTargetType,
  readonly string[]
> = {
  spot: [
    'inaccurate_listing',
    'wrong_location',
    'duplicate_listing',
    'spam_promotional',
    'scam_fraud',
    'safety_concern',
    'illegal_activity',
    'intellectual_property',
    'other',
  ],
  spot_image: [
    'nudity_sexual',
    'violence_graphic',
    'harassment_hate',
    'illegal_content',
    'spam_scam',
    'intellectual_property',
    'misleading_edited',
    'privacy',
    'other',
  ],
  story: [
    'nudity_sexual',
    'violence_graphic',
    'harassment',
    'hate_speech',
    'spam',
    'illegal_content',
    'intellectual_property',
    'self_harm',
    'misinformation',
    'other',
  ],
  post: [
    'misleading_information',
    'spam_promotional',
    'harassment',
    'sexual_content',
    'violence_threats',
    'illegal_content',
    'intellectual_property',
    'privacy_violation',
    'other',
  ],
  user: [
    'harassment',
    'hate_speech',
    'impersonation',
    'spam_scams',
    'inappropriate_profile',
    'harmful_behavior',
    'underage_safety',
    'self_harm',
    'other',
  ],
  review: [
    'fake_or_biased',
    'off_topic',
    'harassment',
    'spam',
    'personal_attack',
    'contains_pii',
    'other',
  ],
};

export function isValidReasonForTarget(
  targetType: ReportTargetType,
  reason: string,
): boolean {
  const allowed = REPORT_REASONS_BY_TARGET[targetType];
  return allowed?.includes(reason) ?? false;
}
