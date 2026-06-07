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
import { NotFoundError } from "../../errors/index.js";
import type {
  ReferenceSyncRun,
  ReferenceSyncRunListResponse,
  ReferenceSyncSourceListResponse,
  ReferenceSyncTriggerResponse,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { HttpEscoFetcher, fetchAllEscoOccupations, type EscoFetcher } from "./esco-connector.js";

export interface ActorContext {
  userId: string;
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

export const referenceSyncService = {
  async listSources(): Promise<ReferenceSyncSourceListResponse> {
    const last = await repo.readLatestRun("ESCO");
    return {
      items: [{ key: "ESCO", label: "ESCO — EU occupation & skill taxonomy", lastRun: last ? toRun(last) : null }],
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

  /** Trigger an ESCO occupation-catalog refresh (idempotent upsert; never deletes). */
  async runEscoSync(a: ActorContext, deps: ReferenceSyncDeps = defaultDeps): Promise<ReferenceSyncTriggerResponse> {
    const startedAt = new Date();
    const occupations = await fetchAllEscoOccupations(deps.escoFetcher);
    const artifact = JSON.stringify(occupations);
    const fileHash = createHash("sha256").update(artifact).digest("hex");
    const sizeBytes = Buffer.byteLength(artifact);
    const { runId, counts } = await repo.persistEscoSync({
      rows: occupations,
      fileHash,
      sizeBytes,
      initiatedBy: a.userId,
      startedAt,
    });
    return {
      accepted: true,
      runId,
      source: "ESCO",
      total: counts.total,
      inserted: counts.inserted,
      updated: counts.updated,
    };
  },
};
