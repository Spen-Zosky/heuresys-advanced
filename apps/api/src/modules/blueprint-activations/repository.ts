/**
 * apps/api/src/modules/blueprint-activations/repository.ts
 * Tenant-scoped activation. Only one ACTIVE per tenant (partial unique index in DB).
 */
import type { Pool, PoolClient } from "pg";
import type {
  BlueprintActivation, BlueprintActivationStatus, BlueprintActivationListQuery,
  CreateBlueprintActivationBody, UpdateBlueprintActivationBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  blueprint_activation_id: string; blueprint_activation_tenant_id: string;
  blueprint_activation_variant_id: string;
  blueprint_activation_status: BlueprintActivationStatus;
  blueprint_activation_effective_from: Date;
  blueprint_activation_effective_to: Date | null;
  blueprint_activation_metadata: Record<string, unknown>;
  created_at: Date; updated_at: Date;
}

import { toDateOnly } from "../../lib/date-only.js";

const COLS = `blueprint_activation_id, blueprint_activation_tenant_id,
  blueprint_activation_variant_id, blueprint_activation_status,
  blueprint_activation_effective_from, blueprint_activation_effective_to,
  blueprint_activation_metadata, created_at, updated_at`;

function toAct(r: Row): BlueprintActivation {
  return {
    blueprintActivationId: r.blueprint_activation_id,
    tenantId: r.blueprint_activation_tenant_id,
    variantId: r.blueprint_activation_variant_id,
    status: r.blueprint_activation_status,
    effectiveFrom: toDateOnly(r.blueprint_activation_effective_from)!,
    effectiveTo: toDateOnly(r.blueprint_activation_effective_to),
    metadata: r.blueprint_activation_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listActivations(
  q: DbConnector, filter: { tenantId?: string; query: BlueprintActivationListQuery },
): Promise<{ items: BlueprintActivation[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (filter.tenantId) { params.push(filter.tenantId); where.push(`blueprint_activation_tenant_id = $${params.length}`); }
  if (filter.query.variantId) { params.push(filter.query.variantId); where.push(`blueprint_activation_variant_id = $${params.length}`); }
  if (filter.query.status) { params.push(filter.query.status); where.push(`blueprint_activation_status = $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tr = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_blueprint_activations ${w}`, params);
  params.push(filter.query.limit); const lim = params.length;
  params.push(filter.query.offset); const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_blueprint_activations ${w}
      ORDER BY created_at DESC LIMIT $${lim} OFFSET $${off}`, params,
  );
  return { items: res.rows.map(toAct), total: Number(tr.rows[0]?.total ?? 0) };
}

export async function findActivationById(q: DbConnector, id: string): Promise<BlueprintActivation | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_blueprint_activations WHERE blueprint_activation_id = $1`, [id]);
  return res.rows[0] ? toAct(res.rows[0]) : null;
}

export async function findActiveByTenant(
  q: DbConnector, tenantId: string,
): Promise<BlueprintActivation | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_blueprint_activations
      WHERE blueprint_activation_tenant_id = $1 AND blueprint_activation_status = 'ACTIVE'
      LIMIT 1`,
    [tenantId],
  );
  return res.rows[0] ? toAct(res.rows[0]) : null;
}

export async function variantExists(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query<{ x: number }>(`SELECT 1 AS x FROM sys.sys_blueprint_variants WHERE blueprint_variant_id = $1 LIMIT 1`, [id]);
  return res.rows.length > 0;
}

export async function insertActivation(
  q: DbConnector, tenantId: string, body: CreateBlueprintActivationBody, createdBy: string,
): Promise<BlueprintActivation> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_blueprint_activations (
        blueprint_activation_tenant_id, blueprint_activation_variant_id,
        blueprint_activation_status, blueprint_activation_effective_from,
        blueprint_activation_effective_to, blueprint_activation_metadata, created_by
      ) VALUES ($1, $2, $3, COALESCE($4::date, current_date), $5::date, $6::jsonb, $7)
      RETURNING ${COLS}`,
    [tenantId, body.variantId, body.status ?? "PROPOSED",
     body.effectiveFrom ?? null, body.effectiveTo ?? null,
     JSON.stringify(body.metadata ?? {}), createdBy],
  );
  return toAct(res.rows[0]!);
}

export async function updateActivationPartial(
  q: DbConnector, id: string, patch: UpdateBlueprintActivationBody, updatedBy: string,
): Promise<BlueprintActivation | null> {
  const sets: string[] = []; const params: unknown[] = [];
  const add = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.status !== undefined) add("blueprint_activation_status", patch.status);
  if (patch.effectiveFrom !== undefined) {
    params.push(patch.effectiveFrom);
    sets.push(`blueprint_activation_effective_from = $${params.length}::date`);
  }
  if (patch.effectiveTo !== undefined) {
    params.push(patch.effectiveTo);
    sets.push(`blueprint_activation_effective_to = $${params.length}::date`);
  }
  if (patch.metadata !== undefined) { params.push(JSON.stringify(patch.metadata)); sets.push(`blueprint_activation_metadata = $${params.length}::jsonb`); }
  if (sets.length === 0) return findActivationById(q, id);
  sets.push(`updated_at = now()`);
  params.push(updatedBy); sets.push(`updated_by = $${params.length}`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_blueprint_activations SET ${sets.join(", ")}
      WHERE blueprint_activation_id = $${params.length} RETURNING ${COLS}`, params,
  );
  return res.rows[0] ? toAct(res.rows[0]) : null;
}

export async function deleteActivation(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_blueprint_activations WHERE blueprint_activation_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
