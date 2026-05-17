/**
 * apps/api/src/errors/index.ts
 * Typed error classes mapped to HTTP envelopes by the central errorHandler.
 * Per API_IMPLEMENTATION_PLAN §8.
 */

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized", code = "UNAUTHORIZED") {
    super(code, message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Forbidden", code = "FORBIDDEN") {
    super(code, message);
  }
}

export class ValidationError extends ApiError {
  constructor(public details: unknown, message = "Validation failed") {
    super("VALIDATION_ERROR", message);
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super("NOT_FOUND", `${resource} not found`);
  }
}

export class ConflictError extends ApiError {
  constructor(message: string, code = "CONFLICT") {
    super(code, message);
  }
}

export class TenantBoundaryViolation extends ApiError {
  constructor(public attemptedTenant: string, public actualTenant: string) {
    super("TENANT_BOUNDARY_VIOLATION", "Tenant boundary violation");
  }
}

export class RefreshReplayDetected extends ApiError {
  constructor() {
    super("REFRESH_REPLAY_DETECTED", "Refresh token replay detected");
  }
}

export class CsrfFailedError extends ApiError {
  constructor(message = "CSRF token missing or mismatched") {
    super("CSRF_FAIL", message);
  }
}

export class TooManyRequestsError extends ApiError {
  constructor(message = "Too many requests", code = "TOO_MANY_REQUESTS", public retryAfterSeconds?: number) {
    super(code, message);
  }
}
