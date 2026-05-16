/**
 * packages/shared/src/schemas/seed-approval-decisions.ts
 * Append-only approval ledger for seed candidate records.
 */
import { z } from "zod";

export const SEED_APPROVAL_STATUS_VALUES = [
  "APPROVED", "REJECTED", "NEEDS_CHANGES",
] as const;
export const SeedApprovalStatusSchema = z.enum(SEED_APPROVAL_STATUS_VALUES);
export type SeedApprovalStatus = z.infer<typeof SeedApprovalStatusSchema>;

export const SeedApprovalDecisionSchema = z.object({
  seedApprovalDecisionId: z.string().uuid(),
  candidateId: z.string().uuid(),
  approverUserId: z.string().uuid().nullable(),
  status: SeedApprovalStatusSchema,
  rationale: z.string().nullable(),
  decidedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type SeedApprovalDecision = z.infer<typeof SeedApprovalDecisionSchema>;

export const SeedApprovalDecisionListQuerySchema = z.object({
  candidateId: z.string().uuid().optional(),
  status: SeedApprovalStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type SeedApprovalDecisionListQuery = z.infer<typeof SeedApprovalDecisionListQuerySchema>;

export const SeedApprovalDecisionListResponseSchema = z.object({
  items: z.array(SeedApprovalDecisionSchema), total: z.number().int().min(0),
});

export const CreateSeedApprovalDecisionBodySchema = z.object({
  candidateId: z.string().uuid(),
  status: SeedApprovalStatusSchema,
  rationale: z.string().max(8192).nullable().optional(),
});
export type CreateSeedApprovalDecisionBody = z.infer<typeof CreateSeedApprovalDecisionBodySchema>;

export const SeedApprovalDecisionIdParamSchema = z.object({ id: z.string().uuid() });
