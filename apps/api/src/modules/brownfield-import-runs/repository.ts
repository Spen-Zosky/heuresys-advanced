/**
 * apps/api/src/modules/brownfield-import-runs/repository.ts
 */
import type { Pool, PoolClient } from "pg";
import type {
  BrownfieldImportRun, BrownfieldImportStatus, BrownfieldImportRunListQuery,
  CreateBrownfieldImportRunBody, UpdateBrownfieldImportRunBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  import_run_id: string;
  import_run_export_id: string | null;
  import_run_wave: number | null;
  import_run_classification_scope: string | null;
  import_run_started_at: Date;
  import_run_finished_at: Date | null;
  import_run_status: BrownfieldImportStatus;
  import_run_initiated_by: string | null;
  import_run_metadata: Record<string, unknown>;
  created_at: Date;
}

const COLS = `import_run_id, import_run_export_id, import_run_wave,
  import_run_classification_scope, import_run_started_at, import_run_finished_at,
  import_run_status, import_run_initiated_by, import_run_metadata, created_at`;

function toRun(r: Row): BrownfieldImportRun {
  return {
    importRunId: r.import_run_id,
    exportId: r.import_run_export_id,
    wave: r.import_run_wave,
    classificationScope: r.import_run_classification_scope,
    startedAt: r.import_run_started_at.toISOString(),
    finishedAt: r.import_run_finished_at ? r.import_run_finished_at.toISOString() : null,
    status: r.import_run_status,
    initiatedBy: r.import_run_initiated_by,
    metadata: r.import_run_metadata,
    createdAt: r.created_at.toISOString(),
  };
}

export async function listRuns(
  q: DbConnector, query: BrownfieldImportRunListQuery,
): Promise<{ items: BrownfieldImportRun[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (query.exportId) { params.push(query.exportId); where.push(`import_run_export_id = $${params.length}`); }
  if (query.status) { params.push(query.status); where.push(`import_run_status = $${params.length}`); }
  if (query.wave !== undefined) { params.push(query.wave); where.push(`import_run_wave = $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tr = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM brownfield.import_runs ${w}`, params);
  params.push(query.limit); const lim = params.length;
  params.push(query.offset); const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM brownfield.import_runs ${w}
      ORDER BY import_run_started_at DESC LIMIT $${lim} OFFSET $${off}`, params,
  );
  return { items: res.rows.map(toRun), total: Number(tr.rows[0]?.total ?? 0) };
}

export async function findRunById(q: DbConnector, id: string): Promise<BrownfieldImportRun | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM brownfield.import_runs WHERE import_run_id = $1`, [id]);
  return res.rows[0] ? toRun(res.rows[0]) : null;
}

export async function insertRun(
  q: DbConnector, body: CreateBrownfieldImportRunBody, initiatedBy: string,
): Promise<BrownfieldImportRun> {
  const res = await q.query<Row>(
    `INSERT INTO brownfield.import_runs (
        import_run_export_id, import_run_wave, import_run_classification_scope,
        import_run_status, import_run_initiated_by, import_run_metadata
      ) VALUES ($1, $2, $3, 'RUNNING', $4, $5::jsonb)
      RETURNING ${COLS}`,
    [body.exportId ?? null, body.wave ?? null, body.classificationScope ?? null,
     initiatedBy, JSON.stringify(body.metadata ?? {})],
  );
  return toRun(res.rows[0]!);
}

export async function updateRunPartial(
  q: DbConnector, id: string, patch: UpdateBrownfieldImportRunBody,
): Promise<BrownfieldImportRun | null> {
  const sets: string[] = []; const params: unknown[] = [];
  const add = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.status !== undefined) {
    add("import_run_status", patch.status);
    if (patch.status === "COMPLETED" || patch.status === "FAILED" || patch.status === "CANCELLED") {
      sets.push(`import_run_finished_at = COALESCE(import_run_finished_at, now())`);
    }
  }
  if (patch.metadata !== undefined) { params.push(JSON.stringify(patch.metadata)); sets.push(`import_run_metadata = $${params.length}::jsonb`); }
  if (sets.length === 0) return findRunById(q, id);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE brownfield.import_runs SET ${sets.join(", ")}
      WHERE import_run_id = $${params.length} RETURNING ${COLS}`, params,
  );
  return res.rows[0] ? toRun(res.rows[0]) : null;
}
