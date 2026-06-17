/**
 * packages/shared/src/schemas/blueprint-families.ts
 */
import { z } from "zod";

import { paginationFields } from "./_pagination.js";
export const BlueprintFamilySchema = z.object({
  blueprintFamilyId: z.uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type BlueprintFamily = z.infer<typeof BlueprintFamilySchema>;

export const BlueprintFamilyListQuerySchema = z.object({
  search: z.string().min(1).max(255).optional(),
  ...paginationFields(200, 50),
});
export type BlueprintFamilyListQuery = z.infer<typeof BlueprintFamilyListQuerySchema>;

export const BlueprintFamilyListResponseSchema = z.object({
  items: z.array(BlueprintFamilySchema), total: z.number().int().min(0),
});

export const CreateBlueprintFamilyBodySchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  description: z.string().max(4096).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateBlueprintFamilyBody = z.infer<typeof CreateBlueprintFamilyBodySchema>;

export const UpdateBlueprintFamilyBodySchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(4096).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateBlueprintFamilyBody = z.infer<typeof UpdateBlueprintFamilyBodySchema>;

export const BlueprintFamilyIdParamSchema = z.object({ id: z.uuid() });
