/**
 * apps/web/src/lib/api/errors.ts
 * Typed error classes that mirror apps/api/src/errors/index.ts so the UI can
 * branch on error.code without parsing strings.
 */

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.error.code;
    if (body.error.requestId !== undefined) this.requestId = body.error.requestId;
    if (body.error.details !== undefined) this.details = body.error.details;
  }
}

export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired");
    this.name = "SessionExpiredError";
  }
}

export class NetworkError extends Error {
  override readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "NetworkError";
    if (cause !== undefined) this.cause = cause;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}
