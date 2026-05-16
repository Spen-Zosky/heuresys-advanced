/**
 * apps/api/src/modules/process-kpi-templates/service.ts
 * PLATFORM_ADMIN only for writes (catalog-level).
 */
import { pool } from "../../db/client.js";
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type { ProcessKpiTemplate, ProcessKpiTemplateListQuery, UpsertProcessKpiTemplateBody } from "@heuresys/shared";
import * as repo from "./repository.js";

export interface ActorContext { userId: string; tenantId: string | null; roles: RoleCode[] }
function isPlatform(a: ActorContext): boolean { return a.roles.includes("PLATFORM_ADMIN"); }

export const processKpiTemplatesService = {
  async list(_actor: ActorContext, query: ProcessKpiTemplateListQuery) {
    return repo.listTemplates(pool, query);
  },
  async getById(_actor: ActorContext, id: string): Promise<ProcessKpiTemplate> {
    const t = await repo.findTemplateById(pool, id);
    if (!t) throw new NotFoundError("ProcessKpiTemplate");
    return t;
  },
  async upsert(actor: ActorContext, body: UpsertProcessKpiTemplateBody): Promise<ProcessKpiTemplate> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    if (!(await repo.processExists(pool, body.processId))) throw new NotFoundError("BlueprintProcess");
    if (!(await repo.kpiExists(pool, body.kpiId))) throw new NotFoundError("KpiDefinition");
    return repo.upsertTemplate(pool, body);
  },
  async delete(actor: ActorContext, id: string): Promise<void> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    const ok = await repo.deleteTemplate(pool, id);
    if (!ok) throw new NotFoundError("ProcessKpiTemplate");
  },
};
