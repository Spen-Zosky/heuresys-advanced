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
  "CEO", // R1a — apex executive, hierarchical_operational (migration 000045)
  "TEAM_LEADER", // R1b — leads a team derived from an org unit (migration 000054)
  "TEAM_MEMBER", // R1b — belongs to a team derived from an org unit (migration 000054)
  "ORG_DIRECTOR", // Gap#1 — functional holderless role for the Org-Director console (migration 000145)
  "WHISTLEBLOWING_CUSTODIAN", // #51 E1 — dedicated handler of whistleblowing reports, isolated from admin plenipotence (migration 000181)
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export const RoleCodeSchema = z.enum(ROLE_CODES);
