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
  // Mandato K, R-9 (D9=B, 2026-09-17): ruoli di piattaforma che vedono/scrivono solo sui
  // clienti a cui sono stati assegnati (sys_platform_user_tenant_assignments, migration
  // 000422) — mai tutti i clienti come PLATFORM_ADMIN. Sola lettura sui rispettivi moduli.
  "PLATFORM_OPERATOR",
  "SALES",
  // Mandato K, R-2 (2026-09-18, decisione C di Enzo): il nucleo GDPR — gdpr:read,
  // gdpr:export, gdpr:erase, gdpr:retention — e il ritiro di gdpr:erase a
  // HRMS_MANAGER (D3=A, guardia G-D2, migration 000423). La lettura mascherata
  // del dossier (I18/I20) resta fuori: voce separata, BLOCCATA(Enzo).
  "DPO",
  // Mandato K, R-7 (2026-09-19): ruolo di cliente per l'amministrazione della
  // sicurezza — permessi di `auth` (role_matrix:read, auth:sessions_read,
  // auth:revoke_user), `mfa-policy`, `delegations`, più `role:assign` (entra in
  // CAN_GRANT_ROLES con lo stesso vincolo di TENANT_ADMIN: non concede ruoli di
  // piattaforma, non esce dal tenant — migration 000425).
  "SECURITY_ADMIN",
  // Mandato K, R-3 (2026-09-19): ruolo di cliente per il governo lato cliente della
  // tassonomia — competenze e ruoli professionali del proprio tenant, piu' i sinonimi
  // (skill_alias:manage, D1=B: "i sinonimi li governa chi governa le competenze").
  // La parte di piattaforma (skill_taxonomy:*, job_family:*) resta a PLATFORM_ADMIN
  // (migration 000426).
  "TAXONOMY_STEWARD",
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export const RoleCodeSchema = z.enum(ROLE_CODES);
