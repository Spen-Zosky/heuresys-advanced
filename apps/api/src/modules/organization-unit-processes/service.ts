/**
 * apps/api/src/modules/organization-unit-processes/service.ts
 * T2.5 — org-unit ↔ business-process assignment service.
 *
 * Authorization = the org-unit scope-check (I5): a writer may only assign an OU that is
 * in their tenant scope, and the assignment inherits the OU's tenant. The blueprint
 * catalog is global, so the process is validated for existence only. Reads are
 * tenant-filtered on org_unit_process_tenant_id (PLATFORM_ADMIN cross-tenant).
 */
import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ConflictError } from "../../errors/index.js";
import type {
  OrgUnitProcess,
  OrgUnitProcessRole,
  OrgUnitProcessesForOuResponse,
  OrgUnitProcessesForProcessResponse,
} from "@heuresys/shared";
import * as repo from "./repository.js";

function buildScope(a: ActorContext): repo.ScopeFilter {
  const isPlatform = a.roles.includes("PLATFORM_ADMIN");
  return { isPlatform, tenantId: isPlatform ? null : a.tenantId };
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "23505";
}

const toAssignment = (r: repo.OrgUnitProcessRow): OrgUnitProcess => ({
  ...r,
  role: r.role as OrgUnitProcessRole,
});

export const organizationUnitProcessService = {
  async createAssignment(a: ActorContext, input: { ouId: string; processId: string; role: OrgUnitProcessRole }): Promise<OrgUnitProcess> {
    // The OU must be in the actor's scope (I5) — its tenant owns the assignment.
    const ou = await repo.findOuScoped(pool, buildScope(a), input.ouId);
    if (!ou) throw new NotFoundError("Organization unit");
    const proc = await repo.findProcessById(pool, input.processId);
    if (!proc) throw new NotFoundError("Blueprint process");
    try {
      const row = await repo.insertOrgUnitProcess(pool, {
        tenantId: ou.tenantId,
        orgUnitId: input.ouId,
        blueprintProcessId: input.processId,
        role: input.role,
      });
      return toAssignment(row);
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictError("This org unit is already assigned to that process", "DUPLICATE_OU_PROCESS");
      throw e;
    }
  },

  async deleteAssignment(a: ActorContext, id: string): Promise<void> {
    const ok = await repo.deleteOrgUnitProcess(pool, buildScope(a), id);
    if (!ok) throw new NotFoundError("Org-unit ↔ process assignment");
  },

  async listForOu(a: ActorContext, ouId: string): Promise<OrgUnitProcessesForOuResponse> {
    // Scope-check the parent OU → 404 cross-tenant (no existence leak).
    const ou = await repo.findOuScoped(pool, buildScope(a), ouId);
    if (!ou) throw new NotFoundError("Organization unit");
    const items = await repo.listProcessesForOu(pool, buildScope(a), ouId);
    return {
      items: items.map((r) => ({ ...r, role: r.role as OrgUnitProcessRole })),
      total: items.length,
    };
  },

  async listForProcess(a: ActorContext, processId: string): Promise<OrgUnitProcessesForProcessResponse> {
    const items = await repo.listOusForProcess(pool, buildScope(a), processId);
    return { items: items.map((r) => ({ ...r, role: r.role as OrgUnitProcessRole })), total: items.length };
  },
};
