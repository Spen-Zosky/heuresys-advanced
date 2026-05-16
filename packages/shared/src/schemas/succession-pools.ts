/**
 * packages/shared/src/schemas/succession-pools.ts
 * Tenant-scoped succession pool for a specific position.
 * Status: ACTIVE / ARCHIVED / PROPOSED.
 */

import { z } from "zod";

export const SUCCESSION_POOL_STATUS_VALUES = ["ACTIVE", "ARCHIVED", "PROPOSED"] as const;
export const SuccessionPoolStatusSchema = z.enum(SUCCESSION_POOL_STATUS_VALUES);
export type SuccessionPoolStatus = z.infer<typeof SuccessionPoolStatusSchema>;

export const SuccessionPoolSchema = z.object({
  successionPoolId: z.string().uuid(),
  tenantId: z.string().uuid(),
  positionId: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: SuccessionPoolStatusSchema,
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SuccessionPool = z.infer<typeof SuccessionPoolSchema>;

export const SuccessionPoolListQuerySchema = z.object({
  positionId: z.string().uuid().optional(),
  status: SuccessionPoolStatusSchema.optional(),
  search: z.string().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type SuccessionPoolListQuery = z.infer<typeof SuccessionPoolListQuerySchema>;

export const SuccessionPoolListResponseSchema = z.object({
  items: z.array(SuccessionPoolSchema),
  total: z.number().int().min(0),
});

export const CreateSuccessionPoolBodySchema = z.object({
  positionId: z.string().uuid(),
  code: z.string().min(1).max(128),
  name: z.string().min(1).max(255),
  description: z.string().max(4096).nullable().optional(),
  status: SuccessionPoolStatusSchema.optional().default("ACTIVE"),
  tenantId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateSuccessionPoolBody = z.infer<typeof CreateSuccessionPoolBodySchema>;

export const UpdateSuccessionPoolBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(4096).nullable().optional(),
  status: SuccessionPoolStatusSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateSuccessionPoolBody = z.infer<typeof UpdateSuccessionPoolBodySchema>;

export const SuccessionPoolIdParamSchema = z.object({ id: z.string().uuid() });
