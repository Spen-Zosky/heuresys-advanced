/**
 * packages/shared/src/schemas/brownfield-table-mappings.ts
 * Maps legacy source tables to target sys.* schema with approval workflow.
 */
import { z } from "zod";

export const BROWNFIELD_APPROVAL_STATUS_VALUES = [
  "PROPOSED", "APPROVED", "REJECTED", "ARCHIVED",
] as const;
export const BrownfieldApprovalStatusSchema = z.enum(BROWNFIELD_APPROVAL_STATUS_VALUES);
export type BrownfieldApprovalStatus = z.infer<typeof BrownfieldApprovalStatusSchema>;

export const BrownfieldTableMappingSchema = z.object({
  tableMappingId: z.string().uuid(),
  runId: z.string().uuid().nullable(),
  sourceTableId: z.string().uuid(),
  targetSchema: z.string(),
  targetTable: z.string(),
  classification: z.string(),
  approvalStatus: BrownfieldApprovalStatusSchema,
  approvedBy: z.string().uuid().nullable(),
  approvedAt: z.string().datetime().nullable(),
  rationale: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
});
export type BrownfieldTableMapping = z.infer<typeof BrownfieldTableMappingSchema>;

export const BrownfieldTableMappingListQuerySchema = z.object({
  runId: z.string().uuid().optional(),
  sourceTableId: z.string().uuid().optional(),
  approvalStatus: BrownfieldApprovalStatusSchema.optional(),
  targetSchema: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type BrownfieldTableMappingListQuery = z.infer<typeof BrownfieldTableMappingListQuerySchema>;

export const BrownfieldTableMappingListResponseSchema = z.object({
  items: z.array(BrownfieldTableMappingSchema), total: z.number().int().min(0),
});

export const ApproveBrownfieldTableMappingBodySchema = z.object({
  approvalStatus: BrownfieldApprovalStatusSchema,
  rationale: z.string().max(8192).nullable().optional(),
});
export type ApproveBrownfieldTableMappingBody = z.infer<typeof ApproveBrownfieldTableMappingBodySchema>;

export const BrownfieldTableMappingIdParamSchema = z.object({ id: z.string().uuid() });
