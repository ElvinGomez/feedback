import { BaseError } from './error.base';

const ERROR_CODE = {
  INVALID_REQUEST: {
    code: 830,
    status: 400,
    name: 'INVALID_REQUEST',
    message: 'Please make a valid request.',
  },
};

type ProfileErrors = 'INVALID_REQUEST';

export class RequestError extends BaseError {
  constructor(name: ProfileErrors = 'INVALID_REQUEST', detail?: unknown) {
    super();
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RequestError);
    }

    const errorKey = name in ERROR_CODE ? name : 'INVALID_REQUEST';

    this.code = ERROR_CODE[errorKey as keyof typeof ERROR_CODE].code;
    this.status = ERROR_CODE[errorKey as keyof typeof ERROR_CODE].status;
    this.name = ERROR_CODE[errorKey as keyof typeof ERROR_CODE].name;
    this.message = ERROR_CODE[errorKey as keyof typeof ERROR_CODE].message;
    this.detail = detail;
    Object.setPrototypeOf(this, RequestError.prototype);
  }
}
