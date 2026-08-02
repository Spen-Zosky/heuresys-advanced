/**
 * packages/shared/src/schemas/visualization-graphs.ts
 */
import { z } from "zod";
import { paginationFields } from "./_pagination.js";
import { VizNodeSchema } from "./visualization-nodes.js";
import { VizEdgeSchema } from "./visualization-edges.js";

export const VIZ_GRAPH_TYPE_VALUES = [
  "ORG_CHART", "PROCESS_FLOW", "CAREER_PATH", "LEARNING_PATH",
  "SKILL_GAP_MAP", "SUCCESSION_MAP", "KPI_CASCADE",
  "POSITION_INTELLIGENCE_MAP", "ENTERPRISE_BLUEPRINT_MAP",
] as const;
export const VizGraphTypeSchema = z.enum(VIZ_GRAPH_TYPE_VALUES);
export type VizGraphType = z.infer<typeof VizGraphTypeSchema>;

export const VizGraphSchema = z.object({
  graphId: z.uuid(),
  tenantId: z.uuid(),
  code: z.string(),
  type: VizGraphTypeSchema,
  name: z.string(),
  description: z.string().nullable(),
  sourceQuery: z.string().nullable(),
  version: z.number().int(),
  isActive: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type VizGraph = z.infer<typeof VizGraphSchema>;

export const VizGraphListQuerySchema = z.object({
  type: VizGraphTypeSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().min(1).max(255).optional(),
  ...paginationFields(200, 50),
});
export type VizGraphListQuery = z.infer<typeof VizGraphListQuerySchema>;

export const VizGraphListResponseSchema = z.object({
  items: z.array(VizGraphSchema), total: z.number().int().min(0),
});

// Graph-type distribution (aggregate for the visualizations summary chart — F4).
export const VizGraphTypeDistributionItemSchema = z.object({
  type: z.string(),
  count: z.number().int().min(0),
});
export type VizGraphTypeDistributionItem = z.infer<typeof VizGraphTypeDistributionItemSchema>;

export const VizGraphSummaryResponseSchema = z.object({
  items: z.array(VizGraphTypeDistributionItemSchema),
  total: z.number().int().min(0),
});
export type VizGraphSummaryResponse = z.infer<typeof VizGraphSummaryResponseSchema>;

// Composite render payload — graph + all its nodes + all its edges in one call
// (org-chart renderer, F4.4). Avoids the 3 separate round-trips the pages did.
export const VizGraphRenderResponseSchema = z.object({
  graph: VizGraphSchema,
  nodes: z.array(VizNodeSchema),
  edges: z.array(VizEdgeSchema),
});
export type VizGraphRenderResponse = z.infer<typeof VizGraphRenderResponseSchema>;

export const CreateVizGraphBodySchema = z.object({
  code: z.string().min(1).max(128),
  type: VizGraphTypeSchema,
  name: z.string().min(1).max(255),
  description: z.string().max(4096).nullable().optional(),
  sourceQuery: z.string().max(16384).nullable().optional(),
  isActive: z.boolean().optional().default(true),
  tenantId: z.uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateVizGraphBody = z.infer<typeof CreateVizGraphBodySchema>;

export const UpdateVizGraphBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(4096).nullable().optional(),
  sourceQuery: z.string().max(16384).nullable().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateVizGraphBody = z.infer<typeof UpdateVizGraphBodySchema>;

export const VizGraphIdParamSchema = z.object({ id: z.uuid() });

// #36 (B5) — versionamento. `graph_version` esisteva a schema con un vincolo di
// unicità su (tenant, code, version), ma nessun endpoint creava mai una
// versione oltre la 1: il campo era una promessa non mantenuta. Una nuova
// versione è una COPIA indipendente del grafo (nodi, archi e, a richiesta, i
// layout con le posizioni), così la precedente resta consultabile com'era.
export const CreateVizGraphVersionBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(4096).nullable().optional(),
  /** Copia nodi e archi nella nuova versione (default sì: una versione vuota non è una versione). */
  copyContent: z.boolean().optional().default(true),
  /** Copia anche i layout e le posizioni dei nodi. */
  copyLayouts: z.boolean().optional().default(true),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateVizGraphVersionBody = z.infer<typeof CreateVizGraphVersionBodySchema>;

/** Il grafo nuovo più il conteggio di ciò che è stato copiato — verificabile dal chiamante. */
export const VizGraphVersionResponseSchema = z.object({
  graph: VizGraphSchema,
  copiedNodes: z.number().int().min(0),
  copiedEdges: z.number().int().min(0),
  copiedLayouts: z.number().int().min(0),
  copiedNodePositions: z.number().int().min(0),
});
export type VizGraphVersionResponse = z.infer<typeof VizGraphVersionResponseSchema>;

/** Tutte le versioni che condividono un `code` — alimenta il selettore di versione. */
export const VizGraphVersionListResponseSchema = z.object({
  items: z.array(VizGraphSchema),
  total: z.number().int().min(0),
});
export type VizGraphVersionListResponse = z.infer<typeof VizGraphVersionListResponseSchema>;
