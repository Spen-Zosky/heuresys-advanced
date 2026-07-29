/**
 * packages/shared/src/schemas/seed-candidate-records.ts
 * Read-only viewer over seed candidate rows.
 */
import { z } from "zod";

import { paginationFields } from "./_pagination.js";
export const SEED_CANDIDATE_VALIDATION_STATUS_VALUES = [
  "PENDING", "PASSED", "FAILED", "WARNING", "APPROVED", "REJECTED", "APPLIED",
] as const;
export const SeedCandidateValidationStatusSchema = z.enum(SEED_CANDIDATE_VALIDATION_STATUS_VALUES);
export type SeedCandidateValidationStatus = z.infer<typeof SeedCandidateValidationStatusSchema>;

export const SeedCandidateRecordSchema = z.object({
  seedCandidateRecordId: z.uuid(),
  runId: z.uuid(),
  tenantId: z.uuid(),
  domain: z.string(),
  naturalKey: z.string(),
  payload: z.record(z.string(), z.unknown()),
  validationStatus: SeedCandidateValidationStatusSchema,
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type SeedCandidateRecord = z.infer<typeof SeedCandidateRecordSchema>;

export const SeedCandidateRecordListQuerySchema = z.object({
  runId: z.uuid().optional(),
  domain: z.string().min(1).max(64).optional(),
  validationStatus: SeedCandidateValidationStatusSchema.optional(),
  search: z.string().min(1).max(255).optional(),
  ...paginationFields(500, 100),
});
export type SeedCandidateRecordListQuery = z.infer<typeof SeedCandidateRecordListQuerySchema>;

export const SeedCandidateRecordListResponseSchema = z.object({
  items: z.array(SeedCandidateRecordSchema), total: z.number().int().min(0),
});

export const SeedCandidateRecordIdParamSchema = z.object({ id: z.uuid() });

/**
 * L'istruttoria di un record candidato: le VALIDAZIONI che ha superato (o non
 * superato) e le FONTI da cui viene. Erano due tabelle che si scrivevano e che
 * nessuna API leggeva — e sono proprio la parte che dà valore probatorio alla
 * pipeline: senza, l'approvazione è una firma senza istruttoria.
 */
export const SeedValidationResultSchema = z.object({
  seedValidationResultId: z.uuid(),
  candidateId: z.uuid(),
  ruleCode: z.string(),
  status: z.enum(["PASSED", "FAILED", "WARNING", "SKIPPED"]),
  message: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
});
export type SeedValidationResult = z.infer<typeof SeedValidationResultSchema>;

export const SeedValidationResultListResponseSchema = z.object({
  items: z.array(SeedValidationResultSchema),
  total: z.number().int().min(0),
});

export const SeedSourceEvidenceSchema = z.object({
  seedSourceEvidenceId: z.uuid(),
  candidateId: z.uuid(),
  url: z.string().nullable(),
  retrievedAt: z.iso.datetime().nullable(),
  contentHash: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
});
export type SeedSourceEvidence = z.infer<typeof SeedSourceEvidenceSchema>;

export const SeedSourceEvidenceListResponseSchema = z.object({
  items: z.array(SeedSourceEvidenceSchema),
  total: z.number().int().min(0),
});
