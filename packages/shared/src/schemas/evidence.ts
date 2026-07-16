/**
 * @heuresys/shared — Evidence layer schemas. #27 (S1018) — the explainability
 * wedge ("why this rating/gap/score"). Backs /v1/evidence/* over 9 fragmented
 * per-domain evidence tables, normalized into ONE EvidenceItem envelope with a
 * lineage-provenance footer (AI-Act "explainability before accuracy"). READ-only.
 */
import { z } from "zod";
import { paginationFields } from "./_pagination.js";

export const EvidenceKindEnum = z.enum([
  "ASSESSMENT",
  "SKILL",
  "LEARNING",
  "CONTINUOUS_FEEDBACK",
  "BEHAVIORAL",
  "COMPETENCY_RATING",
  "FEEDBACK_360",
  "KPI_RESULT",
  "PERSON_RECORD",
]);
export type EvidenceKind = z.infer<typeof EvidenceKindEnum>;

export const EvidenceProvenanceSchema = z.object({
  sourceSystem: z.string(),
  sourceTable: z.string(),
  sourceRecordId: z.string(),
  mappingConfidence: z.number().nullable(),
  sdbiConfidence: z.number().nullable(),
  sdbiAiModelId: z.string().nullable(),
  sdbiHumanApprover: z.string().nullable(),
  validationStatus: z.enum(["VALID", "STALE", "CONFLICTED", "REJECTED"]).nullable(),
});
export type EvidenceProvenance = z.infer<typeof EvidenceProvenanceSchema>;

export const EvidenceItemSchema = z.object({
  evidenceId: z.string(),
  kind: EvidenceKindEnum,
  subjectUserId: z.uuid(),
  title: z.string(),
  score: z.number().nullable(),
  narrative: z.string().nullable(),
  /** Source label of the datum (e.g. MANAGER_ASSESSMENT, AI_INFERRED) where present. */
  source: z.string().nullable(),
  /** NULLED for anonymous 360 responses (deanonymization guard). */
  assessorUserId: z.uuid().nullable(),
  recordedAt: z.iso.datetime(),
  sourceTable: z.string(),
  sourceRecordId: z.string(),
  /** Ingestion-lineage footer (LEFT JOIN sys_source_lineage_records); null when not imported. */
  provenance: EvidenceProvenanceSchema.nullable(),
  payload: z.record(z.string(), z.unknown()),
});
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export const EvidenceSubjectQuerySchema = z.object({
  /** Comma-separated EvidenceKind filter; empty = all kinds. */
  types: z.string().optional(),
  ...paginationFields(200, 50),
});
export type EvidenceSubjectQuery = z.infer<typeof EvidenceSubjectQuerySchema>;

export const EvidenceListResponseSchema = z.object({
  items: z.array(EvidenceItemSchema),
  total: z.number().int().min(0),
});

export const EvidenceScoreTypeEnum = z.enum([
  "LEARNING_GAP",
  "SKILL_GAP_SCORE",
  "SUCCESSION_READINESS_SCORE",
  "FLIGHT_RISK_SCORE",
]);
export type EvidenceScoreType = z.infer<typeof EvidenceScoreTypeEnum>;

export const EvidenceForScoreQuerySchema = z.object({
  scoreType: EvidenceScoreTypeEnum,
  scoreId: z.uuid(),
});
export type EvidenceForScoreQuery = z.infer<typeof EvidenceForScoreQuerySchema>;

export const EvidenceScoreSchema = z.object({
  type: EvidenceScoreTypeEnum,
  id: z.uuid(),
  subjectUserId: z.uuid(),
  value: z.number().nullable(),
  band: z.string().nullable(),
  modelVersion: z.string().nullable(),
  /** The score's own explainable derivation payload passthrough. */
  derivation: z.record(z.string(), z.unknown()),
  computedAt: z.iso.datetime(),
});
export type EvidenceScore = z.infer<typeof EvidenceScoreSchema>;

export const EvidenceForScoreResponseSchema = z.object({
  score: EvidenceScoreSchema,
  items: z.array(EvidenceItemSchema),
});
export type EvidenceForScoreResponse = z.infer<typeof EvidenceForScoreResponseSchema>;
