/**
 * apps/api/src/modules/visualization-exports/service.ts
 * Append-only export record (the actual rendering happens elsewhere).
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError } from "../../errors/index.js";
import type { VizExport, VizExportListQuery, CreateVizExportBody, VizGraph } from "@heuresys/shared";
import * as repo from "./repository.js";
import { findGraphById } from "../visualization-graphs/repository.js";
import { findLayoutById } from "../visualization-layouts/repository.js";

function graphVisible(a: ActorContext, g: VizGraph): boolean {
  if (isPlatform(a)) return true;
  return a.tenantId !== null && g.tenantId === a.tenantId;
}
async function ensureGraphVisible(actor: ActorContext, graphId: string): Promise<VizGraph> {
  const g = await findGraphById(pool, graphId);
  if (!g || !graphVisible(actor, g)) throw new NotFoundError("VizGraph");
  return g;
}

export const visualizationExportsService = {
  async list(actor: ActorContext, query: VizExportListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listExports(pool, { tenantId, query });
  },
  async getById(actor: ActorContext, id: string): Promise<VizExport> {
    const t = await repo.findExportById(pool, id);
    if (!t) throw new NotFoundError("VizExport");
    await ensureGraphVisible(actor, t.graphId);
    return t;
  },
  async create(actor: ActorContext, body: CreateVizExportBody): Promise<VizExport> {
    await ensureGraphVisible(actor, body.graphId);
    if (body.layoutId) {
      const l = await findLayoutById(pool, body.layoutId);
      if (!l || l.graphId !== body.graphId) throw new NotFoundError("VizLayout");
    }
    return repo.insertExport(pool, body);
  },
};
