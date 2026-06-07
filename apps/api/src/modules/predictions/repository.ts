/**
 * apps/api/src/modules/predictions/repository.ts
 * Raw parameterized SQL for the PredictionsML read-model (2 sys.* tables).
 * READ-ONLY: legacy precomputed values exposed as-is; no inserts/updates/deletes.
 * Tenant filtering at SQL level; PLATFORM_ADMIN passes tenantId=undefined (no filter).
 * jsonb cols (accuracy_metrics/metadata/details) are parsed by node-pg.
 */
import type { Pool, PoolClient } from "pg";
import type {
  PredictiveModel, PredictiveModelListQuery,
  ModelPrediction, ModelPredictionListQuery,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

type Json = Record<string, unknown>;

// ─────────────────────────── Models ───────────────────────────
interface ModelRow {
  model_id: string; model_tenant_id: string; model_natural_key: string;
  model_name: string; model_type: string; model_version: string;
  model_algorithm: string | null; model_target_variable: string | null;
  model_status: string; model_accuracy_metrics: Json; model_metadata: Json;
  created_at: Date;
}
const MODEL_COLS = `model_id, model_tenant_id, model_natural_key, model_name, model_type, model_version,
  model_algorithm, model_target_variable, model_status, model_accuracy_metrics, model_metadata, created_at`;
function toModel(r: ModelRow): PredictiveModel {
  return {
    modelId: r.model_id, tenantId: r.model_tenant_id, naturalKey: r.model_natural_key,
    name: r.model_name, type: r.model_type as PredictiveModel["type"], version: r.model_version,
    algorithm: r.model_algorithm, targetVariable: r.model_target_variable,
    status: r.model_status as PredictiveModel["status"],
    accuracyMetrics: r.model_accuracy_metrics, metadata: r.model_metadata,
    createdAt: r.created_at.toISOString(),
  };
}

export async function listModels(
  q: DbConnector, tenantId: string | undefined, query: PredictiveModelListQuery,
): Promise<{ items: PredictiveModel[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (tenantId) { params.push(tenantId); where.push(`model_tenant_id = $${params.length}`); }
  if (query.type) { params.push(query.type); where.push(`model_type = $${params.length}`); }
  if (query.status) { params.push(query.status); where.push(`model_status = $${params.length}`); }
  if (query.search) { params.push(`%${query.search}%`); where.push(`model_name ILIKE $${params.length}`); }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totalRow = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_predictive_models ${wc}`, params);
  const total = Number(totalRow.rows[0]?.total ?? 0);
  params.push(query.limit); const lim = params.length; params.push(query.offset); const off = params.length;
  const res = await q.query<ModelRow>(`SELECT ${MODEL_COLS} FROM sys.sys_predictive_models ${wc} ORDER BY model_name LIMIT $${lim} OFFSET $${off}`, params);
  return { items: res.rows.map(toModel), total };
}
export async function findModelById(q: DbConnector, id: string): Promise<PredictiveModel | null> {
  const res = await q.query<ModelRow>(`SELECT ${MODEL_COLS} FROM sys.sys_predictive_models WHERE model_id = $1`, [id]);
  return res.rows[0] ? toModel(res.rows[0]) : null;
}

// ─────────────────────────── Predictions ───────────────────────────
interface PredictionRow {
  prediction_id: string; prediction_tenant_id: string; prediction_natural_key: string;
  prediction_model_id: string | null; prediction_subject_user_id: string | null;
  prediction_type: string; prediction_value: string | null; prediction_label: string | null;
  prediction_confidence: string | null; prediction_details: Json;
  prediction_valid_until: Date | null; prediction_computed_at: Date | null;
  prediction_metadata: Json; created_at: Date;
}
const PRED_COLS = `prediction_id, prediction_tenant_id, prediction_natural_key, prediction_model_id,
  prediction_subject_user_id, prediction_type, prediction_value, prediction_label, prediction_confidence,
  prediction_details, prediction_valid_until, prediction_computed_at, prediction_metadata, created_at`;
function toPrediction(r: PredictionRow): ModelPrediction {
  return {
    predictionId: r.prediction_id, tenantId: r.prediction_tenant_id, naturalKey: r.prediction_natural_key,
    modelId: r.prediction_model_id, subjectUserId: r.prediction_subject_user_id,
    type: r.prediction_type as ModelPrediction["type"],
    value: r.prediction_value === null ? null : Number(r.prediction_value),
    label: r.prediction_label,
    confidence: r.prediction_confidence === null ? null : Number(r.prediction_confidence),
    details: r.prediction_details,
    validUntil: r.prediction_valid_until ? r.prediction_valid_until.toISOString() : null,
    computedAt: r.prediction_computed_at ? r.prediction_computed_at.toISOString() : null,
    metadata: r.prediction_metadata, createdAt: r.created_at.toISOString(),
  };
}

export async function listPredictions(
  q: DbConnector, tenantId: string | undefined, query: ModelPredictionListQuery,
): Promise<{ items: ModelPrediction[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (tenantId) { params.push(tenantId); where.push(`prediction_tenant_id = $${params.length}`); }
  if (query.type) { params.push(query.type); where.push(`prediction_type = $${params.length}`); }
  if (query.modelId) { params.push(query.modelId); where.push(`prediction_model_id = $${params.length}`); }
  if (query.subjectUserId) { params.push(query.subjectUserId); where.push(`prediction_subject_user_id = $${params.length}`); }
  if (query.label) { params.push(query.label); where.push(`prediction_label = $${params.length}`); }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totalRow = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_model_predictions ${wc}`, params);
  const total = Number(totalRow.rows[0]?.total ?? 0);
  params.push(query.limit); const lim = params.length; params.push(query.offset); const off = params.length;
  const res = await q.query<PredictionRow>(`SELECT ${PRED_COLS} FROM sys.sys_model_predictions ${wc} ORDER BY prediction_computed_at DESC NULLS LAST, prediction_id LIMIT $${lim} OFFSET $${off}`, params);
  return { items: res.rows.map(toPrediction), total };
}
export async function findPredictionById(q: DbConnector, id: string): Promise<ModelPrediction | null> {
  const res = await q.query<PredictionRow>(`SELECT ${PRED_COLS} FROM sys.sys_model_predictions WHERE prediction_id = $1`, [id]);
  return res.rows[0] ? toPrediction(res.rows[0]) : null;
}
