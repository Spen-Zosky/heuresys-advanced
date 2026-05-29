/**
 * apps/api/src/modules/visualization-graphs/service.ts
 * Tenant-scoped. Unique (tenant, code, version) — version defaults to 1 on insert.
 */
import { pool } from "../../db/client.js";
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type { VizGraph, VizGraphListQuery, CreateVizGraphBody, UpdateVizGraphBody, VizGraphSummaryResponse, VizGraphRenderResponse } from "@heuresys/shared";
import * as repo from "./repository.js";

export interface ActorContext { userId: string; tenantId: string | null; roles: RoleCode[] }

function isPlatform(a: ActorContext): boolean { return a.roles.includes("PLATFORM_ADMIN"); }
function visible(a: ActorContext, g: VizGraph): boolean {
  if (isPlatform(a)) return true;
  return a.tenantId !== null && g.tenantId === a.tenantId;
}

export const visualizationGraphsService = {
  async list(actor: ActorContext, query: VizGraphListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listGraphs(pool, { tenantId, query });
  },
  async typeSummary(actor: ActorContext): Promise<VizGraphSummaryResponse> {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.getTypeDistribution(pool, tenantId);
  },
  async getRender(actor: ActorContext, id: string): Promise<VizGraphRenderResponse> {
    const t = await repo.findGraphById(pool, id);
    if (!t || !visible(actor, t)) throw new NotFoundError("VizGraph");
    const r = await repo.findGraphRender(pool, id);
    if (!r) throw new NotFoundError("VizGraph");
    return r;
  },
  async getById(actor: ActorContext, id: string): Promise<VizGraph> {
    const t = await repo.findGraphById(pool, id);
    if (!t || !visible(actor, t)) throw new NotFoundError("VizGraph");
    return t;
  },
  async create(actor: ActorContext, body: CreateVizGraphBody): Promise<VizGraph> {
    let tenantId: string;
    if (isPlatform(actor)) {
      const c = body.tenantId ?? actor.tenantId;
      if (!c) throw new ForbiddenError("PLATFORM_ADMIN must supply body.tenantId", "TENANT_ID_REQUIRED");
      tenantId = c;
    } else {
      if (!actor.tenantId) throw new ForbiddenError("Tenant context required");
      tenantId = actor.tenantId;
    }
    const dup = await repo.findGraphByCodeVersion(pool, tenantId, body.code, 1);
    if (dup) throw new ConflictError(
      `Visualization graph '${body.code}' v1 already exists`, "VIZ_GRAPH_CODE_CONFLICT",
    );
    return repo.insertGraph(pool, tenantId, body, actor.userId);
  },
  async update(actor: ActorContext, id: string, patch: UpdateVizGraphBody): Promise<VizGraph> {
    const t = await repo.findGraphById(pool, id);
    if (!t || !visible(actor, t)) throw new NotFoundError("VizGraph");
    const u = await repo.updateGraphPartial(pool, id, patch, actor.userId);
    if (!u) throw new NotFoundError("VizGraph");
    return u;
  },
  async delete(actor: ActorContext, id: string): Promise<void> {
    const t = await repo.findGraphById(pool, id);
    if (!t || !visible(actor, t)) throw new NotFoundError("VizGraph");
    const ok = await repo.deleteGraph(pool, id);
    if (!ok) throw new NotFoundError("VizGraph");
  },
};
