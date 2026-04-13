import { BaseError } from './error.base';

const ERROR_CODE = {
  NOT_FOUND: {
    code: 404,
    status: 404,
    name: 'NOT_FOUND',
    reason: 'Page not found',
  },
  INTERNAL_SERVER_ERROR: {
    code: 800,
    status: 500,
    name: 'INTERNAL_SERVER_ERROR',
    reason: 'Something went wrong',
  },
  CLIENT_UNAUTHORIZED: {
    code: 801,
    status: 401,
    name: 'CLIENT_UNAUTHORIZED',
    reason: 'The client is not authorized',
  },
  RATE_LIMIT: {
    code: 802,
    status: 429,
    name: 'RATE_LIMIT',
    reason: 'To many requests',
  },
};

export type ApiErrorKeys =
  | 'NOT_FOUND'
  | 'INTERNAL_SERVER_ERROR'
  | 'CLIENT_UNAUTHORIZED'
  | 'RATE_LIMIT';

export class ApiError extends BaseError {
  constructor(name: ApiErrorKeys = 'INTERNAL_SERVER_ERROR') {
    super();
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }

    const errorKey = name in ERROR_CODE ? name : 'INTERNAL_SERVER_ERROR';

    this.code = ERROR_CODE[errorKey as keyof typeof ERROR_CODE].code;
    this.status = ERROR_CODE[errorKey as keyof typeof ERROR_CODE].status;
    this.name = ERROR_CODE[errorKey as keyof typeof ERROR_CODE].name;
    this.message = ERROR_CODE[errorKey as keyof typeof ERROR_CODE].reason;

    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
