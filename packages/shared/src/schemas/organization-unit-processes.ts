/**
 * @heuresys/shared — organization-unit ↔ business-process assignment (T2.5) schemas.
 * Backs /v1/organization-unit-processes/* over sys.sys_organization_unit_processes.
 *
 * Associates a tenant-scoped organization unit (sys_organization_units) with a GLOBAL
 * blueprint process step (sys_blueprint_process_registry — the catalog is platform-level,
 * NOT tenant-scoped). The assignment row is OWNED by the org-unit's tenant (I5 = FK +
 * middleware filter, never RLS): two tenants can each independently assign THEIR OU to the
 * SAME global process. org_unit_process_role is RACI-style (RD-08 varchar+CHECK, never ENUM).
 * Zod v4 API (z.uuid()/z.iso.datetime()).
 */
import { z } from "zod";

const META = z.record(z.string(), z.unknown());

export const OrgUnitProcessRoleEnum = z.enum(["OWNER", "CONTRIBUTOR", "CONSULTED", "INFORMED"]);
export type OrgUnitProcessRole = z.infer<typeof OrgUnitProcessRoleEnum>;

/** The base assignment row (returned by create). */
export const OrgUnitProcessSchema = z.object({
  orgUnitProcessId: z.uuid(),
  tenantId: z.uuid(),
  orgUnitId: z.uuid(),
  blueprintProcessId: z.uuid(),
  role: OrgUnitProcessRoleEnum,
  metadata: META,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type OrgUnitProcess = z.infer<typeof OrgUnitProcessSchema>;

export const OrgUnitProcessCreateSchema = z.object({
  ouId: z.uuid(),
  processId: z.uuid(),
  role: OrgUnitProcessRoleEnum.default("OWNER"),
});
export type OrgUnitProcessCreate = z.infer<typeof OrgUnitProcessCreateSchema>;

export const OrgUnitProcessIdParamSchema = z.object({ id: z.uuid() });
export const OrgUnitProcessByOuParamSchema = z.object({ ouId: z.uuid() });
export const OrgUnitProcessByProcessParamSchema = z.object({ processId: z.uuid() });

/** by-ou row: the assignment + the blueprint process/variant it points at. */
export const OrgUnitProcessForOuSchema = z.object({
  orgUnitProcessId: z.uuid(),
  role: OrgUnitProcessRoleEnum,
  blueprintProcessId: z.uuid(),
  blueprintProcessCode: z.string(),
  blueprintProcessName: z.string(),
  blueprintProcessOrdinal: z.number().int(),
  blueprintVariantId: z.uuid(),
  blueprintVariantName: z.string(),
  createdAt: z.iso.datetime(),
});
export type OrgUnitProcessForOu = z.infer<typeof OrgUnitProcessForOuSchema>;
export const OrgUnitProcessesForOuResponseSchema = z.object({
  items: z.array(OrgUnitProcessForOuSchema),
  total: z.number().int().min(0),
});
export type OrgUnitProcessesForOuResponse = z.infer<typeof OrgUnitProcessesForOuResponseSchema>;

/** by-process row: the assignment + the org unit it attaches. */
export const OrgUnitProcessForProcessSchema = z.object({
  orgUnitProcessId: z.uuid(),
  role: OrgUnitProcessRoleEnum,
  orgUnitId: z.uuid(),
  orgUnitCode: z.string(),
  orgUnitName: z.string(),
  blueprintProcessId: z.uuid(),
  blueprintProcessName: z.string(),
  createdAt: z.iso.datetime(),
});
export type OrgUnitProcessForProcess = z.infer<typeof OrgUnitProcessForProcessSchema>;
export const OrgUnitProcessesForProcessResponseSchema = z.object({
  items: z.array(OrgUnitProcessForProcessSchema),
  total: z.number().int().min(0),
});
export type OrgUnitProcessesForProcessResponse = z.infer<typeof OrgUnitProcessesForProcessResponseSchema>;
