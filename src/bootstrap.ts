import mongoose from 'mongoose';
import env from './config/env';
import { initLogtoAuthFromConfig } from './middleware/logto-auth.middleware';

let initPromise: Promise<void> | null = null;

export function initDependencies(): Promise<void> {
  if (!initPromise) {
    initPromise = runInit().catch((err: unknown) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

async function runInit(): Promise<void> {
  await mongoose.connect(env.mongodbUri);
  await initLogtoAuthFromConfig();
}
