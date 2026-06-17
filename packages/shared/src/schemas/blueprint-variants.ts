/**
 * packages/shared/src/schemas/blueprint-variants.ts
 */
import { z } from "zod";

import { paginationFields } from "./_pagination.js";
export const BlueprintVariantSchema = z.object({
  blueprintVariantId: z.uuid(),
  familyId: z.uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  sizeBandId: z.uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type BlueprintVariant = z.infer<typeof BlueprintVariantSchema>;

export const BlueprintVariantListQuerySchema = z.object({
  familyId: z.uuid().optional(),
  sizeBandId: z.uuid().optional(),
  search: z.string().min(1).max(255).optional(),
  ...paginationFields(200, 50),
});
export type BlueprintVariantListQuery = z.infer<typeof BlueprintVariantListQuerySchema>;

export const BlueprintVariantListResponseSchema = z.object({
  items: z.array(BlueprintVariantSchema), total: z.number().int().min(0),
});

export const CreateBlueprintVariantBodySchema = z.object({
  familyId: z.uuid(),
  code: z.string().min(1).max(128),
  name: z.string().min(1).max(255),
  description: z.string().max(4096).nullable().optional(),
  sizeBandId: z.uuid().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateBlueprintVariantBody = z.infer<typeof CreateBlueprintVariantBodySchema>;

export const UpdateBlueprintVariantBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(4096).nullable().optional(),
  sizeBandId: z.uuid().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateBlueprintVariantBody = z.infer<typeof UpdateBlueprintVariantBodySchema>;

export const BlueprintVariantIdParamSchema = z.object({ id: z.uuid() });
