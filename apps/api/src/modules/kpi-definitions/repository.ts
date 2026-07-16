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

// ─────────────────────────────────────────────────────────────────────────────
// #31 (S1018) — KPI metrology reads (mig 000015 satellites).
// ─────────────────────────────────────────────────────────────────────────────

import type {
  KpiMetricDefinition, KpiAssessmentMethod, KpiWeightingRule,
  KpiMeasurement, KpiMeasurementListQuery,
} from "@heuresys/shared";

interface MetricRow {
  kpi_metric_definition_id: string; kpi_metric_definition_kpi_id: string;
  kpi_metric_definition_code: string; kpi_metric_definition_name: string;
  kpi_metric_definition_unit: string | null; kpi_metric_definition_aggregation: string;
  created_at: Date;
}
export async function listMetricsByKpi(
  q: DbConnector, kpiId: string,
): Promise<{ items: KpiMetricDefinition[]; total: number }> {
  const res = await q.query<MetricRow>(
    `SELECT kpi_metric_definition_id, kpi_metric_definition_kpi_id, kpi_metric_definition_code,
            kpi_metric_definition_name, kpi_metric_definition_unit, kpi_metric_definition_aggregation, created_at
       FROM sys.sys_kpi_metric_definitions WHERE kpi_metric_definition_kpi_id = $1
      ORDER BY kpi_metric_definition_code ASC`, [kpiId]);
  return {
    total: res.rowCount ?? 0,
    items: res.rows.map((r) => ({
      metricId: r.kpi_metric_definition_id, kpiId: r.kpi_metric_definition_kpi_id,
      code: r.kpi_metric_definition_code, name: r.kpi_metric_definition_name,
      unit: r.kpi_metric_definition_unit,
      aggregation: r.kpi_metric_definition_aggregation as KpiMetricDefinition["aggregation"],
      createdAt: r.created_at.toISOString(),
    })),
  };
}

interface MethodRow {
  kpi_assessment_method_id: string; kpi_assessment_method_code: string;
  kpi_assessment_method_name: string; kpi_assessment_method_description: string | null;
}
/** Global catalog — NO tenant column by design (000015 §7): never tenant-filter. */
export async function listAssessmentMethods(
  q: DbConnector,
): Promise<{ items: KpiAssessmentMethod[]; total: number }> {
  const res = await q.query<MethodRow>(
    `SELECT kpi_assessment_method_id, kpi_assessment_method_code,
            kpi_assessment_method_name, kpi_assessment_method_description
       FROM sys.sys_kpi_assessment_methods ORDER BY kpi_assessment_method_code ASC`);
  return {
    total: res.rowCount ?? 0,
    items: res.rows.map((r) => ({
      methodId: r.kpi_assessment_method_id,
      code: r.kpi_assessment_method_code as KpiAssessmentMethod["code"],
      name: r.kpi_assessment_method_name, description: r.kpi_assessment_method_description,
    })),
  };
}

interface RuleRow {
  kpi_weighting_rule_id: string; kpi_weighting_rule_code: string; kpi_weighting_rule_name: string;
  kpi_weighting_rule_kind: string; kpi_weighting_rule_payload: Record<string, unknown>;
  kpi_weighting_rule_description: string | null;
}
/** Global catalog — NO tenant column by design (000015 §8): never tenant-filter. */
export async function listWeightingRules(
  q: DbConnector,
): Promise<{ items: KpiWeightingRule[]; total: number }> {
  const res = await q.query<RuleRow>(
    `SELECT kpi_weighting_rule_id, kpi_weighting_rule_code, kpi_weighting_rule_name,
            kpi_weighting_rule_kind, kpi_weighting_rule_payload, kpi_weighting_rule_description
       FROM sys.sys_kpi_weighting_rules ORDER BY kpi_weighting_rule_code ASC`);
  return {
    total: res.rowCount ?? 0,
    items: res.rows.map((r) => ({
      ruleId: r.kpi_weighting_rule_id, code: r.kpi_weighting_rule_code,
      name: r.kpi_weighting_rule_name, kind: r.kpi_weighting_rule_kind as KpiWeightingRule["kind"],
      payload: r.kpi_weighting_rule_payload ?? {}, description: r.kpi_weighting_rule_description,
    })),
  };
}

interface MeasurementRow {
  kpi_measurement_id: string; kpi_measurement_kpi_id: string;
  kpi_measurement_user_id: string | null; kpi_measurement_position_id: string | null;
  kpi_measurement_period_start: string; kpi_measurement_period_end: string;
  kpi_measurement_value: string; kpi_measurement_unit: string | null;
  kpi_measurement_source: string | null; kpi_measurement_recorded_at: Date;
}
/**
 * Person-level rows (EVALUATION class): the service passes the org allow-list
 * for subtree/self scopes — rows for out-of-scope users are filtered out, rows
 * with NULL user (position/org-level measurements) stay visible (same rule as
 * goals list, F3).
 */
export async function listMeasurements(
  q: DbConnector, kpiId: string, tenantId: string | undefined,
  query: KpiMeasurementListQuery, userIdAllowList?: string[],
): Promise<{ items: KpiMeasurement[]; total: number }> {
  const where: string[] = ["kpi_measurement_kpi_id = $1"]; const params: unknown[] = [kpiId];
  if (tenantId) { params.push(tenantId); where.push(`kpi_measurement_tenant_id = $${params.length}`); }
  if (userIdAllowList) {
    if (userIdAllowList.length === 0) return { items: [], total: 0 };
    params.push(userIdAllowList);
    where.push(`(kpi_measurement_user_id = ANY($${params.length}::uuid[]) OR kpi_measurement_user_id IS NULL)`);
  }
  if (query.userId) { params.push(query.userId); where.push(`kpi_measurement_user_id = $${params.length}`); }
  if (query.positionId) { params.push(query.positionId); where.push(`kpi_measurement_position_id = $${params.length}`); }
  const wc = `WHERE ${where.join(" AND ")}`;
  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_kpi_measurements ${wc}`, params);
  params.push(query.limit); const lim = params.length; params.push(query.offset); const off = params.length;
  const res = await q.query<MeasurementRow>(
    `SELECT kpi_measurement_id, kpi_measurement_kpi_id, kpi_measurement_user_id, kpi_measurement_position_id,
            kpi_measurement_period_start::text AS kpi_measurement_period_start,
            kpi_measurement_period_end::text AS kpi_measurement_period_end,
            kpi_measurement_value, kpi_measurement_unit, kpi_measurement_source, kpi_measurement_recorded_at
       FROM sys.sys_kpi_measurements ${wc}
      ORDER BY kpi_measurement_period_end DESC, kpi_measurement_recorded_at DESC
      LIMIT $${lim} OFFSET $${off}`, params);
  return {
    total: Number(totalRow.rows[0]?.total ?? 0),
    items: res.rows.map((r) => ({
      measurementId: r.kpi_measurement_id, kpiId: r.kpi_measurement_kpi_id,
      userId: r.kpi_measurement_user_id, positionId: r.kpi_measurement_position_id,
      periodStart: r.kpi_measurement_period_start, periodEnd: r.kpi_measurement_period_end,
      value: Number(r.kpi_measurement_value), unit: r.kpi_measurement_unit,
      source: r.kpi_measurement_source, recordedAt: r.kpi_measurement_recorded_at.toISOString(),
    })),
  };
}
