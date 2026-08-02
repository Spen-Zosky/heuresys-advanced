/**
 * apps/api/src/modules/visualization-graphs/service.ts
 * Tenant-scoped. Unique (tenant, code, version) — version defaults to 1 on insert.
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type {
  VizGraph, VizGraphListQuery, CreateVizGraphBody, UpdateVizGraphBody,
  VizGraphSummaryResponse, VizGraphRenderResponse,
  CreateVizGraphVersionBody, VizGraphVersionResponse, VizGraphVersionListResponse,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { withTransaction } from "../../db/client.js";

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
  /** Tutte le versioni del grafo, dalla più recente — alimenta il selettore. */
  async listVersions(actor: ActorContext, id: string): Promise<VizGraphVersionListResponse> {
    const t = await repo.findGraphById(pool, id);
    if (!t || !visible(actor, t)) throw new NotFoundError("VizGraph");
    const items = await repo.listGraphVersions(pool, t.tenantId, t.code);
    return { items, total: items.length };
  },

  /**
   * Crea la versione successiva del grafo (#36 B5).
   *
   * `graph_version` esisteva a schema dal primo giorno, con l'unicità su
   * (tenant, code, version), ma nessun endpoint la incrementava mai: ogni grafo
   * restava a v1 per sempre. Qui la nuova versione nasce come copia
   * indipendente — nodi, archi e, a richiesta, i layout con le posizioni — così
   * la versione precedente resta consultabile esattamente com'era.
   *
   * Tutto dentro UNA transazione: una versione a metà (grafo senza nodi, o con
   * nodi e senza archi) sarebbe peggio di nessuna versione.
   */
  async createVersion(
    actor: ActorContext, id: string, body: CreateVizGraphVersionBody,
  ): Promise<VizGraphVersionResponse> {
    const source = await repo.findGraphById(pool, id);
    if (!source || !visible(actor, source)) throw new NotFoundError("VizGraph");

    return withTransaction(async (client) => {
      const nextVersion = (await repo.maxGraphVersion(client, source.tenantId, source.code)) + 1;
      const graph = await repo.insertGraphVersion(
        client, source, nextVersion,
        {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
        },
        actor.userId,
      );

      if (!body.copyContent) {
        return { graph, copiedNodes: 0, copiedEdges: 0, copiedLayouts: 0, copiedNodePositions: 0 };
      }
      const content = await repo.copyGraphContent(client, source.graphId, graph.graphId);
      const layouts = body.copyLayouts
        ? await repo.copyGraphLayouts(client, source.graphId, graph.graphId, content.nodeIdMap)
        : { copiedLayouts: 0, copiedNodePositions: 0 };

      return {
        graph,
        copiedNodes: content.copiedNodes,
        copiedEdges: content.copiedEdges,
        copiedLayouts: layouts.copiedLayouts,
        copiedNodePositions: layouts.copiedNodePositions,
      };
    });
  },

  async delete(actor: ActorContext, id: string): Promise<void> {
    const t = await repo.findGraphById(pool, id);
    if (!t || !visible(actor, t)) throw new NotFoundError("VizGraph");
    const ok = await repo.deleteGraph(pool, id);
    if (!ok) throw new NotFoundError("VizGraph");
  },
};
