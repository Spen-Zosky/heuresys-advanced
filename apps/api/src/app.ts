/**
 * apps/api/src/app.ts
 * Builds the Fastify app with the canonical plugin order per
 * API_IMPLEMENTATION_PLAN §3.2 + §14.
 *
 * Exported as a function so tests (supertest) can build an isolated app
 * without binding to a network port.
 */

import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import {
  ZodTypeProvider,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestIdPlugin } from "./middleware/requestId.js";
import { authPlugin } from "./middleware/auth.js";
import { tenantContextPlugin } from "./middleware/tenantContext.js";
import { csrfPlugin } from "./middleware/csrf.js";
import { isDatabaseReady } from "./db/client.js";
import { COOKIES } from "./config/constants.js";
import { authRoutes } from "./modules/auth/routes.js";
import type { IMailer } from "./modules/auth/mailer.js";

export interface BuildAppOptions {
  /** Custom mailer for the auth module — tests inject InMemoryMailer. */
  authMailer?: IMailer;
}

/**
 * Single source of truth for the pino redact paths used by the API logger.
 * Exported so the redaction test can build a parallel pino instance with
 * the same config and verify it works at runtime.
 */
export const LOG_REDACT_PATHS = [
  "req.headers.cookie",
  "req.headers.authorization",
  "req.body.password",
  "req.body.newPassword",
  "req.body.confirmPassword",
  "res.body.token",
  "res.body.refreshToken",
  "*.password",
  "*.hash",
  "*.secret",
] as const;

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: { paths: [...LOG_REDACT_PATHS], censor: "[REDACTED]" },
    },
    trustProxy: env.TRUST_PROXY,
    bodyLimit: 1024 * 1024, // 1 MB
    disableRequestLogging: false,
  }).withTypeProvider<ZodTypeProvider>();

  // 1. Type-provider compilers (FIRST — subsequent routes use Zod schemas)
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // 2. Request id (so every subsequent log/error/response carries it)
  await app.register(requestIdPlugin);

  // 3. Security headers
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", env.ADMIN_ORIGIN],
      },
    },
  });

  // 4. CORS for the admin SPA (must precede route handlers)
  await app.register(cors, {
    origin: env.ADMIN_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });

  // 5. Cookies (parsed for downstream JWT + CSRF plugins)
  await app.register(cookie, {
    secret: env.COOKIE_SECRET,
    parseOptions: {},
  });

  // 6. JWT
  await app.register(jwt, {
    secret: { private: env.JWT_PRIVATE_KEY, public: env.JWT_PUBLIC_KEY },
    sign: {
      algorithm: "RS256",
      iss: "heuresys-advanced",
      aud: "heuresys-advanced-api",
      expiresIn: "15m",
    },
    verify: {
      allowedIss: "heuresys-advanced",
      allowedAud: "heuresys-advanced-api",
    },
    cookie: { cookieName: COOKIES.ACCESS, signed: false },
  });

  // 7. Rate limit (defaults; per-route overrides applied in auth module)
  await app.register(rateLimit, {
    max: 600,
    timeWindow: "1 minute",
    keyGenerator: (req) => req.user?.userId ?? req.ip,
  });

  // 8. Auth (decorates req.user from JWT cookie when present)
  await app.register(authPlugin);

  // 9. CSRF (decorates app.verifyCsrf for per-route opt-in)
  await app.register(csrfPlugin);

  // 10. Tenant context (depends on req.user from auth plugin)
  await app.register(tenantContextPlugin);

  // 11. Error handler (catches everything that bubbled up)
  app.setErrorHandler(errorHandler);

  // 12. Health endpoints — public, no auth required
  app.get("/healthz", async () => ({ status: "ok" }));

  app.get("/readyz", async () => {
    const dbReady = await isDatabaseReady();
    return {
      status: dbReady ? "ready" : "degraded",
      checks: { database: dbReady ? "ok" : "fail" },
    };
  });

  // 13. Module routes
  await app.register(authRoutes, { prefix: "/v1/auth", mailer: options.authMailer });

  return app;
}
