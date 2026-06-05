/**
 * packages/shared/src/schemas/blueprint-activations.ts
 * Per-tenant activation of a blueprint variant. Only one ACTIVE per tenant.
 */
import { z } from "zod";

export const BLUEPRINT_ACTIVATION_STATUS_VALUES = ["PROPOSED", "ACTIVE", "SUSPENDED", "RETIRED"] as const;
export const BlueprintActivationStatusSchema = z.enum(BLUEPRINT_ACTIVATION_STATUS_VALUES);
export type BlueprintActivationStatus = z.infer<typeof BlueprintActivationStatusSchema>;

const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const BlueprintActivationSchema = z.object({
  blueprintActivationId: z.uuid(),
  tenantId: z.uuid(),
  variantId: z.uuid(),
  status: BlueprintActivationStatusSchema,
  effectiveFrom: DateOnlySchema,
  effectiveTo: DateOnlySchema.nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type BlueprintActivation = z.infer<typeof BlueprintActivationSchema>;

export const BlueprintActivationListQuerySchema = z.object({
  variantId: z.uuid().optional(),
  status: BlueprintActivationStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type BlueprintActivationListQuery = z.infer<typeof BlueprintActivationListQuerySchema>;

export const BlueprintActivationListResponseSchema = z.object({
  items: z.array(BlueprintActivationSchema), total: z.number().int().min(0),
});

export const CreateBlueprintActivationBodySchema = z.object({
  variantId: z.uuid(),
  status: BlueprintActivationStatusSchema.optional().default("PROPOSED"),
  effectiveFrom: DateOnlySchema.optional(),
  effectiveTo: DateOnlySchema.nullable().optional(),
  tenantId: z.uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateBlueprintActivationBody = z.infer<typeof CreateBlueprintActivationBodySchema>;

export const UpdateBlueprintActivationBodySchema = z.object({
  status: BlueprintActivationStatusSchema.optional(),
  effectiveFrom: DateOnlySchema.optional(),
  effectiveTo: DateOnlySchema.nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateBlueprintActivationBody = z.infer<typeof UpdateBlueprintActivationBodySchema>;

export const BlueprintActivationIdParamSchema = z.object({ id: z.uuid() });
