/**
 * apps/api/src/modules/seed-acquisition-runs/repository.ts
 */
import type { Pool, PoolClient } from "pg";
import type {
  SeedAcquisitionRun, SeedAcquisitionRunStatus, SeedAcquisitionRunListQuery,
  CreateSeedAcquisitionRunBody, UpdateSeedAcquisitionRunBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  seed_acquisition_run_id: string;
  seed_acquisition_run_tenant_id: string;
  seed_acquisition_run_code: string;
  seed_acquisition_run_prompt_template: string | null;
  seed_acquisition_run_source_registry_payload: unknown[];
  seed_acquisition_run_started_at: Date;
  seed_acquisition_run_finished_at: Date | null;
  seed_acquisition_run_status: SeedAcquisitionRunStatus;
  seed_acquisition_run_metadata: Record<string, unknown>;
  created_at: Date; updated_at: Date;
}

const COLS = `seed_acquisition_run_id, seed_acquisition_run_tenant_id, seed_acquisition_run_code,
  seed_acquisition_run_prompt_template, seed_acquisition_run_source_registry_payload,
  seed_acquisition_run_started_at, seed_acquisition_run_finished_at, seed_acquisition_run_status,
  seed_acquisition_run_metadata, created_at, updated_at`;

function toRun(r: Row): SeedAcquisitionRun {
  return {
    seedAcquisitionRunId: r.seed_acquisition_run_id,
    tenantId: r.seed_acquisition_run_tenant_id,
    code: r.seed_acquisition_run_code,
    promptTemplate: r.seed_acquisition_run_prompt_template,
    sourceRegistryPayload: r.seed_acquisition_run_source_registry_payload,
    startedAt: r.seed_acquisition_run_started_at.toISOString(),
    finishedAt: r.seed_acquisition_run_finished_at ? r.seed_acquisition_run_finished_at.toISOString() : null,
    status: r.seed_acquisition_run_status,
    metadata: r.seed_acquisition_run_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listRuns(
  q: DbConnector, filter: { tenantId?: string; query: SeedAcquisitionRunListQuery },
): Promise<{ items: SeedAcquisitionRun[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (filter.tenantId) { params.push(filter.tenantId); where.push(`seed_acquisition_run_tenant_id = $${params.length}`); }
  if (filter.query.status) { params.push(filter.query.status); where.push(`seed_acquisition_run_status = $${params.length}`); }
  if (filter.query.search) { params.push(`%${filter.query.search}%`); where.push(`seed_acquisition_run_code ILIKE $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tr = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_seed_acquisition_runs ${w}`, params);
  params.push(filter.query.limit); const lim = params.length;
  params.push(filter.query.offset); const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_seed_acquisition_runs ${w}
      ORDER BY seed_acquisition_run_started_at DESC LIMIT $${lim} OFFSET $${off}`, params,
  );
  return { items: res.rows.map(toRun), total: Number(tr.rows[0]?.total ?? 0) };
}

export async function findRunById(q: DbConnector, id: string): Promise<SeedAcquisitionRun | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_seed_acquisition_runs WHERE seed_acquisition_run_id = $1`, [id]);
  return res.rows[0] ? toRun(res.rows[0]) : null;
}

export async function insertRun(
  q: DbConnector, tenantId: string, body: CreateSeedAcquisitionRunBody, createdBy: string,
): Promise<SeedAcquisitionRun> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_seed_acquisition_runs (
        seed_acquisition_run_tenant_id, seed_acquisition_run_code,
        seed_acquisition_run_prompt_template, seed_acquisition_run_source_registry_payload,
        seed_acquisition_run_status, seed_acquisition_run_metadata, created_by
      ) VALUES ($1, $2, $3, $4::jsonb, 'RUNNING', $5::jsonb, $6) RETURNING ${COLS}`,
    [tenantId, body.code, body.promptTemplate ?? null,
     JSON.stringify(body.sourceRegistryPayload ?? []),
     JSON.stringify(body.metadata ?? {}), createdBy],
  );
  return toRun(res.rows[0]!);
}

export async function updateRunPartial(
  q: DbConnector, id: string, patch: UpdateSeedAcquisitionRunBody, updatedBy: string,
): Promise<SeedAcquisitionRun | null> {
  const sets: string[] = []; const params: unknown[] = [];
  const add = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.status !== undefined) {
    add("seed_acquisition_run_status", patch.status);
    if (patch.status === "COMPLETED" || patch.status === "FAILED" || patch.status === "CANCELLED") {
      sets.push(`seed_acquisition_run_finished_at = COALESCE(seed_acquisition_run_finished_at, now())`);
    }
  }
  if (patch.metadata !== undefined) { params.push(JSON.stringify(patch.metadata)); sets.push(`seed_acquisition_run_metadata = $${params.length}::jsonb`); }
  if (sets.length === 0) return findRunById(q, id);
  sets.push(`updated_at = now()`);
  params.push(updatedBy); sets.push(`updated_by = $${params.length}`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_seed_acquisition_runs SET ${sets.join(", ")}
      WHERE seed_acquisition_run_id = $${params.length} RETURNING ${COLS}`, params,
  );
  return res.rows[0] ? toRun(res.rows[0]) : null;
}

export async function deleteRun(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_seed_acquisition_runs WHERE seed_acquisition_run_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
