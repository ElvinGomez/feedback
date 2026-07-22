import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { ContentReport } from '../models/content-report.model';
import { logger } from '../utils/logger';

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

export async function createReport(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'Unauthorized', code: 'UNAUTHORIZED' });
    return;
  }

  const { targetType, targetId, reason, comment } = req.body as {
    targetType: string;
    targetId: string;
    reason: string;
    comment?: string;
  };

  const commentTrimmed = (comment ?? '').trim();

  try {
    const doc = await ContentReport.create({
      targetType,
      targetId,
      reporterUserId: userId,
      reason,
      comment: commentTrimmed,
      status: 'pending',
    });
    res.status(201).json({
      id: doc.id,
      targetType: doc.targetType,
      targetId: doc.targetId,
      reason: doc.reason,
      status: doc.status,
      createdAt: doc.createdAt,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      res.status(409).json({
        message: 'You have already reported this content',
        code: 'REPORT_DUPLICATE',
      });
      return;
    }
    logger.error('createReport failed', err);
    res.status(500).json({ message: 'Failed to create report', code: 'INTERNAL' });
  }
}

export async function getEligibility(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'Unauthorized', code: 'UNAUTHORIZED' });
    return;
  }

  const { targetType, targetId } = req.query as {
    targetType: string;
    targetId: string;
  };

  const existing = await ContentReport.findOne({
    reporterUserId: userId,
    targetType,
    targetId,
  })
    .select('_id')
    .lean()
    .exec();

  res.status(200).json({ canSubmit: !existing });
}

export async function internalListReports(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const q = req.query as unknown as {
    page: number;
    limit: number;
    status?: string;
    targetType?: string;
    reason?: string;
    from?: Date;
    to?: Date;
  };

  const filter: Record<string, unknown> = {};
  if (q.status) {
    filter.status = q.status;
  }
  if (q.targetType) {
    filter.targetType = q.targetType;
  }
  if (q.reason) {
    filter.reason = q.reason;
  }
  if (q.from || q.to) {
    filter.createdAt = {};
    if (q.from) {
      (filter.createdAt as Record<string, Date>).$gte = q.from;
    }
    if (q.to) {
      (filter.createdAt as Record<string, Date>).$lte = q.to;
    }
  }

  const skip = (q.page - 1) * q.limit;
  const [items, total] = await Promise.all([
    ContentReport.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(q.limit)
      .lean()
      .exec(),
    ContentReport.countDocuments(filter).exec(),
  ]);

  res.status(200).json({
    items: items.map((r) => ({
      id: r._id.toString(),
      targetType: r.targetType,
      targetId: r.targetId,
      reporterUserId: r.reporterUserId,
      reason: r.reason,
      comment: r.comment,
      status: r.status,
      adminNotes: r.adminNotes ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    page: q.page,
    limit: q.limit,
    total,
  });
}

export async function internalPatchReport(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid id', code: 'INVALID_ID' });
    return;
  }

  const body = req.body as { status?: string; adminNotes?: string };
  const update: Record<string, unknown> = {};
  if (body.status !== undefined) {
    update.status = body.status;
  }
  if (body.adminNotes !== undefined) {
    update.adminNotes = body.adminNotes;
  }

  const doc = await ContentReport.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true, runValidators: true },
  ).exec();

  if (!doc) {
    res.status(404).json({ message: 'Report not found', code: 'NOT_FOUND' });
    return;
  }

  res.status(200).json({
    id: doc.id,
    targetType: doc.targetType,
    targetId: doc.targetId,
    reporterUserId: doc.reporterUserId,
    reason: doc.reason,
    comment: doc.comment,
    status: doc.status,
    adminNotes: doc.adminNotes ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}
