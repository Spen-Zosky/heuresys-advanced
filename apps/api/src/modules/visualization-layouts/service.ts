/**
 * apps/api/src/modules/visualization-layouts/service.ts
 */
import { pool } from "../../db/client.js";
import { NotFoundError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type {
  VizLayout, VizLayoutListQuery, CreateVizLayoutBody, UpdateVizLayoutBody, VizGraph,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { findGraphById } from "../visualization-graphs/repository.js";

export interface ActorContext { userId: string; tenantId: string | null; roles: RoleCode[] }
function isPlatform(a: ActorContext): boolean { return a.roles.includes("PLATFORM_ADMIN"); }
function graphVisible(a: ActorContext, g: VizGraph): boolean {
  if (isPlatform(a)) return true;
  return a.tenantId !== null && g.tenantId === a.tenantId;
}
async function ensureGraphVisible(actor: ActorContext, graphId: string): Promise<VizGraph> {
  const g = await findGraphById(pool, graphId);
  if (!g || !graphVisible(actor, g)) throw new NotFoundError("VizGraph");
  return g;
}

export const visualizationLayoutsService = {
  async list(actor: ActorContext, query: VizLayoutListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listLayouts(pool, { tenantId, query });
  },
  async getById(actor: ActorContext, id: string): Promise<VizLayout> {
    const t = await repo.findLayoutById(pool, id);
    if (!t) throw new NotFoundError("VizLayout");
    await ensureGraphVisible(actor, t.graphId);
    return t;
  },
  async create(actor: ActorContext, body: CreateVizLayoutBody): Promise<VizLayout> {
    await ensureGraphVisible(actor, body.graphId);
    return repo.insertLayout(pool, body);
  },
  async update(actor: ActorContext, id: string, patch: UpdateVizLayoutBody): Promise<VizLayout> {
    const t = await repo.findLayoutById(pool, id);
    if (!t) throw new NotFoundError("VizLayout");
    await ensureGraphVisible(actor, t.graphId);
    const u = await repo.updateLayoutPartial(pool, id, patch);
    if (!u) throw new NotFoundError("VizLayout");
    return u;
  },
  async delete(actor: ActorContext, id: string): Promise<void> {
    const t = await repo.findLayoutById(pool, id);
    if (!t) throw new NotFoundError("VizLayout");
    await ensureGraphVisible(actor, t.graphId);
    const ok = await repo.deleteLayout(pool, id);
    if (!ok) throw new NotFoundError("VizLayout");
  },
};
