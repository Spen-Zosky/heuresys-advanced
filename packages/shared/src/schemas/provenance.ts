/**
 * @heuresys/shared — Provenance (Trust Ledger) schemas. #28 (S1018).
 * Backs /v1/provenance/* over sys.sys_source_lineage_records (mig 000025 +
 * SDBI columns 000063): the per-record ingestion lineage — source system/table/
 * record, mapping confidence, validation status, AI-assist + human-approval
 * marks (AI-Act / GDPR art.22 audit surface). READ-only.
 */
import { z } from "zod";
import { paginationFields } from "./_pagination.js";

export const ProvenanceValidationStatusEnum = z.enum(["VALID", "STALE", "CONFLICTED", "REJECTED"]);

export const ProvenanceRecordSchema = z.object({
  lineageId: z.uuid(),
  tenantId: z.uuid(),
  sourceSystem: z.string(),
  sourceTable: z.string(),
  /** varchar(255) in DDL — NOT necessarily a uuid. */
  sourceRecordId: z.string(),
  sourceNaturalKey: z.string().nullable(),
  contentHash: z.string().nullable(),
  importRunId: z.uuid().nullable(),
  targetTableName: z.string(),
  targetRecordId: z.uuid(),
  mappingConfidence: z.number(),
  validationStatus: ProvenanceValidationStatusEnum,
  sdbiMappingCardId: z.string().nullable(),
  sdbiConfidence: z.number().nullable(),
  sdbiAiModelId: z.string().nullable(),
  sdbiHumanApprover: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type ProvenanceRecord = z.infer<typeof ProvenanceRecordSchema>;

export const ProvenanceListQuerySchema = z.object({
  targetTable: z.string().max(255).optional(),
  sourceTable: z.string().max(255).optional(),
  runId: z.uuid().optional(),
  validationStatus: ProvenanceValidationStatusEnum.optional(),
  minConfidence: z.coerce.number().min(0).max(1).optional(),
  hasAiModel: z.coerce.boolean().optional(),
  hasHumanApprover: z.coerce.boolean().optional(),
  ...paginationFields(200, 50),
});
export type ProvenanceListQuery = z.infer<typeof ProvenanceListQuerySchema>;

export const ProvenanceListResponseSchema = z.object({
  items: z.array(ProvenanceRecordSchema),
  total: z.number().int().min(0),
});

export const ProvenanceSummaryRowSchema = z.object({
  targetTable: z.string(),
  total: z.number().int(),
  avgConfidence: z.number().nullable(),
  valid: z.number().int(),
  stale: z.number().int(),
  conflicted: z.number().int(),
  rejected: z.number().int(),
  aiAssisted: z.number().int(),
  humanApproved: z.number().int(),
});
export type ProvenanceSummaryRow = z.infer<typeof ProvenanceSummaryRowSchema>;

export const ProvenanceSummaryResponseSchema = z.object({
  byTable: z.array(ProvenanceSummaryRowSchema),
  totals: z.object({
    records: z.number().int(),
    avgConfidence: z.number().nullable(),
    aiAssisted: z.number().int(),
    humanApproved: z.number().int(),
    conflicted: z.number().int(),
  }),
});
export type ProvenanceSummaryResponse = z.infer<typeof ProvenanceSummaryResponseSchema>;
