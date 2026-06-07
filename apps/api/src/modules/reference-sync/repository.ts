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
 *     brownfield backbone (source_exports + import_runs, scope 'reference_sync').
 */
import type { PoolClient } from "pg";
import { pool } from "../../db/client.js";
import { withTransaction } from "../auth/repository.js";
import type { EscoOccupation } from "./esco-connector.js";

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

export interface RecordRunArgs {
  sourceKey: string;
  fileHash: string;
  sizeBytes: number;
  initiatedBy: string;
  startedAt: Date;
  counts: EscoUpsertResult;
}

/** Record the run in the brownfield lineage backbone (source_exports + import_runs). */
export async function recordSyncRun(
  client: PoolClient,
  args: RecordRunArgs,
): Promise<{ runId: string; exportId: string }> {
  // source_exports is keyed UNIQUE by name (one row per source identity, refreshed
  // each fetch) — upsert it. import_runs below is the per-run append (history).
  const exp = await client.query<{ id: string }>(
    `INSERT INTO brownfield.source_exports
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
    `INSERT INTO brownfield.import_runs
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
      JSON.stringify({ source: args.sourceKey, ...args.counts }),
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
  FROM brownfield.import_runs ir
  LEFT JOIN brownfield.source_exports se ON se.source_export_id = ir.import_run_export_id
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

/** Run the catalog upsert + the run record atomically. */
export async function persistEscoSync(args: {
  rows: EscoOccupation[];
  fileHash: string;
  sizeBytes: number;
  initiatedBy: string;
  startedAt: Date;
}): Promise<{ runId: string; counts: EscoUpsertResult }> {
  return withTransaction(async (client) => {
    const counts = await upsertEscoCatalog(client, args.rows);
    const { runId } = await recordSyncRun(client, {
      sourceKey: "ESCO",
      fileHash: args.fileHash,
      sizeBytes: args.sizeBytes,
      initiatedBy: args.initiatedBy,
      startedAt: args.startedAt,
      counts,
    });
    return { runId, counts };
  });
}
