/**
 * apps/api/src/middleware/locale.ts
 * Decorates `req.locale` for the i18n overlay (ADR-0029). Resolution order:
 *   1. `x-locale` request header (explicit, set by the web proxy when known)
 *   2. `NEXT_LOCALE` cookie (forwarded same-origin through the /api proxy)
 *   3. default 'it' (the canonical in-row language)
 * Closed set {'it','en'} — anything else falls back to 'it'. Non-enforcing:
 * runs for public and authenticated routes alike, before route handlers.
 */

import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

export type Locale = "it" | "en";
const SUPPORTED: readonly Locale[] = ["it", "en"] as const;
export const DEFAULT_LOCALE: Locale = "it";

/** Normalize an arbitrary string (header/cookie value) to a supported locale. */
export function normalizeLocale(raw: string | undefined | null): Locale {
  if (!raw) return DEFAULT_LOCALE;
  // tolerate region tags ("en-US") and casing
  const base = raw.trim().toLowerCase().split("-")[0];
  return SUPPORTED.includes(base as Locale) ? (base as Locale) : DEFAULT_LOCALE;
}

declare module "fastify" {
  interface FastifyRequest {
    locale: Locale;
  }
}

const plugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest("locale", DEFAULT_LOCALE);
  app.addHook("onRequest", async (req) => {
    const header = req.headers["x-locale"];
    const headerVal = Array.isArray(header) ? header[0] : header;
    const cookieVal = req.cookies?.["NEXT_LOCALE"];
    req.locale = normalizeLocale(headerVal ?? cookieVal ?? null);
  });
};

// Depends on @fastify/cookie (registered at chain step 5) to read NEXT_LOCALE.
export const localePlugin = fp(plugin, { name: "locale", dependencies: ["@fastify/cookie"] });
