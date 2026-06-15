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
import type { PoolClient } from "pg";
import { ConflictError, NotFoundError } from "../../errors/index.js";
import type {
  ReferenceSyncRun,
  ReferenceSyncRunListResponse,
  ReferenceSyncSourceKey,
  ReferenceSyncSourceListResponse,
  ReferenceSyncTriggerResponse,
  ReferenceSyncWatermark,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import {
  HttpEscoFetcher,
  HttpEscoSkillFetcher,
  fetchAllEscoOccupations,
  resolveEscoSkillHierarchies,
  type EscoFetcher,
  type EscoSkillFetcher,
} from "./esco-connector.js";
import { HttpAtecoFetcher, fetchAllAtecoActivities, type AtecoFetcher } from "./istat-ateco-connector.js";

export interface ActorContext {
  /** null = a system/scheduled run (CLI-bypass) → recorded as a NULL import-run initiator. */
  userId: string | null;
}

/** DI seam — tests inject fixture fetchers; prod uses the live published artifacts. */
export interface ReferenceSyncDeps {
  escoFetcher: EscoFetcher;
  atecoFetcher: AtecoFetcher;
  escoSkillFetcher: EscoSkillFetcher;
  /** The set of ESCO skill URIs the T1.1 backfill resolves. Prod = every sys_skills
   *  row carrying a URI (~14k). The integration suite injects a tiny synthetic list so
   *  it never resolves/mutates the real catalog (mirrors the synthetic-URI fixtures). */
  escoSkillUriSource: () => Promise<string[]>;
}
export const defaultDeps: ReferenceSyncDeps = {
  escoFetcher: new HttpEscoFetcher(),
  atecoFetcher: new HttpAtecoFetcher(),
  escoSkillFetcher: new HttpEscoSkillFetcher(),
  escoSkillUriSource: repo.readEscoSkillUris,
};

/** Registered official sources (order = display order in /sources). */
const SOURCE_DEFS: Record<ReferenceSyncSourceKey, { label: string }> = {
  ESCO: { label: "ESCO — EU occupation & skill taxonomy" },
  ATECO_2025: { label: "ATECO 2025 — ISTAT Italian economic activity classification" },
  ESCO_SKILL_HIERARCHY: { label: "ESCO skill hierarchy — skill_group_uri + broader_uri backfill" },
};
const SOURCE_KEYS = Object.keys(SOURCE_DEFS) as ReferenceSyncSourceKey[];

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
    const items = await Promise.all(
      SOURCE_KEYS.map(async (key) => {
        const [last, wm] = await Promise.all([repo.readLatestRun(key), repo.readWatermark(key)]);
        return {
          key,
          label: SOURCE_DEFS[key].label,
          lastRun: last ? toRun(last) : null,
          watermark: wm ? toWatermark(wm) : null,
        };
      }),
    );
    return { items, total: items.length };
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
   * Trigger a refresh for one registered source (idempotent upsert; never deletes).
   * Watermark-driven (P2): if the fetched artifact is unchanged since the last
   * successful ingest, the catalog upsert is skipped (cheap UNCHANGED no-op) — the
   * watermark advances transactionally only on a COMPLETED run (scraping spec §3.3).
   * Generalized from the P1 ESCO-only trigger (S983 WS-C): fetch+normalize, the
   * upsert closure and the presence guard are bound per-source; the lock/hash/skip/
   * persist/markFailed pattern is shared and unchanged.
   */
  async runSync(
    a: ActorContext,
    source: ReferenceSyncSourceKey,
    deps: ReferenceSyncDeps = defaultDeps,
  ): Promise<ReferenceSyncTriggerResponse> {
    const startedAt = new Date();
    // Acquire the per-source in-flight lock (spec §5) — rejects an overlapping run (the
    // weekly timer firing while an operator triggers manually, or two triggers) and
    // returns the PRIOR watermark state for the skip decision. null = already running.
    const prior = await repo.acquireLock(source);
    if (!prior) {
      throw new ConflictError(`A reference-sync run for ${source} is already in progress`, "SYNC_IN_PROGRESS");
    }
    try {
      // Per-source bind: fetched rows, the catalog upsert and the presence guard.
      let rows: unknown[];
      let upsert: (client: PoolClient) => Promise<repo.EscoUpsertResult>;
      let hasRows: () => Promise<boolean>;
      if (source === "ESCO") {
        const occupations = await fetchAllEscoOccupations(deps.escoFetcher);
        rows = occupations;
        upsert = (client) => repo.upsertEscoCatalog(client, occupations);
        hasRows = repo.escoCatalogHasRows;
      } else if (source === "ESCO_SKILL_HIERARCHY") {
        // T1.1: backfill skill_group_uri + broader_uri on sys_skills for every skill
        // carrying an ESCO URI (the DEFERRED live run resolves ~14k via the HTTP fetcher;
        // tests inject a fixture fetcher → no live HTTP). Resolve under a bounded pool,
        // then merge idempotently into skill_metadata.
        const uris = await deps.escoSkillUriSource();
        const hierarchies = await resolveEscoSkillHierarchies(deps.escoSkillFetcher, uris);
        rows = hierarchies;
        upsert = (client) => repo.upsertEscoSkillHierarchy(client, hierarchies);
        hasRows = repo.escoSkillHierarchyHasRows;
      } else {
        const activities = await fetchAllAtecoActivities(deps.atecoFetcher);
        rows = activities;
        upsert = (client) => repo.upsertAtecoCatalog(client, activities);
        hasRows = repo.atecoCatalogHasRows;
      }
      const artifact = JSON.stringify(rows);
      const fileHash = createHash("sha256").update(artifact).digest("hex");
      const sizeBytes = Buffer.byteLength(artifact);
      // UNCHANGED short-circuit: identical artifact since the last SUCCESSFUL ingest AND
      // the catalog is still populated → skip the upsert (cheap no-op). The catalog-presence
      // guard keeps the skip a true optimization: a wiped catalog forces a real re-ingest
      // even when the content hash matches (the skip path itself performs NO upsert).
      const skipped = !!(prior.contentHash === fileHash && prior.lastSucceededAt && (await hasRows()));
      const { runId, counts } = await repo.persistSync({
        sourceKey: source, total: rows.length, upsert, fileHash, sizeBytes,
        initiatedBy: a.userId, startedAt, skipped,
      });
      return {
        accepted: true,
        runId,
        source,
        total: counts.total,
        inserted: counts.inserted,
        updated: counts.updated,
        skipped,
      };
    } catch (err) {
      // Release the lock as FAILED (only if we still hold FETCHING). The run tx rolled
      // back → content_hash/last_succeeded_at were NOT advanced (next run retries).
      await repo.markWatermarkFailed(source).catch(() => undefined);
      throw err;
    }
  },
};
