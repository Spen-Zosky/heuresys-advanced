/**
 * packages/shared/src/schemas/platform-tenant-assignments.ts
 *
 * Mandato K, R-0 (D9=B, 2026-09-14): quali clienti un utente di piattaforma ASSEGNATO
 * (un ruolo in `PLATFORM_ASSIGNED_MANDATE_ROLES` — oggi vuoto, lo popolano R-9/R-8/R-5) può
 * vedere. Assenza di riga = nessun cliente, non tutti. `PLATFORM_ADMIN` non passa da qui: il
 * suo perimetro resta senza filtro (`perimetroClienti`, apps/api/src/lib/actor.ts).
 *
 * Governato dal solo `PLATFORM_ADMIN` oggi (`platform_tenant_assignment:manage`, mig `000421`):
 * non è un dato di cliente, è infrastruttura di governo cross-tenant.
 */
import { z } from "zod";
import { paginationFields } from "./_pagination.js";
import { queryBoolean } from "./_query-boolean.js";

export const PlatformTenantAssignmentSchema = z.object({
  assignmentId: z.uuid(),
  userId: z.uuid(),
  tenantId: z.uuid(),
  assignedAt: z.iso.datetime(),
  assignedBy: z.uuid().nullable(),
  /** `null` = assegnazione attiva. Ritirare = valorizzare questo campo, mai cancellare la riga. */
  revokedAt: z.iso.datetime().nullable(),
});
export type PlatformTenantAssignment = z.infer<typeof PlatformTenantAssignmentSchema>;

export const CreatePlatformTenantAssignmentBodySchema = z.object({
  userId: z.uuid(),
  tenantId: z.uuid(),
});
export type CreatePlatformTenantAssignmentBody = z.infer<
  typeof CreatePlatformTenantAssignmentBodySchema
>;

export const PlatformTenantAssignmentListQuerySchema = z.object({
  userId: z.uuid().optional(),
  tenantId: z.uuid().optional(),
  /** Default true: le revocate sono storia, non l'elenco operativo. */
  activeOnly: queryBoolean().optional().default(true),
  ...paginationFields(200, 50),
});
export type PlatformTenantAssignmentListQuery = z.infer<
  typeof PlatformTenantAssignmentListQuerySchema
>;

export const PlatformTenantAssignmentListResponseSchema = z.object({
  items: z.array(PlatformTenantAssignmentSchema),
  total: z.number().int().min(0),
});
export type PlatformTenantAssignmentListResponse = z.infer<
  typeof PlatformTenantAssignmentListResponseSchema
>;

export const PlatformTenantAssignmentIdParamSchema = z.object({ id: z.uuid() });
