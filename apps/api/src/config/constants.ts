/**
 * apps/api/src/config/constants.ts
 * Cookie names, header names, role codes — single source of truth.
 */

export const COOKIES = {
  ACCESS:  "hrx_access",
  REFRESH: "hrx_refresh",
  CSRF:    "hrx_csrf",
} as const;

export const HEADERS = {
  CSRF:       "x-csrf-token",
  REQUEST_ID: "x-request-id",
} as const;

export const ROLE_CODES = [
  "PLATFORM_ADMIN",
  "TENANT_ADMIN",
  "BLUEPRINT_MANAGER",
  "HRMS_MANAGER",
  "PROCESS_OWNER",
  "MANAGER",
  "USER",
  "READ_ONLY",
] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

export const ACCESS_JWT_TTL_SECONDS = 15 * 60;        // 15 minutes
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
export const CSRF_TOKEN_TTL_SECONDS = 24 * 60 * 60;   // 24 hours
