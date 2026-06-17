/**
 * packages/shared/src/schemas/succession-pools.ts
 * Tenant-scoped succession pool for a specific position.
 * Status: ACTIVE / ARCHIVED / PROPOSED.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";
export const SUCCESSION_POOL_STATUS_VALUES = ["ACTIVE", "ARCHIVED", "PROPOSED"] as const;
export const SuccessionPoolStatusSchema = z.enum(SUCCESSION_POOL_STATUS_VALUES);
export type SuccessionPoolStatus = z.infer<typeof SuccessionPoolStatusSchema>;

export const SuccessionPoolSchema = z.object({
  successionPoolId: z.uuid(),
  tenantId: z.uuid(),
  positionId: z.uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: SuccessionPoolStatusSchema,
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type SuccessionPool = z.infer<typeof SuccessionPoolSchema>;

export const SuccessionPoolListQuerySchema = z.object({
  positionId: z.uuid().optional(),
  status: SuccessionPoolStatusSchema.optional(),
  search: z.string().min(1).max(255).optional(),
  ...paginationFields(200, 50),
});
export type SuccessionPoolListQuery = z.infer<typeof SuccessionPoolListQuerySchema>;

export const SuccessionPoolListResponseSchema = z.object({
  items: z.array(SuccessionPoolSchema),
  total: z.number().int().min(0),
});

export const CreateSuccessionPoolBodySchema = z.object({
  positionId: z.uuid(),
  code: z.string().min(1).max(128),
  name: z.string().min(1).max(255),
  description: z.string().max(4096).nullable().optional(),
  status: SuccessionPoolStatusSchema.optional().default("ACTIVE"),
  tenantId: z.uuid().optional(),
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

export const SuccessionPoolIdParamSchema = z.object({ id: z.uuid() });
