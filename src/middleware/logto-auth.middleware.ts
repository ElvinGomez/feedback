import type { Request, RequestHandler } from 'express';
import type { LogtoAuthEnv } from '@tripsi-app/logto-server-auth';
import {
  createLogtoAuth,
  permissionPathForResourceKey,
} from '@tripsi-app/logto-server-auth';
import config from '../config/env';
import type { AuthenticatedRequest } from './auth.middleware';
import { reportRouteToFlagKey } from './reports-feature-flags.middleware';
import { fetchPublicClientConfigForAuth } from '../services/public-client-config.service';

export const logtoAuthEnv: LogtoAuthEnv = {
  LOGTO_ENDPOINT: config.logtoEndpoint,
  ...(config.logtoResource ? { LOGTO_RESOURCE: config.logtoResource } : {}),
};

type LogtoAuthApi = ReturnType<typeof createLogtoAuth>;
let auth: LogtoAuthApi | null = null;

export async function initLogtoAuthFromConfig(): Promise<void> {
  const data = await fetchPublicClientConfigForAuth();
  auth = createLogtoAuth({
    logto: logtoAuthEnv,
    allFeatureFlagPaths: data.featureFlagPaths,
    roles: data.tripsiRoles,
    roleFeaturePaths: data.roleFeaturePaths,
  });
}

function getAuth(): LogtoAuthApi {
  if (!auth) {
    throw new Error(
      'Logto auth not initialized; call initLogtoAuthFromConfig() before accepting traffic',
    );
  }
  return auth;
}

export const requireLogto: RequestHandler = (req, res, next) => {
  return getAuth().requireLogtoAuth()(req, res, next);
};

export const attachLogtoUserToLegacyRequest: RequestHandler = (
  req,
  _res,
  next,
) => {
  if (req.logtoUser) {
    (req as AuthenticatedRequest).user = {
      id: req.logtoUser.id,
      role: req.logtoUser.roles[0] ?? 'user',
    };
  }
  next();
};

export function reportRouteToFeaturePath(req: Request): string | null {
  const key = reportRouteToFlagKey(req.method, req.path);
  if (key === null) {
    return null;
  }
  let perm: string;
  if (key === 'surveys') {
    perm = permissionPathForResourceKey('feedback', 'surveys');
  } else if (key === 'campaignDelivery') {
    perm = 'feedback:campaign_delivery';
  } else if (key === 'promotions') {
    perm = permissionPathForResourceKey('feedback', 'promotions');
  } else {
    perm = permissionPathForResourceKey('feedback', `reports.${key}`);
  }
  return getAuth().isFeatureFlagPath(perm) ? perm : null;
}

export const requireReportPermission: RequestHandler = (req, res, next) => {
  const a = getAuth();
  return a.requireFeaturePathForRoute(reportRouteToFeaturePath, a.logtoEnv)(
    req,
    res,
    next,
  );
};
