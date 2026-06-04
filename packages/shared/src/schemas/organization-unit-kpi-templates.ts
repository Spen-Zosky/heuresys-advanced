/**
 * packages/shared/src/schemas/organization-unit-kpi-templates.ts
 * Tenant-scoped junction: org unit ↔ KPI with weight + target.
 */
import { z } from "zod";

export const OrganizationUnitKpiTemplateSchema = z.object({
  organizationUnitKpiTemplateId: z.string().uuid(),
  // Dual-mode (D4 C(i)): a row is keyed EITHER on a real org-unit INSTANCE (unitId + tenantId,
  // tenant-scoped junction) OR on a global org-unit TEMPLATE (unitTemplateId, tenant-less blueprint)
  // — enforced by the XOR CHECK. Hence unitId/tenantId are null on template-keyed rows.
  unitId: z.string().uuid().nullable(),
  unitTemplateId: z.string().uuid().nullable(),
  kpiId: z.string().uuid(),
  tenantId: z.string().uuid().nullable(),
  weight: z.number(),
  target: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type OrganizationUnitKpiTemplate = z.infer<typeof OrganizationUnitKpiTemplateSchema>;

export const OrganizationUnitKpiTemplateListQuerySchema = z.object({
  unitId: z.string().uuid().optional(),
  kpiId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type OrganizationUnitKpiTemplateListQuery = z.infer<typeof OrganizationUnitKpiTemplateListQuerySchema>;

export const OrganizationUnitKpiTemplateListResponseSchema = z.object({
  items: z.array(OrganizationUnitKpiTemplateSchema), total: z.number().int().min(0),
});

export const UpsertOrganizationUnitKpiTemplateBodySchema = z.object({
  unitId: z.string().uuid(),
  kpiId: z.string().uuid(),
  weight: z.number().min(0).max(1).optional().default(1.0),
  target: z.record(z.string(), z.unknown()).optional().default({}),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type UpsertOrganizationUnitKpiTemplateBody = z.infer<typeof UpsertOrganizationUnitKpiTemplateBodySchema>;

export const OrganizationUnitKpiTemplateIdParamSchema = z.object({ id: z.string().uuid() });
