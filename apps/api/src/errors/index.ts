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
  constructor(resource: string, code = "NOT_FOUND") {
    super(code, `${resource} not found`);
  }
}

/**
 * 422 Unprocessable Entity — the payload is syntactically valid (passed Zod) but fails a
 * semantic/business rule (e.g. an answer's value column doesn't match its question type, or
 * references a question outside the survey). Distinct from ValidationError (400, schema-shape).
 */
export class UnprocessableEntityError extends ApiError {
  constructor(public details: unknown, message = "Unprocessable entity", code = "UNPROCESSABLE_ENTITY") {
    super(code, message);
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

/**
 * 500 — guasto interno TIPIZZATO: la richiesta è legittima, è il server (o un
 * dato che custodisce) a non essere in condizione di servirla — chiave di
 * cifratura sbagliata, segreto corrotto, dipendenza mal configurata.
 *
 * Perché esiste (S1033): l'errorHandler declassa a 400 ogni `ApiError` privo di
 * statusCode. Un guasto di configurazione arrivava quindi al chiamante come
 * «Invalid request payload», cioè come colpa sua. Costo misurato: la CI rossa di
 * S1032 (158 file su 218) si presentava come `login <persona>: 400` e la chiave
 * di cifratura divergente sul runner è emersa solo riproducendo il login contro
 * il database della CI.
 *
 * `message` è per il log (può nominare variabili e dettagli interni);
 * `publicMessage` è ciò che esce nella risposta — il codice invece viaggia in
 * chiaro, perché è l'aggancio di chi diagnostica e non rivela nulla.
 */
export class InternalError extends ApiError {
  readonly statusCode = 500;
  constructor(
    code: string,
    message: string,
    public readonly publicMessage = "Unexpected server error",
  ) {
    super(code, message);
  }
}
