/**
 * apps/api/src/modules/visualization-exports/service.ts
 * Append-only export record (the actual rendering happens elsewhere).
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ConflictError } from "../../errors/index.js";
import type { VizExport, VizExportListQuery, CreateVizExportBody, VizGraph } from "@heuresys/shared";
import * as repo from "./repository.js";
import { findGraphById, findGraphRender } from "../visualization-graphs/repository.js";
import { findLayoutById } from "../visualization-layouts/repository.js";
import { listAllPositionsForLayout } from "../visualization-node-layouts/repository.js";
import { isRenderable, renderExport, RENDERABLE_FORMATS, type NodePosition } from "./render.js";

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
  /**
   * Crea l'export E genera il documento (#36 B5).
   *
   * Prima questo metodo scriveva soltanto una riga di registro: l'export
   * "esisteva" ma non c'era niente da scaricare. Ora il documento si renderizza
   * qui, con i dati reali del grafo, e viene salvato insieme al record — se il
   * rendering fallisce, l'export non nasce affatto.
   */
  async create(actor: ActorContext, body: CreateVizExportBody): Promise<VizExport> {
    await ensureGraphVisible(actor, body.graphId);
    if (body.layoutId) {
      const l = await findLayoutById(pool, body.layoutId);
      if (!l || l.graphId !== body.graphId) throw new NotFoundError("VizLayout");
    }
    if (!isRenderable(body.format)) {
      throw new ConflictError(
        `Format ${body.format} requires a rasterizer this service does not have. Renderable formats: ${RENDERABLE_FORMATS.join(", ")}`,
        "EXPORT_FORMAT_NOT_RENDERABLE",
      );
    }

    const render = await findGraphRender(pool, body.graphId);
    if (!render) throw new NotFoundError("VizGraph");

    let positions: Map<string, NodePosition> | undefined;
    if (body.layoutId) {
      const saved = await listAllPositionsForLayout(pool, body.layoutId);
      positions = new Map(saved.map((p) => [p.nodeId, { x: p.x, y: p.y }]));
    }

    const rendered = renderExport(body.format, {
      graph: render.graph,
      nodes: render.nodes,
      edges: render.edges,
      ...(positions ? { positions } : {}),
    });

    return repo.insertExport(pool, body, { content: rendered.content, contentType: rendered.contentType });
  },

  /** Il documento da scaricare, con il MIME e il nome file con cui servirlo. */
  async getContent(
    actor: ActorContext,
    id: string,
  ): Promise<{ content: string; contentType: string; filename: string }> {
    const meta = await repo.findExportById(pool, id);
    if (!meta) throw new NotFoundError("VizExport");
    const graph = await ensureGraphVisible(actor, meta.graphId);

    const payload = await repo.findExportPayload(pool, id);
    if (!payload) {
      // Gli export creati prima del motore (registro senza contenuto) finiscono
      // qui: la riga esiste, il documento non è mai stato prodotto.
      throw new NotFoundError("VizExportPayload");
    }
    const ext = payload.format === "MERMAID" ? "mmd" : payload.format === "SVG" ? "svg" : "json";
    const safeCode = graph.code.replace(/[^a-zA-Z0-9._-]/g, "_");
    return {
      content: payload.content,
      contentType: payload.contentType,
      filename: `${safeCode}-v${graph.version}.${ext}`,
    };
  },
};
