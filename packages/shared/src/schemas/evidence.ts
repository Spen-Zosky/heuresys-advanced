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

/**
 * Un'evidenza. I campi di giudizio sono opzionali perche' sotto il solo mandato
 * piattaforma vengono RIMOSSI e dichiarati in `masked` (ADR-0032, #124 D4).
 *
 * Il confine, verificato sul modo in cui il repository costruisce le righe:
 *  - `title` RESTA — e' la dimensione, il nome della competenza, il titolo del
 *    modulo, il nome del KPI: dice su COSA si e' valutato, non quanto vale;
 *  - `narrative` se ne va — e' `..._narrative`, `..._comment`, `feedback_message`,
 *    `response_strengths`: testo scritto SU una persona, il giudizio in lettere;
 *  - `source` e `provenance` RESTANO: da dove viene il dato e con quale lineage
 *    sono l'oggetto stesso del mandato tecnico.
 */
export const EvidenceItemSchema = z.object({
  evidenceId: z.string(),
  kind: EvidenceKindEnum,
  subjectUserId: z.uuid(),
  title: z.string(),
  // giudizio (mascherabile, ADR-0032)
  score: z.number().nullable().optional(),
  narrative: z.string().nullable().optional(),
  masked: z.array(z.string()).optional(),
  /** Source label of the datum (e.g. MANAGER_ASSESSMENT, AI_INFERRED) where present. */
  source: z.string().nullable(),
  /** NULLED for anonymous 360 responses (deanonymization guard). */
  assessorUserId: z.uuid().nullable(),
  recordedAt: z.iso.datetime(),
  sourceTable: z.string(),
  sourceRecordId: z.string(),
  /** Ingestion-lineage footer (LEFT JOIN sys_source_lineage_records); null when not imported. */
  provenance: EvidenceProvenanceSchema.nullable(),
  payload: z.record(z.string(), z.unknown()).optional(),
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
export type EvidenceListResponse = z.infer<typeof EvidenceListResponseSchema>;

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
  // giudizio (mascherabile, ADR-0032 / #124 D4). `derivation` e' la stessa
  // spiegazione che in `insights` porta i valori grezzi dei fattori: se ne va
  // col valore, o il punteggio si ricalcola.
  value: z.number().nullable().optional(),
  band: z.string().nullable().optional(),
  /** The score's own explainable derivation payload passthrough. */
  derivation: z.record(z.string(), z.unknown()).optional(),
  masked: z.array(z.string()).optional(),
  modelVersion: z.string().nullable(),
  computedAt: z.iso.datetime(),
});
export type EvidenceScore = z.infer<typeof EvidenceScoreSchema>;

export const EvidenceForScoreResponseSchema = z.object({
  score: EvidenceScoreSchema,
  items: z.array(EvidenceItemSchema),
});
export type EvidenceForScoreResponse = z.infer<typeof EvidenceForScoreResponseSchema>;
