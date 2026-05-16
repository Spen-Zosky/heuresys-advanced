/**
 * apps/api/src/config/constants.ts
 * Cookie names, header names, token TTLs — server-only constants.
 *
 * RBAC role codes (ROLE_CODES / RoleCode / RoleCodeSchema) live in
 * @heuresys/shared so the frontend can consume them too. We re-export them
 * here for ergonomic in-API imports.
 */

export { ROLE_CODES, type RoleCode, RoleCodeSchema } from "@heuresys/shared";

export const COOKIES = {
  ACCESS:  "hrx_access",
  REFRESH: "hrx_refresh",
  CSRF:    "hrx_csrf",
} as const;

export const HEADERS = {
  CSRF:       "x-csrf-token",
  REQUEST_ID: "x-request-id",
} as const;

export const ACCESS_JWT_TTL_SECONDS = 15 * 60;        // 15 minutes
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
export const CSRF_TOKEN_TTL_SECONDS = 24 * 60 * 60;   // 24 hours
