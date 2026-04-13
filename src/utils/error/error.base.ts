export class BaseError extends Error {
  public status: number;
  public code: number;
  public reason: number;
  public detail?: unknown;

  constructor(message?: string) {
    super(message);
    this.message = message || '';
    this.status = 500;
    this.code = 0;
    this.reason = 0;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BaseError);
    }
    Object.setPrototypeOf(this, BaseError.prototype);
  }
}
