/**
 * apps/api/src/modules/visualization-edges/service.ts
 * Source + target nodes must belong to the same graph as body.graphId.
 */
import { pool } from "../../db/client.js";
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type { VizEdge, VizEdgeListQuery, CreateVizEdgeBody, VizGraph } from "@heuresys/shared";
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

export const visualizationEdgesService = {
  async list(actor: ActorContext, query: VizEdgeListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listEdges(pool, { tenantId, query });
  },
  async getById(actor: ActorContext, id: string): Promise<VizEdge> {
    const t = await repo.findEdgeById(pool, id);
    if (!t) throw new NotFoundError("VizEdge");
    await ensureGraphVisible(actor, t.graphId);
    return t;
  },
  async create(actor: ActorContext, body: CreateVizEdgeBody): Promise<VizEdge> {
    await ensureGraphVisible(actor, body.graphId);
    const srcGraph = await repo.getNodeGraph(pool, body.sourceNodeId);
    if (!srcGraph) throw new NotFoundError("VizNode");
    if (srcGraph !== body.graphId) {
      throw new ForbiddenError("Source node not in graph", "EDGE_NODE_GRAPH_MISMATCH");
    }
    const tgtGraph = await repo.getNodeGraph(pool, body.targetNodeId);
    if (!tgtGraph) throw new NotFoundError("VizNode");
    if (tgtGraph !== body.graphId) {
      throw new ForbiddenError("Target node not in graph", "EDGE_NODE_GRAPH_MISMATCH");
    }
    return repo.insertEdge(pool, body);
  },
  async delete(actor: ActorContext, id: string): Promise<void> {
    const t = await repo.findEdgeById(pool, id);
    if (!t) throw new NotFoundError("VizEdge");
    await ensureGraphVisible(actor, t.graphId);
    const ok = await repo.deleteEdge(pool, id);
    if (!ok) throw new NotFoundError("VizEdge");
  },
};
