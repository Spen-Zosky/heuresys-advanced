/**
 * @heuresys/shared — Compensation & reward READ schemas. A/L7 (#32).
 *
 * Extends the compensation module (see ./compensation.ts) with read/list views
 * over six previously-dormant `sys.*` tables (all populated, never read by any
 * module until now):
 *   - sys_variable_pay_calculations     (per-person variable pay — COMPENSATION, org-gated)
 *   - sys_compensation_recommendations  (per-person recommendations — COMPENSATION, org-gated)
 *   - sys_bonus_pools                   (tenant/OU bonus pools — catalog, no person rows)
 *   - sys_objective_reward_rules        (tenant reward-rule catalog — catalog)
 *   - sys_position_economic_weight      (position weight — catalog)
 *   - sys_payroll_handoff_records       (tenant payroll handoffs — catalog, no user column)
 * READ-only (consultation). Writes (POST recommendations / handoff-records) stay
 * in ./compensation.ts. All amounts map DB numeric → number (null-guarded).
 */
import { z } from "zod";
import { paginationFields } from "./_pagination.js";
import { PayrollHandoffRecordSchema } from "./compensation.js";

// ── Variable-pay calculations (per-person — COMPENSATION, org-gated) ──────────

export const VariablePayCalculationSchema = z.object({
  variablePayCalculationId: z.uuid(),
  tenantId: z.uuid(),
  userId: z.uuid(),
  /** Resolved display name of the subject user (null if the user row is gone). */
  subjectUserName: z.string().nullable(),
  positionId: z.uuid().nullable(),
  periodStart: z.string(), // date (YYYY-MM-DD)
  periodEnd: z.string(),
  signalScore: z.number().nullable(),
  amountEur: z.number().nullable(),
  payload: z.record(z.string(), z.unknown()),
  computedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});
export type VariablePayCalculation = z.infer<typeof VariablePayCalculationSchema>;

export const VariablePayCalculationListQuerySchema = z.object({
  userId: z.uuid().optional(),
  positionId: z.uuid().optional(),
  ...paginationFields(200, 50),
});
export type VariablePayCalculationListQuery = z.infer<typeof VariablePayCalculationListQuerySchema>;

export const VariablePayCalculationListResponseSchema = z.object({
  items: z.array(VariablePayCalculationSchema),
  total: z.number().int().min(0),
});
export type VariablePayCalculationListResponse = z.infer<
  typeof VariablePayCalculationListResponseSchema
>;

// ── Compensation recommendations (read row — COMPENSATION, org-gated) ─────────
// The write-side Record (CompensationRecommendationSchema, ./compensation.ts) has no
// resolved subject name and models amountEur as a string; the READ row adds
// subjectUserName and maps amounts to numbers → a distinct schema.

export const CompensationRecommendationRowSchema = z.object({
  compensationRecommendationId: z.uuid(),
  tenantId: z.uuid(),
  userId: z.uuid(),
  /** Resolved display name of the subject user (null if the user row is gone). */
  subjectUserName: z.string().nullable(),
  positionId: z.uuid().nullable(),
  periodStart: z.string(),
  periodEnd: z.string(),
  // free string (never 500 a read on a future DB value — deterministic-seed lesson)
  signal: z.string(),
  amountEur: z.number().nullable(),
  narrative: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
  computedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});
export type CompensationRecommendationRow = z.infer<typeof CompensationRecommendationRowSchema>;

export const CompensationRecommendationListQuerySchema = z.object({
  userId: z.uuid().optional(),
  positionId: z.uuid().optional(),
  signal: z.string().max(32).optional(),
  ...paginationFields(200, 50),
});
export type CompensationRecommendationListQuery = z.infer<
  typeof CompensationRecommendationListQuerySchema
>;

export const CompensationRecommendationListResponseSchema = z.object({
  items: z.array(CompensationRecommendationRowSchema),
  total: z.number().int().min(0),
});
export type CompensationRecommendationListResponse = z.infer<
  typeof CompensationRecommendationListResponseSchema
>;

// ── Bonus pools (tenant / OU pools — catalog, no person rows) ─────────────────

export const BonusPoolSchema = z.object({
  bonusPoolId: z.uuid(),
  tenantId: z.uuid(),
  scope: z.string(),
  organizationUnitId: z.uuid().nullable(),
  periodStart: z.string(),
  periodEnd: z.string(),
  totalEur: z.number().nullable(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type BonusPool = z.infer<typeof BonusPoolSchema>;

export const BonusPoolListQuerySchema = z.object({
  scope: z.string().max(32).optional(),
  organizationUnitId: z.uuid().optional(),
  ...paginationFields(200, 50),
});
export type BonusPoolListQuery = z.infer<typeof BonusPoolListQuerySchema>;

export const BonusPoolListResponseSchema = z.object({
  items: z.array(BonusPoolSchema),
  total: z.number().int().min(0),
});
export type BonusPoolListResponse = z.infer<typeof BonusPoolListResponseSchema>;

// ── Objective reward rules (tenant catalog) ──────────────────────────────────

export const ObjectiveRewardRuleSchema = z.object({
  objectiveRewardRuleId: z.uuid(),
  tenantId: z.uuid(),
  code: z.string(),
  name: z.string(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ObjectiveRewardRule = z.infer<typeof ObjectiveRewardRuleSchema>;

export const ObjectiveRewardRuleListQuerySchema = z.object({
  code: z.string().max(128).optional(),
  ...paginationFields(200, 50),
});
export type ObjectiveRewardRuleListQuery = z.infer<typeof ObjectiveRewardRuleListQuerySchema>;

export const ObjectiveRewardRuleListResponseSchema = z.object({
  items: z.array(ObjectiveRewardRuleSchema),
  total: z.number().int().min(0),
});
export type ObjectiveRewardRuleListResponse = z.infer<
  typeof ObjectiveRewardRuleListResponseSchema
>;

// ── Position economic weight (catalog) ───────────────────────────────────────

export const PositionEconomicWeightSchema = z.object({
  positionEconomicWeightId: z.uuid(),
  positionId: z.uuid(),
  tenantId: z.uuid(),
  value: z.number(),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type PositionEconomicWeight = z.infer<typeof PositionEconomicWeightSchema>;

export const PositionEconomicWeightListQuerySchema = z.object({
  positionId: z.uuid().optional(),
  ...paginationFields(200, 50),
});
export type PositionEconomicWeightListQuery = z.infer<
  typeof PositionEconomicWeightListQuerySchema
>;

export const PositionEconomicWeightListResponseSchema = z.object({
  items: z.array(PositionEconomicWeightSchema),
  total: z.number().int().min(0),
});
export type PositionEconomicWeightListResponse = z.infer<
  typeof PositionEconomicWeightListResponseSchema
>;

// ── Payroll handoff records (catalog — reuses the write-side Record schema) ───
// The handoff Record already exists in ./compensation.ts (no user column, exact
// same shape); only the list query/response are added here.

export const PayrollHandoffRecordListQuerySchema = z.object({
  recipientSystem: z.string().max(128).optional(),
  status: z.string().max(32).optional(),
  ...paginationFields(200, 50),
});
export type PayrollHandoffRecordListQuery = z.infer<typeof PayrollHandoffRecordListQuerySchema>;

export const PayrollHandoffRecordListResponseSchema = z.object({
  items: z.array(PayrollHandoffRecordSchema),
  total: z.number().int().min(0),
});
export type PayrollHandoffRecordListResponse = z.infer<
  typeof PayrollHandoffRecordListResponseSchema
>;
