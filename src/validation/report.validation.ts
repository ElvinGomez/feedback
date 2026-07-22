import { z } from 'zod';
import type { ReportTargetType } from '../models/content-report.model';
import { isValidReasonForTarget } from '../constants/report-reasons';

export const reportTargetTypeSchema = z.enum([
  'spot',
  'spot_image',
  'story',
  'post',
  'user',
  'review',
]);

export const createReportBodySchema = z
  .object({
    targetType: reportTargetTypeSchema,
    targetId: z.string().min(1).max(128),
    reason: z.string().min(1).max(64),
    comment: z.string().max(200).optional().default(''),
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
