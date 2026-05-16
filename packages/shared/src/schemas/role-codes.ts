/**
 * packages/shared/src/schemas/role-codes.ts
 * Canonical RBAC role codes — single source of truth shared by @heuresys/api
 * and (future) @heuresys/web. Mirrors the seed in migration 000005.
 *
 * Per AUTH_SECURITY_PLAN §2.8.
 */

import { z } from "zod";

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

export const RoleCodeSchema = z.enum(ROLE_CODES);
