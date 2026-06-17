/**
 * packages/shared/src/schemas/assessment-results.ts
 * Immutable results (one row per dimension scored). API: list/get/create.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";
export const AssessmentResultSchema = z.object({
  assessmentResultId: z.uuid(),
  assessmentId: z.uuid(),
  tenantId: z.uuid(),
  dimension: z.string(),
  score: z.number().nullable(),
  narrative: z.string().nullable(),
  assessorUserId: z.uuid().nullable(),
  recordedAt: z.iso.datetime(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
});
export type AssessmentResult = z.infer<typeof AssessmentResultSchema>;

export const AssessmentResultListQuerySchema = z.object({
  assessmentId: z.uuid().optional(),
  dimension: z.string().min(1).max(128).optional(),
  ...paginationFields(200, 50),
});
export type AssessmentResultListQuery = z.infer<typeof AssessmentResultListQuerySchema>;

export const AssessmentResultListResponseSchema = z.object({
  items: z.array(AssessmentResultSchema),
  total: z.number().int().min(0),
});

export const CreateAssessmentResultBodySchema = z.object({
  assessmentId: z.uuid(),
  dimension: z.string().min(1).max(128),
  score: z.number().min(0).max(100).nullable().optional(),
  narrative: z.string().max(8192).nullable().optional(),
  assessorUserId: z.uuid().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateAssessmentResultBody = z.infer<typeof CreateAssessmentResultBodySchema>;

export const AssessmentResultIdParamSchema = z.object({ id: z.uuid() });
