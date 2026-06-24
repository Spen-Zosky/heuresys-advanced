/**
 * packages/shared/src/schemas/successor-candidates.ts
 * Users in a succession pool. Status CANDIDATE/CONFIRMED/WITHDRAWN/NOT_READY.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";
export const SUCCESSOR_CANDIDATE_STATUS_VALUES = [
  "CANDIDATE",
  "CONFIRMED",
  "WITHDRAWN",
  "NOT_READY",
] as const;
export const SuccessorCandidateStatusSchema = z.enum(SUCCESSOR_CANDIDATE_STATUS_VALUES);
export type SuccessorCandidateStatus = z.infer<typeof SuccessorCandidateStatusSchema>;

export const SuccessorCandidateSchema = z.object({
  successorCandidateId: z.uuid(),
  poolId: z.uuid(),
  poolName: z.string().nullable(), // G-02: resolved on the list endpoint
  tenantId: z.uuid(),
  userId: z.uuid(),
  userName: z.string().nullable(),
  status: SuccessorCandidateStatusSchema,
  readinessLevel: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type SuccessorCandidate = z.infer<typeof SuccessorCandidateSchema>;

export const SuccessorCandidateListQuerySchema = z.object({
  poolId: z.uuid().optional(),
  userId: z.uuid().optional(),
  status: SuccessorCandidateStatusSchema.optional(),
  ...paginationFields(200, 50),
});
export type SuccessorCandidateListQuery = z.infer<typeof SuccessorCandidateListQuerySchema>;

export const SuccessorCandidateListResponseSchema = z.object({
  items: z.array(SuccessorCandidateSchema),
  total: z.number().int().min(0),
});

// Readiness distribution (aggregate for the career-succession pipeline chart — F4).
// `readinessLevel` is a free string; candidates with no level are bucketed as "UNASSESSED".
export const SuccessorReadinessDistributionItemSchema = z.object({
  readinessLevel: z.string(),
  count: z.number().int().min(0),
});
export type SuccessorReadinessDistributionItem = z.infer<
  typeof SuccessorReadinessDistributionItemSchema
>;

export const SuccessorReadinessDistributionResponseSchema = z.object({
  items: z.array(SuccessorReadinessDistributionItemSchema),
  total: z.number().int().min(0),
});
export type SuccessorReadinessDistributionResponse = z.infer<
  typeof SuccessorReadinessDistributionResponseSchema
>;

export const CreateSuccessorCandidateBodySchema = z.object({
  poolId: z.uuid(),
  userId: z.uuid(),
  status: SuccessorCandidateStatusSchema.optional().default("CANDIDATE"),
  readinessLevel: z.string().max(32).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateSuccessorCandidateBody = z.infer<typeof CreateSuccessorCandidateBodySchema>;

export const UpdateSuccessorCandidateBodySchema = z.object({
  status: SuccessorCandidateStatusSchema.optional(),
  readinessLevel: z.string().max(32).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateSuccessorCandidateBody = z.infer<typeof UpdateSuccessorCandidateBodySchema>;

export const SuccessorCandidateIdParamSchema = z.object({ id: z.uuid() });
