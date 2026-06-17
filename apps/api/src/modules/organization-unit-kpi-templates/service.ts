/**
 * apps/api/src/modules/organization-unit-kpi-templates/service.ts
 * Tenant inherited from org unit. KPI must be visible to tenant.
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type {
  OrganizationUnitKpiTemplate, OrganizationUnitKpiTemplateListQuery,
  UpsertOrganizationUnitKpiTemplateBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

function visible(a: ActorContext, t: OrganizationUnitKpiTemplate): boolean {
  if (isPlatform(a)) return true;
  return a.tenantId !== null && t.tenantId === a.tenantId;
}

export const organizationUnitKpiTemplatesService = {
  async list(actor: ActorContext, query: OrganizationUnitKpiTemplateListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listTemplates(pool, { tenantId, query });
  },
  async getById(actor: ActorContext, id: string): Promise<OrganizationUnitKpiTemplate> {
    const t = await repo.findTemplateById(pool, id);
    if (!t || !visible(actor, t)) throw new NotFoundError("OrganizationUnitKpiTemplate");
    return t;
  },
  async upsert(actor: ActorContext, body: UpsertOrganizationUnitKpiTemplateBody): Promise<OrganizationUnitKpiTemplate> {
    const unitTenant = await repo.getUnitTenant(pool, body.unitId);
    if (!unitTenant) throw new NotFoundError("OrganizationUnit");
    if (!isPlatform(actor)) {
      if (!actor.tenantId || unitTenant !== actor.tenantId) {
        throw new ForbiddenError("Unit not in actor tenant", "UNIT_NOT_IN_TENANT");
      }
    }
    if (!(await repo.kpiVisibleToTenant(pool, body.kpiId, unitTenant))) {
      throw new NotFoundError("KpiDefinition");
    }
    return repo.upsertTemplate(pool, unitTenant, body);
  },
  async delete(actor: ActorContext, id: string): Promise<void> {
    const t = await repo.findTemplateById(pool, id);
    if (!t || !visible(actor, t)) throw new NotFoundError("OrganizationUnitKpiTemplate");
    const ok = await repo.deleteTemplate(pool, id);
    if (!ok) throw new NotFoundError("OrganizationUnitKpiTemplate");
  },
};
