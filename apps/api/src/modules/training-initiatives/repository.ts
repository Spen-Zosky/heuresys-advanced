/**
 * apps/api/src/modules/training-initiatives/repository.ts
 * Raw SQL for sys.sys_training_initiatives. Always tenant-scoped.
 */

import type { Pool, PoolClient } from "pg";
import type {
  TrainingInitiative,
  TrainingInitiativeListQuery,
  CreateTrainingInitiativeBody,
  UpdateTrainingInitiativeBody,
  TrainingInitiativeStatus,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  training_initiative_id: string;
  training_initiative_tenant_id: string;
  training_initiative_module_id: string;
  training_initiative_code: string;
  training_initiative_cohort_name: string | null;
  training_initiative_start_date: Date;
  training_initiative_end_date: Date | null;
  training_initiative_facilitator_user_id: string | null;
  training_initiative_status: TrainingInitiativeStatus;
  training_initiative_capacity: number | null;
  training_initiative_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const COLS = `training_initiative_id, training_initiative_tenant_id,
  training_initiative_module_id, training_initiative_code,
  training_initiative_cohort_name, training_initiative_start_date,
  training_initiative_end_date, training_initiative_facilitator_user_id,
  training_initiative_status, training_initiative_capacity,
  training_initiative_metadata, created_at, updated_at`;

import { toDateOnly as dateOnlyLocale } from "../../lib/date-only.js";

function toDateOnly(d: Date | null): string | null {
  return dateOnlyLocale(d);
}

function toTi(r: Row): TrainingInitiative {
  return {
    trainingInitiativeId: r.training_initiative_id,
    tenantId: r.training_initiative_tenant_id,
    moduleId: r.training_initiative_module_id,
    code: r.training_initiative_code,
    cohortName: r.training_initiative_cohort_name,
    startDate: toDateOnly(r.training_initiative_start_date)!,
    endDate: toDateOnly(r.training_initiative_end_date),
    facilitatorUserId: r.training_initiative_facilitator_user_id,
    status: r.training_initiative_status,
    capacity: r.training_initiative_capacity,
    metadata: r.training_initiative_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export interface ListFilter {
  /** Restrict to this tenant. undefined → no filter (PLATFORM_ADMIN). */
  tenantId?: string;
  query: TrainingInitiativeListQuery;
}

export async function listTrainingInitiatives(
  q: DbConnector,
  filter: ListFilter,
): Promise<{ items: TrainingInitiative[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`training_initiative_tenant_id = $${params.length}`);
  } else if (filter.query.tenantId) {
    params.push(filter.query.tenantId);
    where.push(`training_initiative_tenant_id = $${params.length}`);
  }
  if (filter.query.moduleId) {
    params.push(filter.query.moduleId);
    where.push(`training_initiative_module_id = $${params.length}`);
  }
  if (filter.query.status) {
    params.push(filter.query.status);
    where.push(`training_initiative_status = $${params.length}`);
  }
  if (filter.query.search) {
    params.push(`%${filter.query.search}%`);
    where.push(`(training_initiative_code ILIKE $${params.length} OR training_initiative_cohort_name ILIKE $${params.length})`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_training_initiatives ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_training_initiatives ${whereClause}
      ORDER BY training_initiative_start_date DESC, training_initiative_code
      LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toTi), total };
}

export async function findTiById(q: DbConnector, id: string): Promise<TrainingInitiative | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_training_initiatives WHERE training_initiative_id = $1`,
    [id],
  );
  return res.rows[0] ? toTi(res.rows[0]) : null;
}

export async function findTiByTenantCode(
  q: DbConnector,
  tenantId: string,
  code: string,
): Promise<TrainingInitiative | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_training_initiatives
      WHERE training_initiative_tenant_id = $1 AND training_initiative_code = $2`,
    [tenantId, code],
  );
  return res.rows[0] ? toTi(res.rows[0]) : null;
}

interface ModuleScopeRow {
  learning_module_tenant_id: string | null;
  learning_module_is_global: boolean;
}

export async function getModuleScope(
  q: DbConnector,
  moduleId: string,
): Promise<{ tenantId: string | null; isGlobal: boolean } | null> {
  const res = await q.query<ModuleScopeRow>(
    `SELECT learning_module_tenant_id, learning_module_is_global
       FROM sys.sys_learning_modules WHERE learning_module_id = $1`,
    [moduleId],
  );
  const r = res.rows[0];
  if (!r) return null;
  return { tenantId: r.learning_module_tenant_id, isGlobal: r.learning_module_is_global };
}

interface UserTenantRow {
  user_tenant_id: string | null;
}

export async function getUserTenant(
  q: DbConnector,
  userId: string,
): Promise<{ tenantId: string | null } | null> {
  const res = await q.query<UserTenantRow>(
    `SELECT user_tenant_id FROM sys.sys_users WHERE user_id = $1`,
    [userId],
  );
  const r = res.rows[0];
  if (!r) return null;
  return { tenantId: r.user_tenant_id };
}

export async function insertTi(
  q: DbConnector,
  tenantId: string,
  body: CreateTrainingInitiativeBody,
  createdBy: string,
): Promise<TrainingInitiative> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_training_initiatives (
        training_initiative_tenant_id, training_initiative_module_id,
        training_initiative_code, training_initiative_cohort_name,
        training_initiative_start_date, training_initiative_end_date,
        training_initiative_facilitator_user_id, training_initiative_status,
        training_initiative_capacity, training_initiative_metadata, created_by
      ) VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8, $9, $10::jsonb, $11)
      RETURNING ${COLS}`,
    [
      tenantId,
      body.moduleId,
      body.code,
      body.cohortName ?? null,
      body.startDate,
      body.endDate ?? null,
      body.facilitatorUserId ?? null,
      body.status ?? "PLANNED",
      body.capacity ?? null,
      JSON.stringify(body.metadata ?? {}),
      createdBy,
    ],
  );
  return toTi(res.rows[0]!);
}

export async function updateTiPartial(
  q: DbConnector,
  id: string,
  patch: UpdateTrainingInitiativeBody,
  updatedBy: string,
): Promise<TrainingInitiative | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const addSet = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.cohortName !== undefined) addSet("training_initiative_cohort_name", patch.cohortName);
  if (patch.startDate !== undefined) {
    params.push(patch.startDate);
    sets.push(`training_initiative_start_date = $${params.length}::date`);
  }
  if (patch.endDate !== undefined) {
    params.push(patch.endDate);
    sets.push(`training_initiative_end_date = $${params.length}::date`);
  }
  if (patch.facilitatorUserId !== undefined)
    addSet("training_initiative_facilitator_user_id", patch.facilitatorUserId);
  if (patch.status !== undefined) addSet("training_initiative_status", patch.status);
  if (patch.capacity !== undefined) addSet("training_initiative_capacity", patch.capacity);
  if (patch.metadata !== undefined) {
    params.push(JSON.stringify(patch.metadata));
    sets.push(`training_initiative_metadata = $${params.length}::jsonb`);
  }
  if (sets.length === 0) return findTiById(q, id);
  sets.push(`updated_at = now()`);
  params.push(updatedBy);
  sets.push(`updated_by = $${params.length}`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_training_initiatives SET ${sets.join(", ")}
      WHERE training_initiative_id = $${params.length}
      RETURNING ${COLS}`,
    params,
  );
  return res.rows[0] ? toTi(res.rows[0]) : null;
}
