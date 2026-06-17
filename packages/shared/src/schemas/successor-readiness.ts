/**
 * packages/shared/src/schemas/successor-readiness.ts
 * Append-only readiness measurements for a successor candidate.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";
export const SuccessorReadinessSchema = z.object({
  successorReadinessId: z.uuid(),
  candidateId: z.uuid(),
  tenantId: z.uuid(),
  score: z.number().nullable(),
  horizon: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
  assessedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});
export type SuccessorReadiness = z.infer<typeof SuccessorReadinessSchema>;

export const SuccessorReadinessListQuerySchema = z.object({
  candidateId: z.uuid().optional(),
  horizon: z.string().min(1).max(32).optional(),
  ...paginationFields(200, 50),
});
export type SuccessorReadinessListQuery = z.infer<typeof SuccessorReadinessListQuerySchema>;

export const SuccessorReadinessListResponseSchema = z.object({
  items: z.array(SuccessorReadinessSchema),
  total: z.number().int().min(0),
});

export const CreateSuccessorReadinessBodySchema = z.object({
  candidateId: z.uuid(),
  score: z.number().min(-100).max(100).nullable().optional(),
  horizon: z.string().max(32).nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateSuccessorReadinessBody = z.infer<typeof CreateSuccessorReadinessBodySchema>;

export const SuccessorReadinessIdParamSchema = z.object({ id: z.uuid() });
