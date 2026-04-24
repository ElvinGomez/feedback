import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { initDependencies } from './bootstrap';
import './models/content-report.model';
import './models/survey.model';
import './models/survey-response.model';
import reportRoutes from './routes/report.routes';
import surveyRoutes from './routes/survey.routes';
import internalReportRoutes from './routes/internal-report.routes';
import internalSurveyRoutes from './routes/internal-survey.routes';
import healthRoutes from './routes/health.routes';
import errorMiddleware from './middleware/error.middleware';
import { reportsFeatureFlagsMiddleware } from './middleware/reports-feature-flags.middleware';
import {
  requireLogto,
  attachLogtoUserToLegacyRequest,
  requireReportPermission,
} from './middleware/logto-auth.middleware';
import { requireInternalApiKey } from './middleware/internal-auth.middleware';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/feedback/health', healthRoutes);

const requireDependencies = async (
  _req: express.Request,
  _res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    await initDependencies();
    next();
  } catch (err) {
    next(err);
  }
};

app.use(requireDependencies);

function buildPublicFeedbackStack(): express.Router {
  const stack = express.Router();
  stack.use(reportsFeatureFlagsMiddleware);
  stack.use(requireLogto);
  stack.use(attachLogtoUserToLegacyRequest);
  stack.use(requireReportPermission);
  return stack;
}

const publicReportStack = buildPublicFeedbackStack();
publicReportStack.use('/', reportRoutes);
app.use('/feedback/reports', publicReportStack);

const publicSurveyStack = buildPublicFeedbackStack();
publicSurveyStack.use('/', surveyRoutes);
app.use('/feedback/survey', publicSurveyStack);

const internalReportStack = express.Router();
internalReportStack.use(requireInternalApiKey);
internalReportStack.use('/', internalReportRoutes);
app.use('/feedback/internal/reports', internalReportStack);

const internalSurveyStack = express.Router();
internalSurveyStack.use(requireInternalApiKey);
internalSurveyStack.use('/', internalSurveyRoutes);
app.use('/feedback/internal/survey', internalSurveyStack);

app.use(errorMiddleware);

export default app;
