/**
 * apps/api/src/modules/process-kpi-templates/repository.ts
 * Global junction (blueprint process ↔ KPI). PLATFORM_ADMIN only for writes.
 */
import type { Pool, PoolClient } from "pg";
import type {
  ProcessKpiTemplate, ProcessKpiTemplateListQuery, UpsertProcessKpiTemplateBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  process_kpi_template_id: string;
  process_kpi_template_process_id: string;
  process_kpi_template_kpi_id: string;
  process_kpi_template_default_weight: string;
  process_kpi_template_default_target: Record<string, unknown>;
  process_kpi_template_metadata: Record<string, unknown>;
  created_at: Date; updated_at: Date;
}

const COLS = `process_kpi_template_id, process_kpi_template_process_id, process_kpi_template_kpi_id,
  process_kpi_template_default_weight, process_kpi_template_default_target,
  process_kpi_template_metadata, created_at, updated_at`;

function toRow(r: Row): ProcessKpiTemplate {
  return {
    processKpiTemplateId: r.process_kpi_template_id,
    processId: r.process_kpi_template_process_id,
    kpiId: r.process_kpi_template_kpi_id,
    defaultWeight: Number(r.process_kpi_template_default_weight),
    defaultTarget: r.process_kpi_template_default_target,
    metadata: r.process_kpi_template_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listTemplates(
  q: DbConnector, query: ProcessKpiTemplateListQuery,
): Promise<{ items: ProcessKpiTemplate[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (query.processId) { params.push(query.processId); where.push(`process_kpi_template_process_id = $${params.length}`); }
  if (query.kpiId) { params.push(query.kpiId); where.push(`process_kpi_template_kpi_id = $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tr = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_process_kpi_templates ${w}`, params);
  params.push(query.limit); const lim = params.length;
  params.push(query.offset); const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_process_kpi_templates ${w}
      ORDER BY created_at DESC LIMIT $${lim} OFFSET $${off}`, params,
  );
  return { items: res.rows.map(toRow), total: Number(tr.rows[0]?.total ?? 0) };
}

export async function findTemplateById(q: DbConnector, id: string): Promise<ProcessKpiTemplate | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_process_kpi_templates WHERE process_kpi_template_id = $1`, [id]);
  return res.rows[0] ? toRow(res.rows[0]) : null;
}

export async function processExists(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query<{ x: number }>(`SELECT 1 AS x FROM sys.sys_blueprint_process_registry WHERE blueprint_process_id = $1 LIMIT 1`, [id]);
  return res.rows.length > 0;
}

export async function kpiExists(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query<{ x: number }>(`SELECT 1 AS x FROM sys.sys_kpi_definitions WHERE kpi_definition_id = $1 LIMIT 1`, [id]);
  return res.rows.length > 0;
}

export async function upsertTemplate(q: DbConnector, body: UpsertProcessKpiTemplateBody): Promise<ProcessKpiTemplate> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_process_kpi_templates (
        process_kpi_template_process_id, process_kpi_template_kpi_id,
        process_kpi_template_default_weight, process_kpi_template_default_target,
        process_kpi_template_metadata
      ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
      ON CONFLICT (process_kpi_template_process_id, process_kpi_template_kpi_id) DO UPDATE SET
        process_kpi_template_default_weight = EXCLUDED.process_kpi_template_default_weight,
        process_kpi_template_default_target = EXCLUDED.process_kpi_template_default_target,
        process_kpi_template_metadata = EXCLUDED.process_kpi_template_metadata,
        updated_at = now()
      RETURNING ${COLS}`,
    [body.processId, body.kpiId, body.defaultWeight ?? 1.0,
     JSON.stringify(body.defaultTarget ?? {}), JSON.stringify(body.metadata ?? {})],
  );
  return toRow(res.rows[0]!);
}

export async function deleteTemplate(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_process_kpi_templates WHERE process_kpi_template_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
