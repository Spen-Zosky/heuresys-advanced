/**
 * apps/api/src/modules/processes/service.ts
 *
 * I processi del tenant e la loro scheda (V4). Visibilità solo-tenant (I5): un mandato di
 * piattaforma vede tutti i tenant; un processo fuori dal proprio tenant risponde 404, senza dire
 * che esiste.
 */
import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import { NotFoundError } from "../../errors/index.js";
import type { TenantProcessListQuery, TenantProcessListResponse, TenantProcessScheda } from "@heuresys/shared";
import * as repo from "./repository.js";

const tenantDi = (a: ActorContext): string | null => (a.roles.includes("PLATFORM_ADMIN") ? null : a.tenantId);

export const processService = {
  async list(a: ActorContext, q: TenantProcessListQuery): Promise<TenantProcessListResponse> {
    const items = await repo.listProcesses(pool, tenantDi(a), q);
    return { items, total: items.length };
  },

  async scheda(a: ActorContext, id: string): Promise<TenantProcessScheda> {
    const process = await repo.findProcess(pool, tenantDi(a), id);
    if (!process) throw new NotFoundError("Process");
    const tenantId = process.tenantId;
    const subprocesses = process.level === 1 ? await repo.listProcesses(pool, tenantId, { parentId: process.processId }) : [];
    const ids = [process.processId, ...subprocesses.map((s) => s.processId)];
    const [activities, units, modelli, approvals, projects] = await Promise.all([
      repo.loadActivities(pool, ids),
      repo.loadUnits(pool, tenantId, ids),
      repo.modelProcessIds(pool, ids),
      repo.countApprovals(pool, tenantId, ids),
      repo.loadProjects(pool, tenantId, ids),
    ]);
    const posizioni = [...new Set(activities.map((x) => x.executorPositionId).filter((x): x is string => x !== null))];
    const [kpis, skills] = await Promise.all([repo.loadKpis(pool, tenantId, modelli), repo.loadSkills(pool, tenantId, posizioni)]);
    return { process, subprocesses, activities, units, kpis, skills, approvals, projects };
  },
};
