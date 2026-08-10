/**
 * @heuresys/shared — predictions (PredictionsML) schemas (SDBI B-10b m3, S973).
 * Backs /v1/predictions/* over sys.sys_predictive_models / sys.sys_model_predictions.
 * READ MODEL ONLY: legacy precomputed predictive-analytics values exposed as-is.
 *   No in-platform ML, no recomputation, no user-facing writes -> read-only surface.
 * Visibility: tenant-scoped (non-PLATFORM_ADMIN sees only own tenant; PLATFORM_ADMIN sees all).
 * Zod v4 API (z.uuid()/z.iso.datetime()/z.record(z.string(), z.unknown())).
 */
import { z } from "zod";

import { paginationFields } from "./_pagination.js";
const META = z.record(z.string(), z.unknown());

// ─────────────────────────── Models (registry) ───────────────────────────
export const PredictiveModelTypeEnum = z.enum([
  "classification", "regression", "clustering", "timeseries", "other",
]);
export const PredictiveModelStatusEnum = z.enum([
  "draft", "active", "archived", "deprecated",
]);

export const PredictiveModelSchema = z.object({
  modelId: z.uuid(),
  tenantId: z.uuid(),
  naturalKey: z.string(),
  name: z.string(),
  type: PredictiveModelTypeEnum,
  version: z.string(),
  algorithm: z.string().nullable(),
  targetVariable: z.string().nullable(),
  status: PredictiveModelStatusEnum,
  accuracyMetrics: META,
  metadata: META,
  createdAt: z.iso.datetime(),
});
export type PredictiveModel = z.infer<typeof PredictiveModelSchema>;

export const PredictiveModelListQuerySchema = z.object({
  type: PredictiveModelTypeEnum.optional(),
  status: PredictiveModelStatusEnum.optional(),
  search: z.string().min(1).max(255).optional(),
  ...paginationFields(200, 50),
});
export type PredictiveModelListQuery = z.infer<typeof PredictiveModelListQuerySchema>;

export const PredictiveModelListResponseSchema = z.object({
  items: z.array(PredictiveModelSchema),
  total: z.number().int().min(0),
});

// ─────────────────────────── Predictions (typed read-model) ───────────────────────────
export const PredictionTypeEnum = z.enum(["GENERIC", "PERFORMANCE", "TURNOVER"]);

/**
 * Una predizione. I campi di GIUDIZIO sono opzionali perche' sotto il solo
 * mandato piattaforma vengono RIMOSSI e dichiarati in `masked` (ADR-0032, #124).
 *
 * Cosa se ne va e cosa resta, deciso sul dato reale e non per analogia
 * (misura S1054 su 468 righe / 156 soggetti):
 *  - via `value`, `label`, `confidence` — il verdetto e quanto ci si crede;
 *  - via `details` INTERO: porta `is_high_potential`, `risk_factors`,
 *    `improvement_suggestions`, `recommended_actions` e un `feature_importance`
 *    che contiene `performance_rating` e **`salary_percentile`** — cioe' sconfina
 *    perfino in COMPENSATION. Mascherare il punteggio lasciando la spiegazione
 *    significa pubblicare gli addendi dopo aver tolto la somma;
 *  - RESTA `metadata`, che a differenza di `details` porta **solo lineage di
 *    ingestione** (`source_table`, `legacy_employee_id`, `legacy_prediction_id`,
 *    `legacy_model_id`, `unresolved_model`): e' l'oggetto stesso del mandato
 *    tecnico, e toglierlo renderebbe indiagnosticabile un'importazione senza
 *    proteggere nessuno. (In `assessment-results` `metadata` viene invece
 *    mascherato: li' e' un record non tipizzato e vuoto ovunque, qui e' tipizzato
 *    dall'uso e verificato chiave per chiave.)
 *  - RESTA `naturalKey`: verificato che sia `LEGACY_MPRED::<uuid>` su tutte le
 *    righe, quindi non porta il giudizio dentro di se'.
 */
export const ModelPredictionSchema = z.object({
  predictionId: z.uuid(),
  tenantId: z.uuid(),
  naturalKey: z.string(),
  modelId: z.uuid().nullable(),
  subjectUserId: z.uuid().nullable(),
  type: PredictionTypeEnum,
  // giudizio (mascherabile, ADR-0032)
  value: z.number().nullable().optional(),
  label: z.string().nullable().optional(),
  confidence: z.number().nullable().optional(),
  details: META.optional(),
  masked: z.array(z.string()).optional(),
  validUntil: z.iso.datetime().nullable(),
  computedAt: z.iso.datetime().nullable(),
  metadata: META,
  createdAt: z.iso.datetime(),
});
export type ModelPrediction = z.infer<typeof ModelPredictionSchema>;

export const ModelPredictionListQuerySchema = z.object({
  type: PredictionTypeEnum.optional(),
  modelId: z.uuid().optional(),
  subjectUserId: z.uuid().optional(),
  label: z.string().min(1).max(100).optional(),
  ...paginationFields(500, 50),
});
export type ModelPredictionListQuery = z.infer<typeof ModelPredictionListQuerySchema>;

export const ModelPredictionListResponseSchema = z.object({
  items: z.array(ModelPredictionSchema),
  total: z.number().int().min(0),
});

// ─────────────────────────── Shared params ───────────────────────────
export const PredictionIdParamSchema = z.object({ id: z.uuid() });
