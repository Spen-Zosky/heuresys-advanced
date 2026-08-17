/**
 * packages/shared/src/schemas/organization-units.ts
 * Schemas for /v1/organization-units/* (sys.sys_organization_units).
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";
import { queryBoolean } from "./_query-boolean.js";
export const OrganizationUnitSchema = z.object({
  organizationUnitId: z.uuid(),
  tenantId: z.uuid(),
  code: z.string(),
  name: z.string(),
  typeId: z.uuid().nullable(),
  type: z.string().nullable(),
  // Il tipo di legame col padre: LINEA (catena di comando) o STAFF (funzione che
  // riporta al vertice senza essere nella linea). Introdotto dalla migrazione 000244
  // e popolato su tutte le unita; esposto qui perche' il cancello di esposizione
  // (#79) ha misurato che nessun modulo API lo leggeva — un dato che nessuna API
  // espone non e' nel prodotto. Serve all'asse organizzativo di ADR-0027: e' il
  // legame che dice dove il perimetro di un responsabile si ferma.
  relation: z.enum(["LINEA", "STAFF"]).nullable(),
  parentId: z.uuid().nullable(),
  parentName: z.string().nullable(), // G-02: parent OU name, resolved on the list endpoint
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
  isActive: queryBoolean().optional(),
  parentId: z.uuid().optional(),
  managerUserId: z.uuid().optional(),
  ...paginationFields(200, 50),
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
