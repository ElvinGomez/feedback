import 'dotenv/config';
import app from './app';
import { initDependencies } from './bootstrap';
import env from './config/env';
import { logger } from './utils/logger';

const PORT = env.port;

async function bootstrap(): Promise<void> {
  try {
    await initDependencies();
    logger.info('Connected to MongoDB');
    logger.info('Logto auth initialized from config-service');
  } catch (error) {
    logger.error('Failed to initialize dependencies:', error);
    process.exit(1);
  }

  app.listen(PORT, () => {
    logger.info(`Reports service running on port ${PORT}`);
  });
}

void bootstrap();

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection:', error);
});

export default app;
