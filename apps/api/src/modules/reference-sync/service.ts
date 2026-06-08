/**
 * apps/api/src/modules/reference-sync/service.ts
 * Cap⑤ scraping — orchestrates the ESCO reference-data refresh.
 *
 * fetch (paged) → normalize → idempotent catalog upsert + run-level lineage, all
 * behind the injectable `escoFetcher` seam (Voyage-style DI) so the integration
 * suite drives a recorded fixture instead of the live EU API. Reference data is
 * GLOBAL platform infra → no tenant scoping (RBAC gates to PLATFORM_ADMIN).
 */
import { createHash } from "node:crypto";
import { ConflictError, NotFoundError } from "../../errors/index.js";
import type {
  ReferenceSyncRun,
  ReferenceSyncRunListResponse,
  ReferenceSyncSourceListResponse,
  ReferenceSyncTriggerResponse,
  ReferenceSyncWatermark,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { HttpEscoFetcher, fetchAllEscoOccupations, type EscoFetcher } from "./esco-connector.js";

export interface ActorContext {
  /** null = a system/scheduled run (CLI-bypass) → recorded as a NULL import-run initiator. */
  userId: string | null;
}

/** DI seam — tests inject a fixture fetcher; prod uses the live ESCO API. */
export interface ReferenceSyncDeps {
  escoFetcher: EscoFetcher;
}
export const defaultDeps: ReferenceSyncDeps = { escoFetcher: new HttpEscoFetcher() };

function toRun(r: repo.SyncRunRow): ReferenceSyncRun {
  return {
    runId: r.runId,
    source: r.source,
    status: r.status as ReferenceSyncRun["status"],
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    fileHash: r.fileHash,
    total: r.total,
    inserted: r.inserted,
    updated: r.updated,
  };
}

function toWatermark(w: repo.WatermarkRow): ReferenceSyncWatermark {
  return {
    sourceKey: w.sourceKey,
    cursor: w.cursor,
    contentHash: w.contentHash,
    status: w.status as ReferenceSyncWatermark["status"],
    lastFetchedAt: w.lastFetchedAt,
    lastSucceededAt: w.lastSucceededAt,
    lastImportRunId: w.lastImportRunId,
  };
}

export const referenceSyncService = {
  async listSources(): Promise<ReferenceSyncSourceListResponse> {
    const [last, wm] = await Promise.all([repo.readLatestRun("ESCO"), repo.readWatermark("ESCO")]);
    return {
      items: [{
        key: "ESCO",
        label: "ESCO — EU occupation & skill taxonomy",
        lastRun: last ? toRun(last) : null,
        watermark: wm ? toWatermark(wm) : null,
      }],
      total: 1,
    };
  },

  async listRuns(): Promise<ReferenceSyncRunListResponse> {
    const items = (await repo.readRuns()).map(toRun);
    return { items, total: items.length };
  },

  async getRun(id: string): Promise<ReferenceSyncRun> {
    const r = await repo.readRun(id);
    if (!r) throw new NotFoundError("Reference-sync run");
    return toRun(r);
  },

  /**
   * Trigger an ESCO occupation-catalog refresh (idempotent upsert; never deletes).
   * Watermark-driven (P2): if the fetched artifact is unchanged since the last
   * successful ingest, the catalog upsert is skipped (cheap UNCHANGED no-op) — the
   * watermark advances transactionally only on a COMPLETED run (scraping spec §3.3).
   */
  async runEscoSync(a: ActorContext, deps: ReferenceSyncDeps = defaultDeps): Promise<ReferenceSyncTriggerResponse> {
    const startedAt = new Date();
    // Acquire the per-source in-flight lock (spec §5) — rejects an overlapping run (the
    // weekly timer firing while an operator triggers manually, or two triggers) and
    // returns the PRIOR watermark state for the skip decision. null = already running.
    const prior = await repo.acquireLock("ESCO");
    if (!prior) {
      throw new ConflictError("A reference-sync run for ESCO is already in progress", "SYNC_IN_PROGRESS");
    }
    try {
      const occupations = await fetchAllEscoOccupations(deps.escoFetcher);
      const artifact = JSON.stringify(occupations);
      const fileHash = createHash("sha256").update(artifact).digest("hex");
      const sizeBytes = Buffer.byteLength(artifact);
      // UNCHANGED short-circuit: identical artifact since the last SUCCESSFUL ingest AND
      // the catalog is still populated → skip the upsert (cheap no-op). The catalog-presence
      // guard keeps the skip a true optimization: a wiped catalog forces a real re-ingest
      // even when the content hash matches (the skip path itself performs NO upsert).
      const skipped = !!(prior.contentHash === fileHash && prior.lastSucceededAt && (await repo.escoCatalogHasRows()));
      const { runId, counts } = await repo.persistEscoSync({
        rows: occupations, fileHash, sizeBytes, initiatedBy: a.userId, startedAt, skipped,
      });
      return {
        accepted: true,
        runId,
        source: "ESCO",
        total: counts.total,
        inserted: counts.inserted,
        updated: counts.updated,
        skipped,
      };
    } catch (err) {
      // Release the lock as FAILED (only if we still hold FETCHING). The run tx rolled
      // back → content_hash/last_succeeded_at were NOT advanced (next run retries).
      await repo.markWatermarkFailed("ESCO").catch(() => undefined);
      throw err;
    }
  },
};
