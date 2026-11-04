/**
 * apps/api/src/middleware/errorHandler.ts
 * Centralised error handler. Maps typed ApiError subclasses to uniform
 * envelopes { error: { code, message, requestId, details? } }. Logs unhandled
 * errors at level=error with the requestId for forensics.
 *
 * Per API_IMPLEMENTATION_PLAN §4.2 + §8.
 *
 * S-12 del piano interfacce (2026-11-04). Ogni risposta d'errore porta tre cose:
 *  - `code`, che e' anche la chiave del messaggio: il client lo traduce nella lingua
 *    della persona (apps/web/src/lib/api/errors.ts), e un agente lo legge per capire
 *    se riprovare;
 *  - `message`, testo tecnico in inglese, per i log e per chi integra;
 *  - `requestId`, l'identificativo da citare: senza, un 500 non si ritrova nei log.
 * Una risposta che non rispetta il proprio contratto Zod non e' piu' un anonimo
 * «Unexpected server error»: e' `RESPONSE_CONTRACT_VIOLATION`, con la rotta nel log.
 */

import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { isResponseSerializationError } from "fastify-type-provider-zod";
import { ZodError } from "zod";
import {
  ApiError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  UnprocessableEntityError,
  NotFoundError,
  ConflictError,
  TenantBoundaryViolation,
  RefreshReplayDetected,
  CsrfFailedError,
  TooManyRequestsError,
  InternalError,
} from "../errors/index.js";

export async function errorHandler(
  err: FastifyError | Error,
  req: FastifyRequest,
  rawReply: FastifyReply,
): Promise<void> {
  // Ogni busta d'errore riceve l'identificativo della richiesta, qualunque ramo la scriva.
  const reply = {
    header: (k: string, v: string) => rawReply.header(k, v),
    code: (status: number) => ({
      send: (body: { error: Record<string, unknown> }) =>
        rawReply.code(status).send({ error: { ...body.error, requestId: req.id } }),
    }),
  };

  // S-12: la risposta non rispetta il contratto dichiarato. Colpa del server, non del
  // chiamante; il dettaglio (campo e regola violata) va nel log, non al client.
  if (isResponseSerializationError(err)) {
    req.log.error(
      { method: err.method, url: err.url, issues: err.cause?.issues },
      "RESPONSE_CONTRACT_VIOLATION",
    );
    reply.code(500).send({
      error: {
        code: "RESPONSE_CONTRACT_VIOLATION",
        message: "The response did not match its declared contract",
      },
    });
    return;
  }
  // Zod validation errors from fastify-type-provider-zod
  if (err instanceof ZodError) {
    reply.code(400).send({
      error: { code: "VALIDATION_ERROR", message: "Invalid input", details: err.issues },
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
  if (err instanceof UnprocessableEntityError) {
    reply.code(422).send({
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
  if (err instanceof InternalError) {
    // Guasto del server, non del chiamante: 500 + log a livello error (il
    // `message` interno può nominare variabili d'ambiente, quindi resta nel
    // log). Il CODICE esce nella risposta: senza di esso un guasto di
    // configurazione è indistinguibile da un qualunque errore generico.
    req.log.error({ err, code: err.code }, "Internal fault");
    reply.code(500).send({ error: { code: err.code, message: err.publicMessage } });
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
