/**
 * packages/shared/src/schemas/successor-candidates.ts
 * Users in a succession pool. Status CANDIDATE/CONFIRMED/WITHDRAWN/NOT_READY.
 */

import { z } from "zod";

export const SUCCESSOR_CANDIDATE_STATUS_VALUES = [
  "CANDIDATE",
  "CONFIRMED",
  "WITHDRAWN",
  "NOT_READY",
] as const;
export const SuccessorCandidateStatusSchema = z.enum(SUCCESSOR_CANDIDATE_STATUS_VALUES);
export type SuccessorCandidateStatus = z.infer<typeof SuccessorCandidateStatusSchema>;

export const SuccessorCandidateSchema = z.object({
  successorCandidateId: z.string().uuid(),
  poolId: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  status: SuccessorCandidateStatusSchema,
  readinessLevel: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SuccessorCandidate = z.infer<typeof SuccessorCandidateSchema>;

export const SuccessorCandidateListQuerySchema = z.object({
  poolId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  status: SuccessorCandidateStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type SuccessorCandidateListQuery = z.infer<typeof SuccessorCandidateListQuerySchema>;

export const SuccessorCandidateListResponseSchema = z.object({
  items: z.array(SuccessorCandidateSchema),
  total: z.number().int().min(0),
});

export const CreateSuccessorCandidateBodySchema = z.object({
  poolId: z.string().uuid(),
  userId: z.string().uuid(),
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

export const SuccessorCandidateIdParamSchema = z.object({ id: z.string().uuid() });
