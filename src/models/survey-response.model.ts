import mongoose from 'mongoose';

const surveyResponseSchema = new mongoose.Schema(
  {
    surveyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Survey',
      required: true,
      index: true,
    },
    userId: { type: String, required: true, index: true },
    placement: { type: String, required: true },
    answers: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

surveyResponseSchema.index({ surveyId: 1, userId: 1 }, { unique: true });

export const SurveyResponse =
  mongoose.models.SurveyResponse ||
  mongoose.model('SurveyResponse', surveyResponseSchema);
