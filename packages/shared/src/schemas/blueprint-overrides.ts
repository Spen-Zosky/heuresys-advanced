/**
 * packages/shared/src/schemas/blueprint-overrides.ts
 * Per-activation process inclusion overrides. Unique (activation, process).
 */
import { z } from "zod";

export const BLUEPRINT_OVERRIDE_INCLUSION_VALUES = ["IN", "PARTIAL", "OUT"] as const;
export const BlueprintOverrideInclusionSchema = z.enum(BLUEPRINT_OVERRIDE_INCLUSION_VALUES);
export type BlueprintOverrideInclusion = z.infer<typeof BlueprintOverrideInclusionSchema>;

export const BlueprintOverrideSchema = z.object({
  blueprintOverrideId: z.uuid(),
  activationId: z.uuid(),
  processId: z.uuid(),
  inclusion: BlueprintOverrideInclusionSchema,
  rationale: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type BlueprintOverride = z.infer<typeof BlueprintOverrideSchema>;

export const BlueprintOverrideListQuerySchema = z.object({
  activationId: z.uuid().optional(),
  processId: z.uuid().optional(),
  inclusion: BlueprintOverrideInclusionSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type BlueprintOverrideListQuery = z.infer<typeof BlueprintOverrideListQuerySchema>;

export const BlueprintOverrideListResponseSchema = z.object({
  items: z.array(BlueprintOverrideSchema), total: z.number().int().min(0),
});

export const UpsertBlueprintOverrideBodySchema = z.object({
  activationId: z.uuid(),
  processId: z.uuid(),
  inclusion: BlueprintOverrideInclusionSchema.optional().default("IN"),
  rationale: z.string().max(8192).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type UpsertBlueprintOverrideBody = z.infer<typeof UpsertBlueprintOverrideBodySchema>;

export const BlueprintOverrideIdParamSchema = z.object({ id: z.uuid() });
