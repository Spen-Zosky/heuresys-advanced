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

/**
 * L'origine della richiesta e' fra quelle ammesse?
 *
 * Funzione **pura ed esportata** apposta: la decisione di sicurezza sta qui, e qui si
 * puo' provare con elenchi di una, due o tre voci senza dipendere da cosa dichiara il
 * `.env` della macchina che esegue i test. Dentro il preHandler sarebbe provabile solo
 * con l'elenco che l'ambiente ha, cioe' quasi mai quello che serve provare.
 *
 * @param ammesse origini **gia' normalizzate** con `new URL(x).origin`.
 */
export function origineAmmessa(originHeader: string, ammesse: readonly string[]): boolean {
  if (ammesse.length === 0) return true; // nessuna dichiarata = controllo non attivo
  let richiesta: string;
  try {
    richiesta = new URL(originHeader).origin;
  } catch {
    return false; // un'origine che non si sa leggere non e' un'origine ammessa
  }
  // Uguaglianza ESATTA su ogni voce — mai un prefisso: `startsWith` ammetteva
  // "http://localhost:30000" e "https://admin.example.com.evil.com" (F-007/F-010).
  return ammesse.includes(richiesta);
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
    if (originHeader && !origineAmmessa(originHeader, env.ADMIN_ORIGINS)) {
      throw new ForbiddenError("Request origin not allowed", "ORIGIN_MISMATCH");
    }
  }

  app.decorate("verifyCsrf", verifyCsrf);
};

export const csrfPlugin = fp(plugin, { name: "csrf", dependencies: ["@fastify/cookie"] });
