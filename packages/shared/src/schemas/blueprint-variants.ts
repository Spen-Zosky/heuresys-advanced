/**
 * packages/shared/src/schemas/blueprint-variants.ts
 */
import { z } from "zod";

export const BlueprintVariantSchema = z.object({
  blueprintVariantId: z.string().uuid(),
  familyId: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  sizeBandId: z.string().uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type BlueprintVariant = z.infer<typeof BlueprintVariantSchema>;

export const BlueprintVariantListQuerySchema = z.object({
  familyId: z.string().uuid().optional(),
  sizeBandId: z.string().uuid().optional(),
  search: z.string().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type BlueprintVariantListQuery = z.infer<typeof BlueprintVariantListQuerySchema>;

export const BlueprintVariantListResponseSchema = z.object({
  items: z.array(BlueprintVariantSchema), total: z.number().int().min(0),
});

export const CreateBlueprintVariantBodySchema = z.object({
  familyId: z.string().uuid(),
  code: z.string().min(1).max(128),
  name: z.string().min(1).max(255),
  description: z.string().max(4096).nullable().optional(),
  sizeBandId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateBlueprintVariantBody = z.infer<typeof CreateBlueprintVariantBodySchema>;

export const UpdateBlueprintVariantBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(4096).nullable().optional(),
  sizeBandId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateBlueprintVariantBody = z.infer<typeof UpdateBlueprintVariantBodySchema>;

export const BlueprintVariantIdParamSchema = z.object({ id: z.string().uuid() });
