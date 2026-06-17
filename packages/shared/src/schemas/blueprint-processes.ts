/**
 * packages/shared/src/schemas/blueprint-processes.ts
 * Process registry rows scoped to a blueprint variant.
 * Unique (variant_id, code).
 */
import { z } from "zod";

import { paginationFields } from "./_pagination.js";
export const BlueprintProcessSchema = z.object({
  blueprintProcessId: z.uuid(),
  variantId: z.uuid(),
  code: z.string(),
  name: z.string(),
  ordinal: z.number().int(),
  description: z.string().nullable(),
  isOptional: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type BlueprintProcess = z.infer<typeof BlueprintProcessSchema>;

export const BlueprintProcessListQuerySchema = z.object({
  variantId: z.uuid().optional(),
  isOptional: z.coerce.boolean().optional(),
  ...paginationFields(500, 100),
});
export type BlueprintProcessListQuery = z.infer<typeof BlueprintProcessListQuerySchema>;

export const BlueprintProcessListResponseSchema = z.object({
  items: z.array(BlueprintProcessSchema), total: z.number().int().min(0),
});

export const CreateBlueprintProcessBodySchema = z.object({
  variantId: z.uuid(),
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  ordinal: z.number().int().min(0).max(32767),
  description: z.string().max(4096).nullable().optional(),
  isOptional: z.boolean().optional().default(false),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateBlueprintProcessBody = z.infer<typeof CreateBlueprintProcessBodySchema>;

export const UpdateBlueprintProcessBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  ordinal: z.number().int().min(0).max(32767).optional(),
  description: z.string().max(4096).nullable().optional(),
  isOptional: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateBlueprintProcessBody = z.infer<typeof UpdateBlueprintProcessBodySchema>;

export const BlueprintProcessIdParamSchema = z.object({ id: z.uuid() });
