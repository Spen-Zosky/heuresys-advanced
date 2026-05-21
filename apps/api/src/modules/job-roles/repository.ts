/**
 * apps/api/src/modules/job-roles/repository.ts
 * Raw SQL for sys.sys_job_roles (no tenant_id — platform-level, FK to
 * sys.sys_job_families.job_family_id).
 */

import type { Pool, PoolClient } from "pg";
import type {
  JobRole,
  JobRoleListQuery,
  CreateJobRoleBody,
  UpdateJobRoleBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  job_role_id: string;
  // ADR-0015: nullable for legacy-imported job_roles lacking canonical family (CW-B26).
  job_role_family_id: string | null;
  job_role_code: string;
  job_role_name: string;
  job_role_description: string | null;
  job_role_seniority_level: string | null;
  job_role_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const COLS = `job_role_id, job_role_family_id, job_role_code, job_role_name,
  job_role_description, job_role_seniority_level, job_role_metadata,
  created_at, updated_at`;

function toJr(r: Row): JobRole {
  return {
    jobRoleId: r.job_role_id,
    jobFamilyId: r.job_role_family_id,
    code: r.job_role_code,
    name: r.job_role_name,
    description: r.job_role_description,
    seniorityLevel: r.job_role_seniority_level as JobRole["seniorityLevel"],
    metadata: r.job_role_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listJobRoles(
  q: DbConnector,
  query: JobRoleListQuery,
): Promise<{ items: JobRole[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (query.jobFamilyId) {
    params.push(query.jobFamilyId);
    where.push(`job_role_family_id = $${params.length}`);
  }
  if (query.seniorityLevel) {
    params.push(query.seniorityLevel);
    where.push(`job_role_seniority_level = $${params.length}`);
  }
  if (query.search) {
    params.push(`%${query.search}%`);
    where.push(`(job_role_name ILIKE $${params.length} OR job_role_code ILIKE $${params.length})`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_job_roles ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(query.limit);
  const lim = params.length;
  params.push(query.offset);
  const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_job_roles ${whereClause}
      ORDER BY job_role_code LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toJr), total };
}

export async function findJobRoleById(q: DbConnector, id: string): Promise<JobRole | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_job_roles WHERE job_role_id = $1`, [id]);
  return res.rows[0] ? toJr(res.rows[0]) : null;
}

export async function findJobRoleByCode(q: DbConnector, code: string): Promise<JobRole | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_job_roles WHERE job_role_code = $1`, [code]);
  return res.rows[0] ? toJr(res.rows[0]) : null;
}

export async function jobFamilyExists(q: DbConnector, familyId: string): Promise<boolean> {
  const res = await q.query<{ x: number }>(
    `SELECT 1 AS x FROM sys.sys_job_families WHERE job_family_id = $1`,
    [familyId],
  );
  return res.rows.length === 1;
}

export async function insertJobRole(
  q: DbConnector,
  body: CreateJobRoleBody,
  createdBy: string,
): Promise<JobRole> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_job_roles (
        job_role_family_id, job_role_code, job_role_name,
        job_role_description, job_role_seniority_level, job_role_metadata, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
      RETURNING ${COLS}`,
    [
      // ADR-0015: body.jobFamilyId is now nullable+optional; null when family unknown.
      body.jobFamilyId ?? null,
      body.code,
      body.name,
      body.description ?? null,
      body.seniorityLevel ?? null,
      JSON.stringify(body.metadata ?? {}),
      createdBy,
    ],
  );
  return toJr(res.rows[0]!);
}

export async function updateJobRolePartial(
  q: DbConnector,
  id: string,
  patch: UpdateJobRoleBody,
  updatedBy: string,
): Promise<JobRole | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const addSet = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.jobFamilyId !== undefined) addSet("job_role_family_id", patch.jobFamilyId);
  if (patch.name !== undefined) addSet("job_role_name", patch.name);
  if (patch.description !== undefined) addSet("job_role_description", patch.description);
  if (patch.seniorityLevel !== undefined) addSet("job_role_seniority_level", patch.seniorityLevel);
  if (patch.metadata !== undefined) {
    params.push(JSON.stringify(patch.metadata));
    sets.push(`job_role_metadata = $${params.length}::jsonb`);
  }
  if (sets.length === 0) return findJobRoleById(q, id);
  sets.push(`updated_at = now()`);
  params.push(updatedBy);
  sets.push(`updated_by = $${params.length}`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_job_roles SET ${sets.join(", ")}
      WHERE job_role_id = $${params.length}
      RETURNING ${COLS}`,
    params,
  );
  return res.rows[0] ? toJr(res.rows[0]) : null;
}
