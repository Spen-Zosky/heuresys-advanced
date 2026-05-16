/**
 * apps/api/src/modules/blueprint-overrides/repository.ts
 * Upsert by (activation_id, process_id).
 */
import type { Pool, PoolClient } from "pg";
import type {
  BlueprintOverride, BlueprintOverrideInclusion, BlueprintOverrideListQuery,
  UpsertBlueprintOverrideBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  blueprint_override_id: string;
  blueprint_override_activation_id: string;
  blueprint_override_process_id: string;
  blueprint_override_inclusion: BlueprintOverrideInclusion;
  blueprint_override_rationale: string | null;
  blueprint_override_metadata: Record<string, unknown>;
  created_at: Date; updated_at: Date;
}

const COLS = `blueprint_override_id, blueprint_override_activation_id,
  blueprint_override_process_id, blueprint_override_inclusion,
  blueprint_override_rationale, blueprint_override_metadata, created_at, updated_at`;

function toOv(r: Row): BlueprintOverride {
  return {
    blueprintOverrideId: r.blueprint_override_id,
    activationId: r.blueprint_override_activation_id,
    processId: r.blueprint_override_process_id,
    inclusion: r.blueprint_override_inclusion,
    rationale: r.blueprint_override_rationale,
    metadata: r.blueprint_override_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listOverrides(
  q: DbConnector, filter: { tenantId?: string; query: BlueprintOverrideListQuery },
): Promise<{ items: BlueprintOverride[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (filter.tenantId) { params.push(filter.tenantId); where.push(`a.blueprint_activation_tenant_id = $${params.length}`); }
  if (filter.query.activationId) { params.push(filter.query.activationId); where.push(`o.blueprint_override_activation_id = $${params.length}`); }
  if (filter.query.processId) { params.push(filter.query.processId); where.push(`o.blueprint_override_process_id = $${params.length}`); }
  if (filter.query.inclusion) { params.push(filter.query.inclusion); where.push(`o.blueprint_override_inclusion = $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tr = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_blueprint_overrides o
       JOIN sys.sys_blueprint_activations a ON a.blueprint_activation_id = o.blueprint_override_activation_id ${w}`, params,
  );
  params.push(filter.query.limit); const lim = params.length;
  params.push(filter.query.offset); const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS.split(",").map(c => `o.${c.trim()}`).join(", ")}
       FROM sys.sys_blueprint_overrides o
       JOIN sys.sys_blueprint_activations a ON a.blueprint_activation_id = o.blueprint_override_activation_id
       ${w} ORDER BY o.created_at DESC LIMIT $${lim} OFFSET $${off}`, params,
  );
  return { items: res.rows.map(toOv), total: Number(tr.rows[0]?.total ?? 0) };
}

export async function findOverrideById(q: DbConnector, id: string): Promise<BlueprintOverride | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_blueprint_overrides WHERE blueprint_override_id = $1`, [id]);
  return res.rows[0] ? toOv(res.rows[0]) : null;
}

export async function getActivationTenant(q: DbConnector, id: string): Promise<string | null> {
  const res = await q.query<{ t: string }>(
    `SELECT blueprint_activation_tenant_id AS t FROM sys.sys_blueprint_activations WHERE blueprint_activation_id = $1`, [id],
  );
  return res.rows[0]?.t ?? null;
}

export async function getActivationVariant(q: DbConnector, id: string): Promise<string | null> {
  const res = await q.query<{ v: string }>(
    `SELECT blueprint_activation_variant_id AS v FROM sys.sys_blueprint_activations WHERE blueprint_activation_id = $1`, [id],
  );
  return res.rows[0]?.v ?? null;
}

export async function getProcessVariant(q: DbConnector, id: string): Promise<string | null> {
  const res = await q.query<{ v: string }>(
    `SELECT blueprint_process_variant_id AS v FROM sys.sys_blueprint_process_registry WHERE blueprint_process_id = $1`, [id],
  );
  return res.rows[0]?.v ?? null;
}

export async function upsertOverride(
  q: DbConnector, body: UpsertBlueprintOverrideBody, byUserId: string,
): Promise<BlueprintOverride> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_blueprint_overrides (
        blueprint_override_activation_id, blueprint_override_process_id,
        blueprint_override_inclusion, blueprint_override_rationale,
        blueprint_override_metadata, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $6)
      ON CONFLICT (blueprint_override_activation_id, blueprint_override_process_id) DO UPDATE SET
        blueprint_override_inclusion = EXCLUDED.blueprint_override_inclusion,
        blueprint_override_rationale = EXCLUDED.blueprint_override_rationale,
        blueprint_override_metadata = EXCLUDED.blueprint_override_metadata,
        updated_at = now(),
        updated_by = EXCLUDED.updated_by
      RETURNING ${COLS}`,
    [body.activationId, body.processId, body.inclusion ?? "IN",
     body.rationale ?? null, JSON.stringify(body.metadata ?? {}), byUserId],
  );
  return toOv(res.rows[0]!);
}

export async function deleteOverride(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_blueprint_overrides WHERE blueprint_override_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
