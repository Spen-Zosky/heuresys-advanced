/**
 * apps/api/src/modules/kpi-definitions/repository.ts
 * Raw SQL for sys.sys_kpi_definitions.
 */

import type { Pool, PoolClient } from "pg";
import type {
  KpiDefinition,
  KpiDefinitionListQuery,
  CreateKpiDefinitionBody,
  UpdateKpiDefinitionBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  kpi_definition_id: string;
  kpi_definition_tenant_id: string | null;
  kpi_definition_code: string;
  kpi_definition_name: string;
  kpi_definition_description: string | null;
  kpi_definition_formula: string | null;
  kpi_definition_unit: string | null;
  kpi_definition_polarity: string;
  kpi_definition_is_global: boolean;
  kpi_definition_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const COLS = `kpi_definition_id, kpi_definition_tenant_id, kpi_definition_code,
  kpi_definition_name, kpi_definition_description, kpi_definition_formula,
  kpi_definition_unit, kpi_definition_polarity, kpi_definition_is_global,
  kpi_definition_metadata, created_at, updated_at`;

function toKpi(r: Row): KpiDefinition {
  return {
    kpiDefinitionId: r.kpi_definition_id,
    tenantId: r.kpi_definition_tenant_id,
    code: r.kpi_definition_code,
    name: r.kpi_definition_name,
    description: r.kpi_definition_description,
    formula: r.kpi_definition_formula,
    unit: r.kpi_definition_unit,
    polarity: r.kpi_definition_polarity as KpiDefinition["polarity"],
    isGlobal: r.kpi_definition_is_global,
    metadata: r.kpi_definition_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listKpiDefinitions(
  q: DbConnector,
  filter: { tenantId?: string; query: KpiDefinitionListQuery },
): Promise<{ items: KpiDefinition[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`(kpi_definition_is_global = true OR kpi_definition_tenant_id = $${params.length})`);
  }
  if (filter.query.isGlobal !== undefined) {
    params.push(filter.query.isGlobal);
    where.push(`kpi_definition_is_global = $${params.length}`);
  }
  if (filter.query.polarity) {
    params.push(filter.query.polarity);
    where.push(`kpi_definition_polarity = $${params.length}`);
  }
  if (filter.query.search) {
    params.push(`%${filter.query.search}%`);
    where.push(`(kpi_definition_name ILIKE $${params.length} OR kpi_definition_code ILIKE $${params.length})`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_kpi_definitions ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(filter.query.limit);
  const limIdx = params.length;
  params.push(filter.query.offset);
  const offIdx = params.length;

  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_kpi_definitions ${whereClause}
      ORDER BY kpi_definition_name LIMIT $${limIdx} OFFSET $${offIdx}`,
    params,
  );
  return { items: res.rows.map(toKpi), total };
}

export async function findKpiById(q: DbConnector, id: string): Promise<KpiDefinition | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_kpi_definitions WHERE kpi_definition_id = $1`,
    [id],
  );
  return res.rows[0] ? toKpi(res.rows[0]) : null;
}

export async function findKpiByCodeInScope(
  q: DbConnector,
  tenantId: string | null,
  code: string,
): Promise<KpiDefinition | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_kpi_definitions
      WHERE COALESCE(kpi_definition_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
            = COALESCE($1::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
        AND kpi_definition_code = $2`,
    [tenantId, code],
  );
  return res.rows[0] ? toKpi(res.rows[0]) : null;
}

export async function insertKpi(
  q: DbConnector,
  tenantId: string | null,
  body: CreateKpiDefinitionBody,
  createdBy: string,
): Promise<KpiDefinition> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_kpi_definitions (
        kpi_definition_tenant_id, kpi_definition_code, kpi_definition_name,
        kpi_definition_description, kpi_definition_formula, kpi_definition_unit,
        kpi_definition_polarity, kpi_definition_is_global,
        kpi_definition_metadata, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
      RETURNING ${COLS}`,
    [
      tenantId,
      body.code,
      body.name,
      body.description ?? null,
      body.formula ?? null,
      body.unit ?? null,
      body.polarity,
      body.isGlobal,
      JSON.stringify(body.metadata ?? {}),
      createdBy,
    ],
  );
  return toKpi(res.rows[0]!);
}

export async function updateKpiPartial(
  q: DbConnector,
  id: string,
  patch: UpdateKpiDefinitionBody,
  updatedBy: string,
): Promise<KpiDefinition | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const addSet = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.name !== undefined) addSet("kpi_definition_name", patch.name);
  if (patch.description !== undefined) addSet("kpi_definition_description", patch.description);
  if (patch.formula !== undefined) addSet("kpi_definition_formula", patch.formula);
  if (patch.unit !== undefined) addSet("kpi_definition_unit", patch.unit);
  if (patch.polarity !== undefined) addSet("kpi_definition_polarity", patch.polarity);
  if (patch.metadata !== undefined) {
    params.push(JSON.stringify(patch.metadata));
    sets.push(`kpi_definition_metadata = $${params.length}::jsonb`);
  }
  if (sets.length === 0) return findKpiById(q, id);
  sets.push(`updated_at = now()`);
  params.push(updatedBy);
  sets.push(`updated_by = $${params.length}`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_kpi_definitions SET ${sets.join(", ")}
      WHERE kpi_definition_id = $${params.length}
      RETURNING ${COLS}`,
    params,
  );
  return res.rows[0] ? toKpi(res.rows[0]) : null;
}

export async function deleteKpi(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_kpi_definitions WHERE kpi_definition_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
