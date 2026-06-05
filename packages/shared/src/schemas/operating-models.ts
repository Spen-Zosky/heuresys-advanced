/**
 * packages/shared/src/schemas/operating-models.ts
 */
import { z } from "zod";

export const OperatingModelSchema = z.object({
  operatingModelId: z.uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type OperatingModel = z.infer<typeof OperatingModelSchema>;

export const OperatingModelListResponseSchema = z.object({
  items: z.array(OperatingModelSchema), total: z.number().int().min(0),
});

export const UpsertOperatingModelBodySchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  description: z.string().max(4096).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type UpsertOperatingModelBody = z.infer<typeof UpsertOperatingModelBodySchema>;

export const OperatingModelIdParamSchema = z.object({ id: z.uuid() });
