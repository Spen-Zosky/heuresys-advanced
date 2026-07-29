/**
 * packages/shared/src/schemas/gdpr.ts
 * D-14 F3/F4 — GDPR tooling contract.
 *
 * Backs the admin surface /v1/gdpr/* (data-map, DSR export, erasure with
 * legal-hold, retention sweep — perms gdpr:read/export/erase/retention) and
 * the self-service surface /v1/me/gdpr/export + /v1/me/consents (I17 floor).
 * The classification registry (sys.sys_gdpr_data_map) is DATA, seeded by
 * migration 000186 — strategy per table: DELETE / ANONYMIZE (root row) /
 * RETAIN (legal hold, with basis).
 */
import { z } from "zod";
import { paginationFields } from "./_pagination.js";

/* --- data map ----------------------------------------------------------- */

export const GdprDataClassEnum = z.enum([
  "IDENTITY",
  "PERSONAL",
  "FINANCIAL_LEGAL",
  "EVALUATION",
  "OPERATIONAL",
  "AUTH_SECURITY",
  "DERIVED",
]);
export type GdprDataClass = z.infer<typeof GdprDataClassEnum>;

export const GdprErasureStrategyEnum = z.enum(["DELETE", "ANONYMIZE", "RETAIN"]);
export type GdprErasureStrategy = z.infer<typeof GdprErasureStrategyEnum>;

/** Z-259 — SUBJECT: the row holds data OF the person, and belongs in the Art. 15
 *  export. ACTOR: the person is the author/reviewer of someone ELSE's record —
 *  the row describes a third party and is withheld (Art. 15(4)). Held as data in
 *  sys_gdpr_data_map, as an explicit closed list: deriving it from a naming
 *  convention is the anti-pattern that blinded the coverage gate (AP-03). */
export const GdprReferenceKindEnum = z.enum(["SUBJECT", "ACTOR"]);
export type GdprReferenceKind = z.infer<typeof GdprReferenceKindEnum>;

export const GdprDataMapEntrySchema = z.object({
  tableSchema: z.string(),
  tableName: z.string(),
  subjectFkColumn: z.string(),
  dataClass: GdprDataClassEnum,
  erasureStrategy: GdprErasureStrategyEnum,
  referenceKind: GdprReferenceKindEnum,
  retentionDays: z.number().int().positive().nullable(),
  ageColumn: z.string().nullable(),
  legalBasis: z.string().nullable(),
});
export type GdprDataMapEntry = z.infer<typeof GdprDataMapEntrySchema>;

export const GdprDataMapResponseSchema = z.object({
  items: z.array(GdprDataMapEntrySchema),
});
export type GdprDataMapResponse = z.infer<typeof GdprDataMapResponseSchema>;

/* --- DSR export --------------------------------------------------------- */

export const GdprUserIdParamSchema = z.object({ userId: z.string().uuid() });
export type GdprUserIdParam = z.infer<typeof GdprUserIdParamSchema>;

const GdprExportTableSchema = z.object({
  dataClass: GdprDataClassEnum,
  subjectFkColumn: z.string(),
  rowCount: z.number().int(),
  rows: z.array(z.record(z.string(), z.unknown())),
  /** Columns withheld from `rows` because they identify another person
   *  (Art. 15(4)) — declared to the subject rather than silently dropped. */
  omittedColumns: z.array(z.string()).optional(),
});

export const GdprExportBundleSchema = z.object({
  generatedAt: z.string(),
  subject: z.object({
    userId: z.string().uuid(),
    tenantId: z.string().uuid().nullable(),
    email: z.string(),
  }),
  /** keyed by "schema.table[.subject_fk]" — every registry entry, even when 0 rows */
  tables: z.record(z.string(), GdprExportTableSchema),
});
export type GdprExportBundle = z.infer<typeof GdprExportBundleSchema>;

/* --- erasure ------------------------------------------------------------ */

export const GdprErasureBodySchema = z.object({
  dryRun: z.boolean().default(true),
});
export type GdprErasureBody = z.infer<typeof GdprErasureBodySchema>;

const GdprErasureTableReportSchema = z.object({
  strategy: GdprErasureStrategyEnum,
  dataClass: GdprDataClassEnum,
  affectedRows: z.number().int(),
  legalBasis: z.string().nullable(),
});

export const GdprErasureReportSchema = z.object({
  subjectUserId: z.string().uuid(),
  dryRun: z.boolean(),
  executedAt: z.string(),
  /** keyed like the export bundle */
  tables: z.record(z.string(), GdprErasureTableReportSchema),
  anonymizedRoot: z.boolean(),
});
export type GdprErasureReport = z.infer<typeof GdprErasureReportSchema>;

/* --- retention sweep ---------------------------------------------------- */

export const GdprRetentionBodySchema = z.object({
  dryRun: z.boolean().default(true),
});
export type GdprRetentionBody = z.infer<typeof GdprRetentionBodySchema>;

export const GdprRetentionReportSchema = z.object({
  dryRun: z.boolean(),
  executedAt: z.string(),
  tables: z.record(
    z.string(),
    z.object({
      retentionDays: z.number().int(),
      ageColumn: z.string(),
      affectedRows: z.number().int(),
    }),
  ),
});
export type GdprRetentionReport = z.infer<typeof GdprRetentionReportSchema>;

/* --- consents ----------------------------------------------------------- */

export const ConsentPurposeEnum = z.enum([
  "ANALYTICS_PROFILING",
  "MARKETING_COMMUNICATIONS",
  "INTERNAL_PHOTO_USE",
  "THIRD_PARTY_SHARING",
]);
export type ConsentPurpose = z.infer<typeof ConsentPurposeEnum>;

export const ConsentEventBodySchema = z.object({
  purpose: ConsentPurposeEnum,
  action: z.enum(["GRANT", "REVOKE"]),
  note: z.string().max(500).optional(),
});
export type ConsentEventBody = z.infer<typeof ConsentEventBodySchema>;

export const ConsentStateSchema = z.object({
  purpose: ConsentPurposeEnum,
  granted: z.boolean(),
  /** last event timestamp; null when no event ever recorded for the purpose */
  lastChangedAt: z.string().nullable(),
});

export const ConsentStateResponseSchema = z.object({
  items: z.array(ConsentStateSchema),
});
export type ConsentStateResponse = z.infer<typeof ConsentStateResponseSchema>;

export const ConsentEventResponseSchema = z.object({
  purpose: ConsentPurposeEnum,
  action: z.enum(["GRANT", "REVOKE"]),
  occurredAt: z.string(),
});
export type ConsentEventResponse = z.infer<typeof ConsentEventResponseSchema>;

/**
 * Il REGISTRO delle richieste dell'interessato. Le richieste si scrivevano
 * (ogni export/erasure/retention lascia la sua riga di accountability) e non si
 * potevano rileggere: nessun endpoint le elencava. Un registro che nessuno può
 * consultare non dimostra la conformità a nessuno — è esattamente la lacuna che
 * il cancello di esposizione ha segnalato al cluster C10.
 */
export const GdprRequestSchema = z.object({
  gdprRequestId: z.uuid(),
  tenantId: z.uuid(),
  subjectUserId: z.uuid().nullable(),
  type: z.enum(["EXPORT", "ERASURE", "RETENTION_RUN"]),
  status: z.enum(["COMPLETED", "DRY_RUN"]),
  requestedBy: z.uuid().nullable(),
  report: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
});
export type GdprRequest = z.infer<typeof GdprRequestSchema>;

export const GdprRequestListQuerySchema = z.object({
  subjectUserId: z.uuid().optional(),
  type: z.enum(["EXPORT", "ERASURE", "RETENTION_RUN"]).optional(),
  status: z.enum(["COMPLETED", "DRY_RUN"]).optional(),
  ...paginationFields(200, 50),
});
export type GdprRequestListQuery = z.infer<typeof GdprRequestListQuerySchema>;

export const GdprRequestListResponseSchema = z.object({
  items: z.array(GdprRequestSchema),
  total: z.number().int().min(0),
});
