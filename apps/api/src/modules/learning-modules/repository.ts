/**
 * apps/api/src/modules/learning-modules/repository.ts
 */

import type { Pool, PoolClient } from "pg";
import type {
  LearningModule,
  LearningModuleListQuery,
  CreateLearningModuleBody,
  UpdateLearningModuleBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  learning_module_id: string;
  learning_module_tenant_id: string | null;
  learning_module_code: string;
  learning_module_title: string;
  learning_module_description: string | null;
  learning_module_kind: string;
  learning_module_delivery: string;
  learning_module_duration_minutes: number | null;
  learning_module_is_global: boolean;
  learning_module_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const COLS = `learning_module_id, learning_module_tenant_id, learning_module_code,
  learning_module_title, learning_module_description, learning_module_kind,
  learning_module_delivery, learning_module_duration_minutes,
  learning_module_is_global, learning_module_metadata, created_at, updated_at`;

function toLm(r: Row): LearningModule {
  return {
    learningModuleId: r.learning_module_id,
    tenantId: r.learning_module_tenant_id,
    code: r.learning_module_code,
    title: r.learning_module_title,
    description: r.learning_module_description,
    kind: r.learning_module_kind as LearningModule["kind"],
    delivery: r.learning_module_delivery as LearningModule["delivery"],
    durationMinutes: r.learning_module_duration_minutes,
    isGlobal: r.learning_module_is_global,
    metadata: r.learning_module_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listLearningModules(
  q: DbConnector,
  filter: { tenantId?: string; query: LearningModuleListQuery },
): Promise<{ items: LearningModule[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`(learning_module_is_global = true OR learning_module_tenant_id = $${params.length})`);
  }
  if (filter.query.isGlobal !== undefined) {
    params.push(filter.query.isGlobal);
    where.push(`learning_module_is_global = $${params.length}`);
  }
  if (filter.query.kind) {
    params.push(filter.query.kind);
    where.push(`learning_module_kind = $${params.length}`);
  }
  if (filter.query.delivery) {
    params.push(filter.query.delivery);
    where.push(`learning_module_delivery = $${params.length}`);
  }
  if (filter.query.search) {
    params.push(`%${filter.query.search}%`);
    where.push(`(learning_module_title ILIKE $${params.length} OR learning_module_code ILIKE $${params.length})`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_learning_modules ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_learning_modules ${whereClause}
      ORDER BY learning_module_title LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toLm), total };
}

export async function findLmById(q: DbConnector, id: string): Promise<LearningModule | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_learning_modules WHERE learning_module_id = $1`, [id],
  );
  return res.rows[0] ? toLm(res.rows[0]) : null;
}

export async function findLmByCodeInScope(
  q: DbConnector,
  tenantId: string | null,
  code: string,
): Promise<LearningModule | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_learning_modules
      WHERE COALESCE(learning_module_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
            = COALESCE($1::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
        AND learning_module_code = $2`,
    [tenantId, code],
  );
  return res.rows[0] ? toLm(res.rows[0]) : null;
}

export async function insertLm(
  q: DbConnector,
  tenantId: string | null,
  body: CreateLearningModuleBody,
  createdBy: string,
): Promise<LearningModule> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_learning_modules (
        learning_module_tenant_id, learning_module_code, learning_module_title,
        learning_module_description, learning_module_kind, learning_module_delivery,
        learning_module_duration_minutes, learning_module_is_global,
        learning_module_metadata, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
      RETURNING ${COLS}`,
    [
      tenantId,
      body.code,
      body.title,
      body.description ?? null,
      body.kind,
      body.delivery,
      body.durationMinutes ?? null,
      body.isGlobal,
      JSON.stringify(body.metadata ?? {}),
      createdBy,
    ],
  );
  return toLm(res.rows[0]!);
}

export async function updateLmPartial(
  q: DbConnector,
  id: string,
  patch: UpdateLearningModuleBody,
  updatedBy: string,
): Promise<LearningModule | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const addSet = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.title !== undefined) addSet("learning_module_title", patch.title);
  if (patch.description !== undefined) addSet("learning_module_description", patch.description);
  if (patch.kind !== undefined) addSet("learning_module_kind", patch.kind);
  if (patch.delivery !== undefined) addSet("learning_module_delivery", patch.delivery);
  if (patch.durationMinutes !== undefined) addSet("learning_module_duration_minutes", patch.durationMinutes);
  if (patch.metadata !== undefined) {
    params.push(JSON.stringify(patch.metadata));
    sets.push(`learning_module_metadata = $${params.length}::jsonb`);
  }
  if (sets.length === 0) return findLmById(q, id);
  sets.push(`updated_at = now()`);
  params.push(updatedBy);
  sets.push(`updated_by = $${params.length}`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_learning_modules SET ${sets.join(", ")}
      WHERE learning_module_id = $${params.length}
      RETURNING ${COLS}`,
    params,
  );
  return res.rows[0] ? toLm(res.rows[0]) : null;
}

export async function deleteLm(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_learning_modules WHERE learning_module_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
