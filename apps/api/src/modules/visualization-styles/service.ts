/**
 * apps/api/src/modules/visualization-styles/service.ts
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError } from "../../errors/index.js";
import type { VizStyle, VizStyleListQuery, CreateVizStyleBody, VizGraph } from "@heuresys/shared";
import * as repo from "./repository.js";
import { findGraphById } from "../visualization-graphs/repository.js";

function graphVisible(a: ActorContext, g: VizGraph): boolean {
  if (isPlatform(a)) return true;
  return a.tenantId !== null && g.tenantId === a.tenantId;
}
async function ensureGraphVisible(actor: ActorContext, graphId: string): Promise<VizGraph> {
  const g = await findGraphById(pool, graphId);
  if (!g || !graphVisible(actor, g)) throw new NotFoundError("VizGraph");
  return g;
}

export const visualizationStylesService = {
  async list(actor: ActorContext, query: VizStyleListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listStyles(pool, { tenantId, query });
  },
  async getById(actor: ActorContext, id: string): Promise<VizStyle> {
    const t = await repo.findStyleById(pool, id);
    if (!t) throw new NotFoundError("VizStyle");
    await ensureGraphVisible(actor, t.graphId);
    return t;
  },
  async create(actor: ActorContext, body: CreateVizStyleBody): Promise<VizStyle> {
    await ensureGraphVisible(actor, body.graphId);
    return repo.insertStyle(pool, body);
  },
  async delete(actor: ActorContext, id: string): Promise<void> {
    const t = await repo.findStyleById(pool, id);
    if (!t) throw new NotFoundError("VizStyle");
    await ensureGraphVisible(actor, t.graphId);
    const ok = await repo.deleteStyle(pool, id);
    if (!ok) throw new NotFoundError("VizStyle");
  },
};
