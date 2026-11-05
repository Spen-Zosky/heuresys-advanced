/**
 * packages/shared/src/schemas/mandate-acts.ts
 * ADR-0050 D4 e D7 (mig 000475): concedere, revocare o riconfermare un mandato forte è un atto.
 * Lo propone chi può concedere ruoli, lo decide un secondo titolare di mandato (mai chi lo
 * propone, mai chi lo riceve), e solo l'atto approvato produce l'effetto. Rispecchia i CHECK di
 * sys.sys_mandate_acts.
 */

import { z } from "zod";
import { RoleCodeSchema, type RoleCode } from "./role-codes.js";

/**
 * ADR-0050 D1: i mandati forti, per chi li deve riconoscere senza chiederli all'API (le pagine).
 * La fonte è MANDATE_ROLES in apps/api/src/lib/scope/mandati.ts e, in SQL, sys.f_ruoli_mandato();
 * adr0050-mandato-atto.integration.test.ts verifica che i tre elenchi coincidano.
 */
export const MANDATE_ROLE_CODES: readonly RoleCode[] = [
  "TENANT_ADMIN",
  "HRMS_MANAGER",
  "PEOPLE_MANAGER",
  "DPO",
  "PLATFORM_ADMIN",
  "SECURITY_ADMIN",
  "WHISTLEBLOWING_CUSTODIAN",
];

export const MANDATE_ACT_KINDS = ["GRANT", "REVOKE", "CONFIRM"] as const;
export const MandateActKindSchema = z.enum(MANDATE_ACT_KINDS);
export type MandateActKind = z.infer<typeof MandateActKindSchema>;

export const MANDATE_ACT_STATUSES = ["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"] as const;
export const MandateActStatusSchema = z.enum(MANDATE_ACT_STATUSES);
export type MandateActStatus = z.infer<typeof MandateActStatusSchema>;

/** Una revisione oltre un anno non è una revisione: il servizio la rifiuta. */
export const MANDATE_REVIEW_MAX_DAYS = 366;

export const MandateActSchema = z.object({
  actId: z.uuid(),
  kind: MandateActKindSchema,
  status: MandateActStatusSchema,
  /** null quando la persona è stata cancellata: l'atto resta come storia (ON DELETE SET NULL). */
  userId: z.uuid().nullable(),
  userDisplayName: z.string().nullable(),
  roleCode: RoleCodeSchema,
  tenantId: z.uuid().nullable(),
  grantId: z.uuid().nullable(),
  reason: z.string(),
  reviewBy: z.iso.date().nullable(),
  positionId: z.uuid().nullable(),
  proposedBy: z.uuid().nullable(),
  proposedByDisplayName: z.string().nullable(),
  proposedAt: z.iso.datetime(),
  decidedBy: z.uuid().nullable(),
  decidedAt: z.iso.datetime().nullable(),
  decisionNote: z.string().nullable(),
});
export type MandateAct = z.infer<typeof MandateActSchema>;

export const MandateActListResponseSchema = z.object({
  items: z.array(MandateActSchema),
});
export type MandateActListResponse = z.infer<typeof MandateActListResponseSchema>;

export const MandateActListQuerySchema = z.object({
  status: MandateActStatusSchema.optional(),
  userId: z.uuid().optional(),
});
export type MandateActListQuery = z.infer<typeof MandateActListQuerySchema>;

export const ProposeMandateActBodySchema = z
  .object({
    kind: MandateActKindSchema,
    userId: z.uuid(),
    /** GRANT: il ruolo da concedere. REVOKE e CONFIRM lo ricavano dalla concessione. */
    roleCode: RoleCodeSchema.optional(),
    /** GRANT da PLATFORM_ADMIN: null concede su tutta la piattaforma; altrimenti come grantRole. */
    tenantId: z.uuid().nullable().optional(),
    /** REVOKE e CONFIRM: la concessione su cui l'atto agisce. */
    grantId: z.uuid().optional(),
    reason: z.string().trim().min(10).max(2000),
    /** GRANT e CONFIRM: obbligatoria, nel futuro, entro MANDATE_REVIEW_MAX_DAYS. */
    reviewBy: z.iso.date().optional(),
    /** ADR-0050 D8: la posizione che giustifica il mandato, se la persona ne regge una. */
    positionId: z.uuid().optional(),
  })
  .superRefine((b, ctx) => {
    if (b.kind === "GRANT" && !b.roleCode) {
      ctx.addIssue({ code: "custom", path: ["roleCode"], message: "roleCode is required for GRANT" });
    }
    if (b.kind !== "GRANT" && !b.grantId) {
      ctx.addIssue({ code: "custom", path: ["grantId"], message: "grantId is required for REVOKE and CONFIRM" });
    }
    if (b.kind !== "REVOKE" && !b.reviewBy) {
      ctx.addIssue({ code: "custom", path: ["reviewBy"], message: "reviewBy is required for GRANT and CONFIRM" });
    }
  });
export type ProposeMandateActBody = z.infer<typeof ProposeMandateActBodySchema>;

export const DecideMandateActBodySchema = z.object({
  note: z.string().trim().max(2000).optional(),
});
export type DecideMandateActBody = z.infer<typeof DecideMandateActBodySchema>;

export const RejectMandateActBodySchema = z.object({
  note: z.string().trim().min(5).max(2000),
});
export type RejectMandateActBody = z.infer<typeof RejectMandateActBodySchema>;

export const MandateActIdParamSchema = z.object({ id: z.uuid() });
