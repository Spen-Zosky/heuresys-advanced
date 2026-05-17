/**
 * apps/api/src/middleware/errorHandler.ts
 * Centralised error handler. Maps typed ApiError subclasses to uniform
 * envelopes { error: { code, message, details? } }. Logs unhandled errors
 * at level=error with the requestId for forensics.
 *
 * Per API_IMPLEMENTATION_PLAN §4.2 + §8.
 */

import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import {
  ApiError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
  ConflictError,
  TenantBoundaryViolation,
  RefreshReplayDetected,
  CsrfFailedError,
  TooManyRequestsError,
} from "../errors/index.js";

export async function errorHandler(
  err: FastifyError | Error,
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Zod validation errors from fastify-type-provider-zod
  if (err instanceof ZodError) {
    reply.code(400).send({
      error: { code: "VALIDATION_ERROR", message: "Invalid input", details: err.errors },
    });
    return;
  }

  if (err instanceof CsrfFailedError) {
    reply.code(403).send({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof UnauthorizedError) {
    reply.code(401).send({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof ForbiddenError) {
    reply.code(403).send({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof NotFoundError) {
    reply.code(404).send({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof ConflictError) {
    reply.code(409).send({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof ValidationError) {
    reply.code(400).send({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }
  if (err instanceof TenantBoundaryViolation) {
    req.log.error(
      { userId: req.user?.userId, tenantId: req.tenantId, path: req.url },
      "TENANT_BOUNDARY_VIOLATION",
    );
    // Surface as 404 to prevent boundary enumeration (per AUTH_SECURITY_PLAN).
    reply.code(404).send({ error: { code: "NOT_FOUND", message: "Not found" } });
    return;
  }
  if (err instanceof RefreshReplayDetected) {
    reply.code(401).send({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof TooManyRequestsError) {
    if (err.retryAfterSeconds !== undefined) {
      reply.header("Retry-After", String(err.retryAfterSeconds));
    }
    reply.code(429).send({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof ApiError) {
    // Generic ApiError fallback — default 400 unless the framework set a code.
    const status = (err as FastifyError).statusCode ?? 400;
    reply.code(status).send({ error: { code: err.code, message: err.message } });
    return;
  }

  // Fastify-internal validation errors (set serializerCompiler / validatorCompiler)
  const fastifyErr = err as FastifyError;
  if (fastifyErr.validation) {
    reply.code(400).send({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request payload",
        details: fastifyErr.validation,
      },
    });
    return;
  }
  if (fastifyErr.statusCode && fastifyErr.statusCode < 500) {
    reply.code(fastifyErr.statusCode).send({
      error: { code: fastifyErr.code ?? "BAD_REQUEST", message: fastifyErr.message },
    });
    return;
  }

  // Unexpected — internal error
  req.log.error({ err }, "Unhandled error");
  reply.code(500).send({
    error: { code: "INTERNAL_ERROR", message: "Unexpected server error" },
  });
}
