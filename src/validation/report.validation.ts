import { z } from 'zod';
import type { ReportTargetType } from '../models/content-report.model';
import { isValidReasonForTarget } from '../constants/report-reasons';

/** ~10m at the equator; keep in sync with mobile ReportContentModal. */
const LOCATION_MOVED_EPSILON = 1e-4;

export const reportTargetTypeSchema = z.enum([
  'spot',
  'spot_image',
  'story',
  'post',
  'user',
  'review',
  'spot_visit',
]);

const reportLatLngSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const locationCorrectionSchema = z.object({
  current: reportLatLngSchema,
  suggested: reportLatLngSchema,
});

function isSameLocation(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): boolean {
  return (
    Math.abs(a.latitude - b.latitude) < LOCATION_MOVED_EPSILON &&
    Math.abs(a.longitude - b.longitude) < LOCATION_MOVED_EPSILON
  );
}

export const createReportBodySchema = z
  .object({
    targetType: reportTargetTypeSchema,
    targetId: z.string().min(1).max(128),
    reason: z.string().min(1).max(64),
    comment: z.string().max(200).optional().default(''),
    locationCorrection: locationCorrectionSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const tt = data.targetType as ReportTargetType;
    if (!isValidReasonForTarget(tt, data.reason)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'INVALID_REASON',
        path: ['reason'],
      });
    }
    if (data.reason === 'other') {
      const c = (data.comment ?? '').trim();
      if (c.length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'COMMENT_REQUIRED_FOR_OTHER',
          path: ['comment'],
        });
      }
    }
    const needsLocationCorrection =
      tt === 'spot' && data.reason === 'wrong_location';
    if (needsLocationCorrection && !data.locationCorrection) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'LOCATION_CORRECTION_REQUIRED',
        path: ['locationCorrection'],
      });
    } else if (
      needsLocationCorrection &&
      data.locationCorrection &&
      isSameLocation(
        data.locationCorrection.current,
        data.locationCorrection.suggested,
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'LOCATION_CORRECTION_MUST_DIFFER',
        path: ['locationCorrection', 'suggested'],
      });
    }
    if (!needsLocationCorrection && data.locationCorrection) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'LOCATION_CORRECTION_NOT_ALLOWED',
        path: ['locationCorrection'],
      });
    }
  });

export const eligibilityQuerySchema = z.object({
  targetType: reportTargetTypeSchema,
  targetId: z.string().min(1).max(128),
});

export const internalListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'reviewed', 'dismissed']).optional(),
  targetType: reportTargetTypeSchema.optional(),
  reason: z.string().min(1).max(64).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const internalPatchBodySchema = z
  .object({
    status: z.enum(['pending', 'reviewed', 'dismissed']).optional(),
    adminNotes: z.string().max(5000).optional(),
  })
  .refine((b) => b.status !== undefined || b.adminNotes !== undefined, {
    message: 'At least one of status, adminNotes is required',
  });
