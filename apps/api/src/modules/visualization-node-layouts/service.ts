/**
 * apps/api/src/modules/visualization-node-layouts/service.ts
 * Upsert by (layout, node). Both must belong to same graph.
 */
import { pool } from "../../db/client.js";
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type {
  VizNodeLayout, VizNodeLayoutListQuery, UpsertVizNodeLayoutBody, VizGraph,
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

export const visualizationNodeLayoutsService = {
  async list(actor: ActorContext, query: VizNodeLayoutListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listNodeLayouts(pool, { tenantId, query });
  },
  async getById(actor: ActorContext, id: string): Promise<VizNodeLayout> {
    const t = await repo.findNodeLayoutById(pool, id);
    if (!t) throw new NotFoundError("VizNodeLayout");
    const layoutGraph = await repo.getLayoutGraph(pool, t.layoutId);
    if (!layoutGraph) throw new NotFoundError("VizNodeLayout");
    await ensureGraphVisible(actor, layoutGraph);
    return t;
  },
  async upsert(actor: ActorContext, body: UpsertVizNodeLayoutBody): Promise<VizNodeLayout> {
    const layoutGraph = await repo.getLayoutGraph(pool, body.layoutId);
    if (!layoutGraph) throw new NotFoundError("VizLayout");
    await ensureGraphVisible(actor, layoutGraph);
    const nodeGraph = await repo.getNodeGraph(pool, body.nodeId);
    if (!nodeGraph) throw new NotFoundError("VizNode");
    if (nodeGraph !== layoutGraph) {
      throw new ForbiddenError("Node and layout belong to different graphs", "NODE_LAYOUT_GRAPH_MISMATCH");
    }
    return repo.upsertNodeLayout(pool, body);
  },
  async delete(actor: ActorContext, id: string): Promise<void> {
    const t = await repo.findNodeLayoutById(pool, id);
    if (!t) throw new NotFoundError("VizNodeLayout");
    const layoutGraph = await repo.getLayoutGraph(pool, t.layoutId);
    if (!layoutGraph) throw new NotFoundError("VizNodeLayout");
    await ensureGraphVisible(actor, layoutGraph);
    const ok = await repo.deleteNodeLayout(pool, id);
    if (!ok) throw new NotFoundError("VizNodeLayout");
  },
};
