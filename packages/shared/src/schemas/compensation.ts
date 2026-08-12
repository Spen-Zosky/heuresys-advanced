/**
 * packages/shared/src/schemas/compensation.ts
 * Schemas for /v1/compensation/* (decision-support only — NOT payroll execution, I8).
 *
 * Tables backing this module (migration 000019):
 *   sys.sys_compensation_bands, sys.sys_position_compensation_profiles,
 *   sys.sys_reward_gates, sys.sys_reward_gate_results,
 *   sys.sys_compensation_recommendations, sys.sys_payroll_handoff_records.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";
// -------------------------------------------------------------------
// Compensation profile (position ↔ band)
// -------------------------------------------------------------------

export const CompensationBandSchema = z.object({
  compensationBandId: z.uuid(),
  tenantId: z.uuid().nullable(),
  code: z.string(),
  name: z.string(),
  minEur: z.string().nullable(),
  midEur: z.string().nullable(),
  maxEur: z.string().nullable(),
  isGlobal: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
});
export type CompensationBand = z.infer<typeof CompensationBandSchema>;

/**
 * GET /v1/compensation/bands — catalogo delle fasce retributive del tenant (#53 E4).
 *
 * Le fasce esistevano in tabella e nessuna API le elencava: si vedevano solo di riflesso,
 * risolte per una singola posizione. Chi deve confrontare l'inquadramento di un ruolo con
 * la fascia che gli compete non aveva una superficie dove farlo.
 *
 * `withValueOnly` di default è true: la tabella contiene ancora righe importate senza
 * valore economico, e una fascia senza importi non è una fascia — mostrarla in un catalogo
 * significa far leggere «esiste ma non so quanto vale». Chi vuole vederle tutte lo chiede.
 */
export const CompensationBandListQuerySchema = z.object({
  withValueOnly: z.coerce.boolean().optional().default(true),
  q: z.string().min(1).max(200).optional(),
  ...paginationFields(200, 100),
});
export type CompensationBandListQuery = z.infer<typeof CompensationBandListQuerySchema>;

export const CompensationBandListResponseSchema = z.object({
  items: z.array(CompensationBandSchema),
  total: z.number().int().min(0),
  /** Quante fasce il tenant possiede in tutto, comprese quelle prive di importi. */
  totalIncludingValueless: z.number().int().min(0),
});
export type CompensationBandListResponse = z.infer<typeof CompensationBandListResponseSchema>;

export const CompensationProfileSchema = z.object({
  positionCompensationProfileId: z.uuid(),
  positionId: z.uuid(),
  tenantId: z.uuid(),
  // Opzionali per la MASCHERATURA (#124): sotto mandato tecnico di piattaforma
  // la banda e il peso economico vengono tolti e dichiarati in `masked`. La
  // riga resta — posizione, tenant, date — perche' cio' che si nega e' il
  // prezzo, non l'esistenza della posizione.
  band: CompensationBandSchema.nullable().optional(),
  economicWeight: z.string().nullable().optional(),
  rewardGatesApplied: z.array(z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  masked: z.array(z.string()).optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type CompensationProfile = z.infer<typeof CompensationProfileSchema>;

export const CompensationProfilePositionParamSchema = z.object({ positionId: z.uuid() });

// -------------------------------------------------------------------
// Reward gates (catalog instance + result)
// -------------------------------------------------------------------

export const REWARD_GATE_RESULT_STATUSES = [
  "PASSED",
  "WARNING",
  "BLOCKED",
  "ESCALATED",
  "OVERRIDDEN_WITH_REASON",
] as const;
export const RewardGateResultStatusSchema = z.enum(REWARD_GATE_RESULT_STATUSES);

export const RewardGateResultSchema = z.object({
  rewardGateResultId: z.uuid(),
  rewardGateId: z.uuid(),
  tenantId: z.uuid(),
  status: RewardGateResultStatusSchema,
  // #124 D3: lo score e' un giudizio per-persona — mascherabile (ADR-0032)
  score: z.string().nullable().optional(),
  evaluatorUserId: z.uuid().nullable(),
  overrideReason: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()).optional(),
  recordedAt: z.iso.datetime(),
  masked: z.array(z.string()).optional(),
});
export type RewardGateResult = z.infer<typeof RewardGateResultSchema>;

export const RewardGateSchema = z.object({
  rewardGateId: z.uuid(),
  tenantId: z.uuid(),
  userId: z.uuid().nullable(),
  positionId: z.uuid().nullable(),
  catalogId: z.uuid(),
  catalogCode: z.string(),
  catalogName: z.string(),
  isBlocking: z.boolean(),
  periodStart: z.string(),
  periodEnd: z.string(),
  payload: z.record(z.string(), z.unknown()).optional(),
  latestResult: RewardGateResultSchema.nullable(),
  masked: z.array(z.string()).optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type RewardGate = z.infer<typeof RewardGateSchema>;

export const RewardGatesListQuerySchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  userId: z.uuid().optional(),
  positionId: z.uuid().optional(),
  status: RewardGateResultStatusSchema.optional(),
  ...paginationFields(200, 50),
});
export type RewardGatesListQuery = z.infer<typeof RewardGatesListQuerySchema>;

export const RewardGatesListResponseSchema = z.object({
  items: z.array(RewardGateSchema),
  total: z.number().int().min(0),
});

// -------------------------------------------------------------------
// Reward-gate status distribution (aggregate for charts — F4)
// -------------------------------------------------------------------

/**
 * One bucket of the reward-gate distribution. `status` is the latest result
 * status of a gate, or "PENDING" for gates that have no result yet — so it is
 * a free string, not the strict result-status enum.
 */
export const CompensationDistributionItemSchema = z.object({
  status: z.string(),
  count: z.number().int().min(0),
});
export type CompensationDistributionItem = z.infer<typeof CompensationDistributionItemSchema>;

export const CompensationDistributionResponseSchema = z.object({
  items: z.array(CompensationDistributionItemSchema),
  total: z.number().int().min(0),
});
export type CompensationDistributionResponse = z.infer<
  typeof CompensationDistributionResponseSchema
>;

// -------------------------------------------------------------------
// Recommendations
// -------------------------------------------------------------------

export const COMPENSATION_RECOMMENDATION_SIGNALS = [
  "PROPOSED",
  "APPROVED",
  "SUPPRESSED_BY_GATE",
  "ADJUSTED",
  "REJECTED",
] as const;
export const CompensationRecommendationSignalSchema = z.enum(COMPENSATION_RECOMMENDATION_SIGNALS);

/**
 * The WRITE-side record (POST /v1/compensation/recommendations). Deliberately
 * NOT masked (#124): the only amount an actor sees here is the one they just
 * submitted. Masking applies to reads of other people's rows —
 * `CompensationRecommendationRowSchema` in ./compensation-read.ts.
 */
export const CompensationRecommendationSchema = z.object({
  compensationRecommendationId: z.uuid(),
  tenantId: z.uuid(),
  userId: z.uuid(),
  positionId: z.uuid().nullable(),
  periodStart: z.string(),
  periodEnd: z.string(),
  signal: CompensationRecommendationSignalSchema,
  amountEur: z.string().nullable(),
  narrative: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
  computedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});
export type CompensationRecommendation = z.infer<typeof CompensationRecommendationSchema>;

export const CreateCompensationRecommendationBodySchema = z.object({
  userId: z.uuid(),
  positionId: z.uuid().nullable().optional(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  signal: CompensationRecommendationSignalSchema.optional().default("PROPOSED"),
  amountEur: z.string().regex(/^-?\d+(\.\d{1,2})?$/).nullable().optional(),
  narrative: z.string().max(2048).nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateCompensationRecommendationBody = z.infer<
  typeof CreateCompensationRecommendationBodySchema
>;

// -------------------------------------------------------------------
// Payroll handoff
// -------------------------------------------------------------------

export const PAYROLL_HANDOFF_STATUSES = ["PENDING", "SENT", "ACKNOWLEDGED", "REJECTED"] as const;
export const PayrollHandoffStatusSchema = z.enum(PAYROLL_HANDOFF_STATUSES);

export const PayrollHandoffRecordSchema = z.object({
  payrollHandoffRecordId: z.uuid(),
  tenantId: z.uuid(),
  periodStart: z.string(),
  periodEnd: z.string(),
  recipientSystem: z.string(),
  // #124 D3: il payload porta total_gross/total_net reali — mascherabile
  payload: z.record(z.string(), z.unknown()).optional(),
  handedOffAt: z.iso.datetime(),
  status: PayrollHandoffStatusSchema,
  createdAt: z.iso.datetime(),
  masked: z.array(z.string()).optional(),
});
export type PayrollHandoffRecord = z.infer<typeof PayrollHandoffRecordSchema>;

export const CreatePayrollHandoffRecordBodySchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recipientSystem: z.string().min(1).max(128),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
  status: PayrollHandoffStatusSchema.optional().default("PENDING"),
});
export type CreatePayrollHandoffRecordBody = z.infer<
  typeof CreatePayrollHandoffRecordBodySchema
>;

/* --- curve di payout (esposizione C5-gate) ---------------------------- */

/**
 * Le curve che traducono il raggiungimento in importo. Erano scritte dal motore
 * del premio variabile ma nessun endpoint le leggeva: chi guardava un premio non
 * poteva vedere la regola con cui era stato calcolato.
 */
export const PayoutCurveSchema = z.object({
  payoutCurveId: z.uuid(),
  tenantId: z.uuid().nullable(),
  code: z.string(),
  name: z.string(),
  kind: z.string(),
  payload: z.record(z.string(), z.unknown()),
  isGlobal: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type PayoutCurve = z.infer<typeof PayoutCurveSchema>;

export const PayoutCurveListResponseSchema = z.object({
  items: z.array(PayoutCurveSchema),
  total: z.number().int().min(0),
});
export type PayoutCurveListResponse = z.infer<typeof PayoutCurveListResponseSchema>;
