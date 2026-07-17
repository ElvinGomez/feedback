import mongoose from 'mongoose';

export type SurveyQuestionType =
  | 'nps'
  | 'rating'
  | 'single_choice'
  | 'open_text';

export type SurveyQuestion = {
  id: string;
  type: SurveyQuestionType;
  label: string;
  options?: { id: string; label: string }[];
  min?: number;
  max?: number;
};

const surveySchema = new mongoose.Schema(
  {
    /** Language of `title` / `questions` (e.g. `en`, `es_PA`). */
    defaultLocale: { type: String, required: true, default: 'en' },
    /** Other locales: same question ids/types as `questions`; labels differ. */
    translations: { type: mongoose.Schema.Types.Mixed, default: undefined },
    title: { type: String, required: true },
    questions: { type: [mongoose.Schema.Types.Mixed], required: true },
    placements: { type: [String], required: true, default: [] },
    priority: { type: Number, default: 0 },
    /** Used by campaign-delivery weighted rotation; falls back to priority when unset. */
    selectionWeight: { type: Number, default: undefined },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
    },
    schedule: {
      startAt: { type: Date },
      endAt: { type: Date },
    },
    /** Delivery audience rules; default allowAll skips filters. */
    targetAudience: {
      type: mongoose.Schema.Types.Mixed,
      default: { allowAll: true },
    },
  },
  { timestamps: true },
);

surveySchema.index({ status: 1, priority: -1, updatedAt: -1 });

export type SurveyDoc = mongoose.InferSchemaType<typeof surveySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Survey =
  mongoose.models.Survey || mongoose.model('Survey', surveySchema);
