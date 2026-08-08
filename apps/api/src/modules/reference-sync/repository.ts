/**
 * apps/api/src/modules/reference-sync/repository.ts
 * Cap⑤ scraping — idempotent ESCO catalog upsert + run-level lineage.
 *
 *   upsertEscoCatalog — INSERT … ON CONFLICT (job_role_id, esco_uri) DO UPDATE on
 *     sys.sys_esco_occupation_mappings. The live catalog rows all carry job_role_id
 *     = NULL; the pair unique index (NULLS NOT DISTINCT) makes esco_uri the natural
 *     key, so a refresh is an idempotent label/ISCO/metadata update — NEVER a delete
 *     (scraping spec §3.3). Insert-vs-update counted via the `xmax = 0` trick.
 *   recordSyncRun / readRuns / readLatestRun — run-level lineage reusing the
 *     reference_sync backbone (source_exports + import_runs, scope 'reference_sync').
 */
import type { PoolClient } from "pg";
import { pool } from "../../db/client.js";
import { withTransaction } from "../../db/client.js";
import type { EscoOccupation, EscoSkillHierarchy } from "./esco-connector.js";
import { ATECO_SCHEME, type AtecoActivity } from "./istat-ateco-connector.js";

export const REFERENCE_SYNC_SCOPE = "reference_sync";

export interface EscoUpsertResult {
  total: number;
  inserted: number;
  updated: number;
}

const UPSERT_CHUNK = 1000;

/** Idempotent upsert of the ESCO occupation catalog (job_role_id = NULL rows). */
export async function upsertEscoCatalog(
  client: PoolClient,
  rows: EscoOccupation[],
): Promise<EscoUpsertResult> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK);
    const params: unknown[] = [];
    const tuples = chunk.map((r, j) => {
      const b = j * 4;
      params.push(r.escoUri, r.label, r.iscoCode, JSON.stringify(r.metadata));
      return `(NULL, $${b + 1}, $${b + 2}, $${b + 3}, 1.000, $${b + 4}::jsonb)`;
    });
    const res = await client.query<{ inserted: boolean }>(
      `INSERT INTO sys.sys_esco_occupation_mappings
         (esco_occupation_mapping_job_role_id, esco_occupation_mapping_esco_uri,
          esco_occupation_mapping_esco_label, esco_occupation_mapping_isco_code,
          esco_occupation_mapping_confidence, esco_occupation_mapping_metadata)
       VALUES ${tuples.join(", ")}
       ON CONFLICT (esco_occupation_mapping_job_role_id, esco_occupation_mapping_esco_uri)
       DO UPDATE SET
         esco_occupation_mapping_esco_label = EXCLUDED.esco_occupation_mapping_esco_label,
         esco_occupation_mapping_isco_code  = EXCLUDED.esco_occupation_mapping_isco_code,
         esco_occupation_mapping_metadata   = EXCLUDED.esco_occupation_mapping_metadata,
         updated_at = now()
       RETURNING (xmax = 0) AS inserted`,
      params,
    );
    inserted += res.rows.filter((x) => x.inserted).length;
  }
  return { total: rows.length, inserted, updated: rows.length - inserted };
}

/**
 * Idempotent upsert of the ATECO 2025 activity catalog (scheme+code natural key,
 * unique index sys_activity_classifications_scheme_code_uq from 000007). A NEW
 * parallel generation under scheme 'ATECO_2025' — the legacy 'ATECO'/'NACE' rows
 * are never touched (S983 WS-C decision). NEVER deletes (scraping spec §3.3).
 */
export async function upsertAtecoCatalog(
  client: PoolClient,
  rows: AtecoActivity[],
): Promise<EscoUpsertResult> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK);
    const params: unknown[] = [];
    const tuples = chunk.map((r, j) => {
      const b = j * 5;
      params.push(r.code, r.parentCode, r.titleIt, r.level, JSON.stringify(r.metadata));
      return `('${ATECO_SCHEME}', $${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}::jsonb)`;
    });
    const res = await client.query<{ inserted: boolean }>(
      `INSERT INTO sys.sys_activity_classifications
         (activity_classification_scheme, activity_classification_code,
          activity_classification_parent_code, activity_classification_name,
          activity_classification_level, activity_classification_metadata)
       VALUES ${tuples.join(", ")}
       ON CONFLICT (activity_classification_scheme, activity_classification_code)
       DO UPDATE SET
         activity_classification_parent_code = EXCLUDED.activity_classification_parent_code,
         activity_classification_name        = EXCLUDED.activity_classification_name,
         activity_classification_level       = EXCLUDED.activity_classification_level,
         activity_classification_metadata    = EXCLUDED.activity_classification_metadata,
         updated_at = now()
       RETURNING (xmax = 0) AS inserted`,
      params,
    );
    inserted += res.rows.filter((x) => x.inserted).length;
  }
  return { total: rows.length, inserted, updated: rows.length - inserted };
}

/* ── T1.1: ESCO skill-hierarchy backfill (skill_group_uri + broader_uri) ─────────
 *
 * Persistence is an idempotent jsonb-merge UPDATE on sys.sys_skills keyed by the
 * natural ESCO URI (skill_esco_uri). NO new column — the jsonb keys already exist in
 * the scaffold (T2.4's skill_kind column is a SEPARATE concern, untouched here).
 *
 *   UPDATE sys.sys_skills
 *      SET skill_metadata = skill_metadata || jsonb_build_object('skill_group_uri',$1,'broader_uri',$2)
 *    WHERE skill_esco_uri = $3
 *
 * Policy: a NULL resolved value is written as a JSON null into the merged object,
 * preserving the "skill group unavailable" bucket explicitly (the key is present with
 * value null). Re-running with the same resolution produces an identical row → the
 * `||` merge is naturally idempotent; the watermark hash-skip makes the whole run a
 * no-op when the resolved artifact is unchanged. */

/** Read the ESCO skill URIs that need a hierarchy backfill (all skills with a URI). */
export async function readEscoSkillUris(): Promise<string[]> {
  const res = await pool.query<{ uri: string }>(
    `SELECT skill_esco_uri AS uri FROM sys.sys_skills
      WHERE skill_esco_uri IS NOT NULL
      ORDER BY skill_esco_uri`,
  );
  return res.rows.map((r) => r.uri);
}

/**
 * Idempotent jsonb-merge of the resolved skill hierarchy into sys.sys_skills.
 * One UPDATE per skill (the natural URI key); chunked param batching is unnecessary —
 * a single skill maps to a single row. Counts a row as "updated" when the UPDATE
 * actually matched a sys_skills row (rowCount), "inserted" stays 0 (this is a backfill
 * of existing rows, never an INSERT). NULLs are merged as JSON null (group-unavailable
 * bucket preserved). Mirrors the EscoUpsertResult contract so persistSync is reused.
 */
export async function upsertEscoSkillHierarchy(
  client: PoolClient,
  rows: EscoSkillHierarchy[],
): Promise<EscoUpsertResult> {
  let updated = 0;
  for (const r of rows) {
    const res = await client.query(
      `UPDATE sys.sys_skills
          SET skill_metadata = skill_metadata
              || jsonb_build_object('skill_group_uri', $1::text, 'broader_uri', $2::text)
        WHERE skill_esco_uri = $3`,
      [r.skillGroupUri, r.broaderUri, r.skillEscoUri],
    );
    updated += res.rowCount ?? 0;
  }
  return { total: rows.length, inserted: 0, updated };
}

/**
 * Presence guard for the ESCO_SKILL_HIERARCHY watermark skip: have ANY skills had
 * their group URI backfilled yet? Keeps the UNCHANGED hash-skip a TRUE optimization —
 * if the backfill was never run (or wiped), a matching content hash must NOT skip the
 * real backfill. Mirrors escoCatalogHasRows / atecoCatalogHasRows.
 */
export async function escoSkillHierarchyHasRows(): Promise<boolean> {
  const res = await pool.query<{ has: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM sys.sys_skills WHERE skill_metadata->>'skill_group_uri' IS NOT NULL
     ) AS has`,
  );
  return res.rows[0]?.has === true;
}

export interface RecordRunArgs {
  sourceKey: string;
  fileHash: string;
  sizeBytes: number;
  initiatedBy: string | null;
  startedAt: Date;
  counts: EscoUpsertResult;
  /** true = UNCHANGED no-op run (watermark short-circuit; no catalog upsert performed). */
  skipped?: boolean;
}

/** Record the run in the reference_sync lineage backbone (source_exports + import_runs). */
export async function recordSyncRun(
  client: PoolClient,
  args: RecordRunArgs,
): Promise<{ runId: string; exportId: string }> {
  // source_exports is keyed UNIQUE by name (one row per source identity, refreshed
  // each fetch) — upsert it. import_runs below is the per-run append (history).
  const exp = await client.query<{ id: string }>(
    `INSERT INTO reference_sync.source_exports
       (source_export_name, source_export_file_hash, source_export_retrieved_at,
        source_export_size_bytes, source_export_status, source_export_metadata)
     VALUES ($1, $2, now(), $3, 'INGESTED', $4::jsonb)
     ON CONFLICT (source_export_name) DO UPDATE SET
       source_export_file_hash    = EXCLUDED.source_export_file_hash,
       source_export_retrieved_at = EXCLUDED.source_export_retrieved_at,
       source_export_size_bytes   = EXCLUDED.source_export_size_bytes,
       source_export_status       = EXCLUDED.source_export_status,
       source_export_metadata     = EXCLUDED.source_export_metadata
     RETURNING source_export_id AS id`,
    [args.sourceKey, args.fileHash, args.sizeBytes, JSON.stringify({ source: args.sourceKey, ...args.counts })],
  );
  const exportId = exp.rows[0]!.id;
  const run = await client.query<{ id: string }>(
    `INSERT INTO reference_sync.import_runs
       (import_run_export_id, import_run_wave, import_run_classification_scope,
        import_run_started_at, import_run_finished_at, import_run_status,
        import_run_initiated_by, import_run_metadata)
     VALUES ($1, NULL, $2, $3, now(), 'COMPLETED', $4, $5::jsonb)
     RETURNING import_run_id AS id`,
    [
      exportId,
      REFERENCE_SYNC_SCOPE,
      args.startedAt,
      args.initiatedBy,
      JSON.stringify({ source: args.sourceKey, ...args.counts, skipped: !!args.skipped }),
    ],
  );
  return { runId: run.rows[0]!.id, exportId };
}

export interface SyncRunRow {
  runId: string;
  source: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  fileHash: string | null;
  total: number;
  inserted: number;
  updated: number;
}

const RUN_SELECT = `
  SELECT ir.import_run_id AS run_id,
         COALESCE(se.source_export_name, 'unknown') AS source,
         ir.import_run_status AS status,
         ir.import_run_started_at AS started_at,
         ir.import_run_finished_at AS finished_at,
         se.source_export_file_hash AS file_hash,
         COALESCE((ir.import_run_metadata->>'total')::int, 0) AS total,
         COALESCE((ir.import_run_metadata->>'inserted')::int, 0) AS inserted,
         COALESCE((ir.import_run_metadata->>'updated')::int, 0) AS updated
  FROM reference_sync.import_runs ir
  LEFT JOIN reference_sync.source_exports se ON se.source_export_id = ir.import_run_export_id
  WHERE ir.import_run_classification_scope = '${REFERENCE_SYNC_SCOPE}'
`;

function mapRun(r: Record<string, unknown>): SyncRunRow {
  return {
    runId: r.run_id as string,
    source: r.source as string,
    status: r.status as string,
    startedAt: (r.started_at as Date).toISOString(),
    finishedAt: r.finished_at ? (r.finished_at as Date).toISOString() : null,
    fileHash: (r.file_hash as string | null)?.trim() ?? null,
    total: Number(r.total),
    inserted: Number(r.inserted),
    updated: Number(r.updated),
  };
}

export async function readRuns(limit = 50): Promise<SyncRunRow[]> {
  const res = await pool.query(`${RUN_SELECT} ORDER BY ir.import_run_started_at DESC LIMIT $1`, [limit]);
  return res.rows.map(mapRun);
}

export async function readRun(id: string): Promise<SyncRunRow | null> {
  const res = await pool.query(`${RUN_SELECT} AND ir.import_run_id = $1`, [id]);
  const row = res.rows[0];
  return row ? mapRun(row) : null;
}

export async function readLatestRun(sourceKey: string): Promise<SyncRunRow | null> {
  const res = await pool.query(
    `${RUN_SELECT} AND se.source_export_name = $1 ORDER BY ir.import_run_started_at DESC LIMIT 1`,
    [sourceKey],
  );
  const row = res.rows[0];
  return row ? mapRun(row) : null;
}

/**
 * Run the catalog upsert + the run record + the watermark advance ATOMICALLY (one
 * transaction). When `skipped` (the upstream artifact is unchanged since the last
 * successful ingest), the catalog upsert is skipped and the watermark advances to
 * UNCHANGED; otherwise the source-specific `upsert` closure runs and the watermark
 * advances to STAGED. The HWM only ever advances inside this run-finish transaction,
 * so a crash mid-load never advances the cursor (scraping spec §3.3). Generalized
 * from the P1 ESCO-only persist (S983 WS-C): the service binds the closure to the
 * fetched rows; this layer is source-agnostic.
 */
export async function persistSync(args: {
  sourceKey: string;
  /** Row count recorded for an UNCHANGED skip (no upsert is performed). */
  total: number;
  upsert: (client: PoolClient) => Promise<EscoUpsertResult>;
  fileHash: string;
  sizeBytes: number;
  initiatedBy: string | null;
  startedAt: Date;
  skipped: boolean;
}): Promise<{ runId: string; counts: EscoUpsertResult }> {
  return withTransaction(async (client) => {
    const counts = args.skipped
      ? { total: args.total, inserted: 0, updated: 0 }
      : await args.upsert(client);
    const { runId } = await recordSyncRun(client, {
      sourceKey: args.sourceKey,
      fileHash: args.fileHash,
      sizeBytes: args.sizeBytes,
      initiatedBy: args.initiatedBy,
      startedAt: args.startedAt,
      counts,
      skipped: args.skipped,
    });
    await advanceWatermark(client, {
      sourceKey: args.sourceKey,
      contentHash: args.fileHash,
      status: args.skipped ? "UNCHANGED" : "STAGED",
      runId,
    });
    return { runId, counts };
  });
}

/* ── cap⑤ P2: delta / HWM layer (reference_sync.source_watermarks) ───────────── */

export interface WatermarkRow {
  sourceKey: string;
  cursor: string | null;
  contentHash: string | null;
  status: string;
  lastFetchedAt: string | null;
  lastSucceededAt: string | null;
  lastImportRunId: string | null;
}

/** Current watermark for a source (null if the row was never seeded). */
export async function readWatermark(sourceKey: string): Promise<WatermarkRow | null> {
  const res = await pool.query(
    `SELECT source_watermark_source_key      AS source_key,
            source_watermark_cursor          AS cursor,
            source_watermark_content_hash    AS content_hash,
            source_watermark_status          AS status,
            source_watermark_last_fetched_at AS last_fetched_at,
            source_watermark_last_succeeded_at AS last_succeeded_at,
            source_watermark_last_import_run_id AS last_import_run_id
       FROM reference_sync.source_watermarks
      WHERE source_watermark_source_key = $1`,
    [sourceKey],
  );
  const r = res.rows[0];
  if (!r) return null;
  return {
    sourceKey: r.source_key as string,
    cursor: (r.cursor as string | null) ?? null,
    contentHash: (r.content_hash as string | null)?.trim() ?? null,
    status: r.status as string,
    lastFetchedAt: r.last_fetched_at ? (r.last_fetched_at as Date).toISOString() : null,
    lastSucceededAt: r.last_succeeded_at ? (r.last_succeeded_at as Date).toISOString() : null,
    lastImportRunId: (r.last_import_run_id as string | null) ?? null,
  };
}

/**
 * Advance the watermark in the run-finish transaction (called only from persistEscoSync)
 * and RELEASE the FETCHING lock by overwriting the status: 'STAGED' for a changed ingest
 * (the terminal-success state for this direct-upsert connector — there is no separate
 * staging table, so STAGED per the spec §3.3 enum means "successfully ingested into
 * sys.*") or 'UNCHANGED' for a skipped no-op. Sets content_hash + last_import_run_id and
 * stamps last_fetched_at/last_succeeded_at = now (an UNCHANGED run is still a success —
 * nothing to ingest). Upsert by source_key so it is robust even if the seed row is absent.
 */
async function advanceWatermark(
  client: PoolClient,
  args: { sourceKey: string; contentHash: string; status: "STAGED" | "UNCHANGED"; runId: string },
): Promise<void> {
  await client.query(
    `INSERT INTO reference_sync.source_watermarks
       (source_watermark_source_key, source_watermark_content_hash, source_watermark_status,
        source_watermark_last_fetched_at, source_watermark_last_succeeded_at,
        source_watermark_last_import_run_id, updated_at)
     VALUES ($1, $2, $3, now(), now(), $4, now())
     ON CONFLICT (source_watermark_source_key) DO UPDATE SET
       source_watermark_content_hash       = EXCLUDED.source_watermark_content_hash,
       source_watermark_status             = EXCLUDED.source_watermark_status,
       source_watermark_last_fetched_at    = now(),
       source_watermark_last_succeeded_at  = now(),
       source_watermark_last_import_run_id = EXCLUDED.source_watermark_last_import_run_id,
       updated_at = now()`,
    [args.sourceKey, args.contentHash, args.status, args.runId],
  );
}

/**
 * Mark the source FAILED — ONLY if this run still holds the FETCHING lock. The
 * `status = 'FETCHING'` guard means a late failure of an overtaken run cannot clobber a
 * row that has already advanced to a newer success (no cross-run state corruption). The
 * run transaction rolled back, so content_hash/last_succeeded_at were NOT advanced (the
 * next run retries the same delta). Scraping spec §5. Failures are observable here +
 * via journalctl (the systemd timer); they intentionally do NOT write an import_runs row
 * (the run-finish insert lives inside the rolled-back transaction).
 */
export async function markWatermarkFailed(sourceKey: string): Promise<void> {
  await pool.query(
    `UPDATE reference_sync.source_watermarks
        SET source_watermark_status = 'FAILED', source_watermark_last_fetched_at = now(), updated_at = now()
      WHERE source_watermark_source_key = $1 AND source_watermark_status = 'FETCHING'`,
    [sourceKey],
  );
}

/** TTL (minutes) after which a stale FETCHING lock (a crashed run) is reclaimable. */
const LOCK_STALE_MINUTES = 30;

/**
 * Acquire the per-source in-flight lock (spec §5): atomically set status=FETCHING and
 * return the PRIOR content_hash/last_succeeded_at (for the UNCHANGED skip decision).
 * Returns null when a non-stale FETCHING run already holds the lock — the caller bails
 * with SYNC_IN_PROGRESS. Upsert form so it works even if the seed row is absent; the
 * ON CONFLICT … WHERE guard rejects a live in-flight run while auto-reclaiming a stale
 * one (a crash that left FETCHING older than the TTL). advanceWatermark/markWatermarkFailed
 * release the lock at run-finish by overwriting the status.
 */
export async function acquireLock(
  sourceKey: string,
): Promise<{ contentHash: string | null; lastSucceededAt: string | null } | null> {
  const res = await pool.query(
    `INSERT INTO reference_sync.source_watermarks
       (source_watermark_source_key, source_watermark_status, source_watermark_last_fetched_at)
     VALUES ($1, 'FETCHING', now())
     ON CONFLICT (source_watermark_source_key) DO UPDATE SET
       source_watermark_status = 'FETCHING', source_watermark_last_fetched_at = now(), updated_at = now()
     WHERE source_watermarks.source_watermark_status <> 'FETCHING'
        OR source_watermarks.source_watermark_last_fetched_at < now() - make_interval(mins => $2::int)
     RETURNING source_watermark_content_hash AS content_hash,
               source_watermark_last_succeeded_at AS last_succeeded_at`,
    [sourceKey, LOCK_STALE_MINUTES],
  );
  const r = res.rows[0];
  if (!r) return null; // a live FETCHING run already holds the lock
  return {
    contentHash: (r.content_hash as string | null)?.trim() ?? null,
    lastSucceededAt: r.last_succeeded_at ? (r.last_succeeded_at as Date).toISOString() : null,
  };
}

/**
 * Cheap presence check: does the ESCO occupation catalog still hold rows? Makes the
 * UNCHANGED skip a TRUE optimization rather than the sole correctness gate — if the
 * global catalog was wiped, the next run re-ingests despite a matching content hash
 * (the skip path performs NO upsert, so without this guard a wiped catalog would never
 * self-heal while the watermark records a matching hash).
 */
export async function escoCatalogHasRows(): Promise<boolean> {
  const res = await pool.query<{ has: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM sys.sys_esco_occupation_mappings WHERE esco_occupation_mapping_job_role_id IS NULL
     ) AS has`,
  );
  return res.rows[0]?.has === true;
}

/** Same presence guard for the ATECO_2025 generation (see escoCatalogHasRows). */
export async function atecoCatalogHasRows(): Promise<boolean> {
  const res = await pool.query<{ has: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM sys.sys_activity_classifications WHERE activity_classification_scheme = $1
     ) AS has`,
    [ATECO_SCHEME],
  );
  return res.rows[0]?.has === true;
}
