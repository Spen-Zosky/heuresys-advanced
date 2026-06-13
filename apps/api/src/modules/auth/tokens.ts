/**
 * apps/api/src/modules/auth/tokens.ts
 * Opaque-token generation, SHA-256 hashing, and cookie helpers for the auth
 * module. Cookies follow AUTH_SECURITY_PLAN §4.3 with one errata (D-26): the
 * refresh cookie path is "/" — NOT the API route prefix "/v1/auth" — because
 * the browser only reaches the API through prefix-stripping proxies (Next
 * rewrite `/api/:path*` → `/:path*` in dev; nginx → next → same rewrite in
 * PROD). A cookie scoped to "/v1/auth" never matches the browser-visible URL
 * `/api/v1/auth/refresh`, so the silent refresh could never fire and every
 * session died at the 15-min access TTL. Compensating controls for the wider
 * scope: HttpOnly + Secure + SameSite=Lax, TLS end-to-end, pino cookie
 * redaction (LOG_REDACT_PATHS), single-use rotation with family-revoking
 * replay detection, and CSRF double-submit on /refresh.
 */

import { randomBytes, createHash } from "node:crypto";
import type { FastifyReply } from "fastify";
import {
  COOKIES,
  ACCESS_JWT_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  CSRF_TOKEN_TTL_SECONDS,
} from "../../config/constants.js";

export const OPAQUE_TOKEN_BYTES = 32;
export const REFRESH_COOKIE_PATH = "/";
/**
 * Pre-D-26 refresh cookies in the wild are scoped to the old "/v1/auth" path;
 * a clear on the new path does not touch them (the browser keys cookies on
 * name+domain+path). Logout clears BOTH paths so no orphan survives a clean
 * sign-out; cookies never cleared simply age out at their 30-day maxAge.
 */
export const LEGACY_REFRESH_COOKIE_PATH = "/v1/auth";

/**
 * Generates a 32-byte cryptographically random token, encoded as base64url.
 * Used for refresh tokens, CSRF tokens, and password-reset tokens.
 */
export function generateOpaqueToken(): string {
  return randomBytes(OPAQUE_TOKEN_BYTES).toString("base64url");
}

/**
 * SHA-256 of an input, returned as 64-char lowercase hex.
 * Fits the `char(64)` columns in sys.sys_auth_refresh_tokens and
 * sys.sys_auth_password_reset_tokens.
 */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export interface AuthCookieBundle {
  accessJwt: string;
  refreshToken: string;
  csrfToken: string;
  secure: boolean;
}

/**
 * Sets all three auth cookies on the reply with the canonical attributes.
 * `secure` should be true in production (HTTPS only) and false in development.
 */
export function setAuthCookies(reply: FastifyReply, bundle: AuthCookieBundle): void {
  reply.setCookie(COOKIES.ACCESS, bundle.accessJwt, {
    httpOnly: true,
    secure: bundle.secure,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_JWT_TTL_SECONDS,
  });

  reply.setCookie(COOKIES.REFRESH, bundle.refreshToken, {
    httpOnly: true,
    secure: bundle.secure,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });

  reply.setCookie(COOKIES.CSRF, bundle.csrfToken, {
    httpOnly: false,
    secure: bundle.secure,
    sameSite: "lax",
    path: "/",
    maxAge: CSRF_TOKEN_TTL_SECONDS,
  });
}

/**
 * Mandatory-MFA enrollment gate (MVP-4 par.2.5 #4): sets ONLY the access JWT
 * (a restricted enrollment-only token - claim `enr`, roles []) + the CSRF
 * cookie. NO refresh token: the enrollment window is the access TTL (15 min);
 * after enrolling a factor the client re-submits /login from scratch.
 */
export interface EnrollmentCookieBundle {
  accessJwt: string;
  csrfToken: string;
  secure: boolean;
}

export function setEnrollmentCookies(reply: FastifyReply, bundle: EnrollmentCookieBundle): void {
  reply.setCookie(COOKIES.ACCESS, bundle.accessJwt, {
    httpOnly: true,
    secure: bundle.secure,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_JWT_TTL_SECONDS,
  });
  reply.setCookie(COOKIES.CSRF, bundle.csrfToken, {
    httpOnly: false,
    secure: bundle.secure,
    sameSite: "lax",
    path: "/",
    maxAge: CSRF_TOKEN_TTL_SECONDS,
  });
}

/**
 * Clears all three auth cookies. Must mirror the path attributes used on set,
 * otherwise the browser keeps the cookie alive.
 */
export function clearAuthCookies(reply: FastifyReply): void {
  reply.clearCookie(COOKIES.ACCESS, { path: "/" });
  reply.clearCookie(COOKIES.REFRESH, { path: REFRESH_COOKIE_PATH });
  reply.clearCookie(COOKIES.REFRESH, { path: LEGACY_REFRESH_COOKIE_PATH });
  reply.clearCookie(COOKIES.CSRF, { path: "/" });
}
