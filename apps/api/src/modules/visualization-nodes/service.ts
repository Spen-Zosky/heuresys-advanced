/**
 * apps/api/src/modules/visualization-nodes/service.ts
 * Tenant inherited from parent graph.
 */
import { pool } from "../../db/client.js";
import { NotFoundError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type { VizNode, VizNodeListQuery, CreateVizNodeBody, UpdateVizNodeBody, VizGraph } from "@heuresys/shared";
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

export const visualizationNodesService = {
  async list(actor: ActorContext, query: VizNodeListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listNodes(pool, { tenantId, query });
  },
  async getById(actor: ActorContext, id: string): Promise<VizNode> {
    const t = await repo.findNodeById(pool, id);
    if (!t) throw new NotFoundError("VizNode");
    const g = await findGraphById(pool, t.graphId);
    if (!g || !graphVisible(actor, g)) throw new NotFoundError("VizNode");
    return t;
  },
  async create(actor: ActorContext, body: CreateVizNodeBody): Promise<VizNode> {
    await ensureGraphVisible(actor, body.graphId);
    return repo.insertNode(pool, body);
  },
  async update(actor: ActorContext, id: string, patch: UpdateVizNodeBody): Promise<VizNode> {
    const t = await repo.findNodeById(pool, id);
    if (!t) throw new NotFoundError("VizNode");
    await ensureGraphVisible(actor, t.graphId);
    const u = await repo.updateNodePartial(pool, id, patch);
    if (!u) throw new NotFoundError("VizNode");
    return u;
  },
  async delete(actor: ActorContext, id: string): Promise<void> {
    const t = await repo.findNodeById(pool, id);
    if (!t) throw new NotFoundError("VizNode");
    await ensureGraphVisible(actor, t.graphId);
    const ok = await repo.deleteNode(pool, id);
    if (!ok) throw new NotFoundError("VizNode");
  },
};
