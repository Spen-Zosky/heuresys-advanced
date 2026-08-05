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
  // Chi REGGE UNA FILIALE — un sotto-albero gerarchico vero, non una squadra
  // (decisione di Enzo, 2026-08-05; migration 000272).
  //
  // Perche' un ruolo nuovo e non `dashboard:view` su `TEAM_LEADER`: misurato, i 10
  // capi filiale e il capo squadra `marco.rinaldi` hanno gli STESSI TRE RUOLI
  // (TEAM_LEADER+TEAM_MEMBER+USER). Il ruolo non sa distinguerli; il fatto si':
  // reggere un'unita' di tipo BRANCH. Concedere sul ruolo condiviso avrebbe dato il
  // cruscotto anche a chi guida un progetto — che e' precisamente la distinzione
  // che la decisione chiede di rispettare (una filiale e' una catena gerarchica; una
  // squadra ha uno SCOPO e il suo capo puo' essere gerarchicamente sotto un membro).
  "BRANCH_MANAGER",
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export const RoleCodeSchema = z.enum(ROLE_CODES);
