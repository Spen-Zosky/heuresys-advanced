/**
 * packages/shared/src/schemas/organization-units.ts
 * Schemas for /v1/organization-units/* (sys.sys_organization_units).
 */

import { z } from "zod";

export const OrganizationUnitSchema = z.object({
  organizationUnitId: z.uuid(),
  tenantId: z.uuid(),
  code: z.string(),
  name: z.string(),
  typeId: z.uuid().nullable(),
  type: z.string().nullable(),
  parentId: z.uuid().nullable(),
  managerUserId: z.uuid().nullable(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable(),
  isActive: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type OrganizationUnit = z.infer<typeof OrganizationUnitSchema>;

export const OrganizationUnitListQuerySchema = z.object({
  isActive: z.coerce.boolean().optional(),
  parentId: z.uuid().optional(),
  managerUserId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type OrganizationUnitListQuery = z.infer<typeof OrganizationUnitListQuerySchema>;

export const OrganizationUnitListResponseSchema = z.object({
  items: z.array(OrganizationUnitSchema),
  total: z.number().int().min(0),
});

export const CreateOrganizationUnitBodySchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  tenantId: z.uuid().optional(),
  typeId: z.uuid().nullable().optional(),
  type: z.string().max(64).nullable().optional(),
  parentId: z.uuid().nullable().optional(),
  managerUserId: z.uuid().nullable().optional(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().nullable().optional(),
  isActive: z.boolean().optional().default(true),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateOrganizationUnitBody = z.infer<typeof CreateOrganizationUnitBodySchema>;

export const UpdateOrganizationUnitBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  typeId: z.uuid().nullable().optional(),
  type: z.string().max(64).nullable().optional(),
  parentId: z.uuid().nullable().optional(),
  managerUserId: z.uuid().nullable().optional(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateOrganizationUnitBody = z.infer<typeof UpdateOrganizationUnitBodySchema>;

export const OrganizationUnitIdParamSchema = z.object({ id: z.uuid() });
