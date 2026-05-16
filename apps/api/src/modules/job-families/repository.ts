/**
 * apps/api/src/modules/job-families/repository.ts
 * Raw SQL for sys.sys_job_families (no tenant_id — platform-level).
 */

import type { Pool, PoolClient } from "pg";
import type {
  JobFamily,
  JobFamilyListQuery,
  CreateJobFamilyBody,
  UpdateJobFamilyBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  job_family_id: string;
  job_family_code: string;
  job_family_name: string;
  job_family_description: string | null;
  job_family_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const COLS = `job_family_id, job_family_code, job_family_name,
  job_family_description, job_family_metadata, created_at, updated_at`;

function toJf(r: Row): JobFamily {
  return {
    jobFamilyId: r.job_family_id,
    code: r.job_family_code,
    name: r.job_family_name,
    description: r.job_family_description,
    metadata: r.job_family_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listJobFamilies(
  q: DbConnector,
  query: JobFamilyListQuery,
): Promise<{ items: JobFamily[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (query.search) {
    params.push(`%${query.search}%`);
    where.push(`(job_family_name ILIKE $${params.length} OR job_family_code ILIKE $${params.length})`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_job_families ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(query.limit);
  const lim = params.length;
  params.push(query.offset);
  const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_job_families ${whereClause}
      ORDER BY job_family_code LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toJf), total };
}

export async function findJobFamilyById(q: DbConnector, id: string): Promise<JobFamily | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_job_families WHERE job_family_id = $1`, [id]);
  return res.rows[0] ? toJf(res.rows[0]) : null;
}

export async function findJobFamilyByCode(q: DbConnector, code: string): Promise<JobFamily | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_job_families WHERE job_family_code = $1`, [code]);
  return res.rows[0] ? toJf(res.rows[0]) : null;
}

export async function insertJobFamily(q: DbConnector, body: CreateJobFamilyBody): Promise<JobFamily> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_job_families (
        job_family_code, job_family_name, job_family_description, job_family_metadata
      ) VALUES ($1, $2, $3, $4::jsonb)
      RETURNING ${COLS}`,
    [body.code, body.name, body.description ?? null, JSON.stringify(body.metadata ?? {})],
  );
  return toJf(res.rows[0]!);
}

export async function updateJobFamilyPartial(
  q: DbConnector,
  id: string,
  patch: UpdateJobFamilyBody,
): Promise<JobFamily | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const addSet = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.name !== undefined) addSet("job_family_name", patch.name);
  if (patch.description !== undefined) addSet("job_family_description", patch.description);
  if (patch.metadata !== undefined) {
    params.push(JSON.stringify(patch.metadata));
    sets.push(`job_family_metadata = $${params.length}::jsonb`);
  }
  if (sets.length === 0) return findJobFamilyById(q, id);
  sets.push(`updated_at = now()`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_job_families SET ${sets.join(", ")}
      WHERE job_family_id = $${params.length}
      RETURNING ${COLS}`,
    params,
  );
  return res.rows[0] ? toJf(res.rows[0]) : null;
}

export async function deleteJobFamily(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_job_families WHERE job_family_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
