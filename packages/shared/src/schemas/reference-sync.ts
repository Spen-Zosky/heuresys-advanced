/**
 * @heuresys/shared — reference-sync (cap⑤ scraping) schemas.
 * Backs /v1/reference-sync/* — inbound refresh of OFFICIAL reference taxonomies
 * (ESCO first) via their published API into the global sys.* reference tables,
 * reusing the brownfield lineage backbone (source_exports / import_runs).
 *
 * P1 = ESCO occupation catalog refresh (idempotent natural-key upsert into
 * sys_esco_occupation_mappings; NEVER delete). Watermark/scheduler = P2.
 * Zod v4 API (z.uuid()/z.iso.datetime()).
 */
import { z } from "zod";

export const ReferenceSyncSourceKeyEnum = z.enum(["ESCO"]);
export type ReferenceSyncSourceKey = z.infer<typeof ReferenceSyncSourceKeyEnum>;

export const ReferenceSyncRunStatusEnum = z.enum(["RUNNING", "COMPLETED", "FAILED", "CANCELLED"]);

/** One sync run (run-level lineage from brownfield.import_runs + source_exports). */
export const ReferenceSyncRunSchema = z.object({
  runId: z.uuid(),
  source: z.string(),
  status: ReferenceSyncRunStatusEnum,
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  fileHash: z.string().nullable(),
  total: z.number().int().min(0),
  inserted: z.number().int().min(0),
  updated: z.number().int().min(0),
});
export type ReferenceSyncRun = z.infer<typeof ReferenceSyncRunSchema>;

export const ReferenceSyncRunListResponseSchema = z.object({
  items: z.array(ReferenceSyncRunSchema),
  total: z.number().int().min(0),
});
export type ReferenceSyncRunListResponse = z.infer<typeof ReferenceSyncRunListResponseSchema>;

/** Per-source delta/HWM state (brownfield.source_watermarks, P2). */
export const SourceWatermarkStatusEnum = z.enum(["IDLE", "FETCHING", "STAGED", "FAILED", "UNCHANGED"]);
export type SourceWatermarkStatus = z.infer<typeof SourceWatermarkStatusEnum>;

export const ReferenceSyncWatermarkSchema = z.object({
  sourceKey: z.string(),
  cursor: z.string().nullable(),
  contentHash: z.string().nullable(),
  status: SourceWatermarkStatusEnum,
  lastFetchedAt: z.iso.datetime().nullable(),
  lastSucceededAt: z.iso.datetime().nullable(),
  lastImportRunId: z.uuid().nullable(),
});
export type ReferenceSyncWatermark = z.infer<typeof ReferenceSyncWatermarkSchema>;

/** One registered official source + its latest run + delta watermark (if any). */
export const ReferenceSyncSourceSchema = z.object({
  key: ReferenceSyncSourceKeyEnum,
  label: z.string(),
  lastRun: ReferenceSyncRunSchema.nullable(),
  watermark: ReferenceSyncWatermarkSchema.nullable(),
});
export const ReferenceSyncSourceListResponseSchema = z.object({
  items: z.array(ReferenceSyncSourceSchema),
  total: z.number().int().min(0),
});
export type ReferenceSyncSourceListResponse = z.infer<typeof ReferenceSyncSourceListResponseSchema>;

export const ReferenceSyncTriggerBodySchema = z.object({
  source: ReferenceSyncSourceKeyEnum.default("ESCO"),
});
export type ReferenceSyncTriggerBody = z.infer<typeof ReferenceSyncTriggerBodySchema>;

export const ReferenceSyncTriggerResponseSchema = z.object({
  accepted: z.literal(true),
  runId: z.uuid(),
  source: ReferenceSyncSourceKeyEnum,
  total: z.number().int().min(0),
  inserted: z.number().int().min(0),
  updated: z.number().int().min(0),
  /** true = upstream artifact unchanged since the last successful ingest (watermark
   *  short-circuit: no catalog upsert was performed). P2. */
  skipped: z.boolean(),
});
export type ReferenceSyncTriggerResponse = z.infer<typeof ReferenceSyncTriggerResponseSchema>;

export const ReferenceSyncRunIdParamSchema = z.object({ id: z.uuid() });
