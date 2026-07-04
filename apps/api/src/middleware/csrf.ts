/**
 * apps/api/src/middleware/csrf.ts
 * Double-submit cookie CSRF protection per AUTH_SECURITY_PLAN §5.
 * Decorates the app with `verifyCsrf(req, reply)` for per-route opt-in.
 * Safe methods (GET/HEAD/OPTIONS) bypass automatically.
 */

import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { COOKIES, HEADERS } from "../config/constants.js";
import { CsrfFailedError, ForbiddenError } from "../errors/index.js";
import { env } from "../config/env.js";

declare module "fastify" {
  interface FastifyInstance {
    verifyCsrf: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const plugin: FastifyPluginAsync = async (app) => {
  async function verifyCsrf(req: FastifyRequest, _reply: FastifyReply) {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;

    const cookieCsrf = req.cookies[COOKIES.CSRF];
    const headerCsrf = req.headers[HEADERS.CSRF];

    if (!cookieCsrf || typeof headerCsrf !== "string" || cookieCsrf !== headerCsrf) {
      throw new CsrfFailedError();
    }

    // Origin / Referer check (defence in depth). Compare the PARSED origin for EXACT
    // equality — a prefix match (startsWith) would admit look-alike hosts such as
    // "https://admin.example.com.evil.com" or "http://localhost:30000". F-007/F-010.
    const originHeader = req.headers.origin ?? req.headers.referer;
    if (originHeader && env.ADMIN_ORIGIN) {
      let requestOrigin: string | null = null;
      try {
        requestOrigin = new URL(originHeader).origin;
      } catch {
        requestOrigin = null;
      }
      if (requestOrigin !== new URL(env.ADMIN_ORIGIN).origin) {
        throw new ForbiddenError("Request origin not allowed", "ORIGIN_MISMATCH");
      }
    }
  }

  app.decorate("verifyCsrf", verifyCsrf);
};

export const csrfPlugin = fp(plugin, { name: "csrf", dependencies: ["@fastify/cookie"] });
