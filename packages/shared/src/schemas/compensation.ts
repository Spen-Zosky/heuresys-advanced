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

// -------------------------------------------------------------------
// Compensation profile (position ↔ band)
// -------------------------------------------------------------------

export const CompensationBandSchema = z.object({
  compensationBandId: z.string().uuid(),
  tenantId: z.string().uuid().nullable(),
  code: z.string(),
  name: z.string(),
  minEur: z.string().nullable(),
  midEur: z.string().nullable(),
  maxEur: z.string().nullable(),
  isGlobal: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
});
export type CompensationBand = z.infer<typeof CompensationBandSchema>;

export const CompensationProfileSchema = z.object({
  positionCompensationProfileId: z.string().uuid(),
  positionId: z.string().uuid(),
  tenantId: z.string().uuid(),
  band: CompensationBandSchema.nullable(),
  economicWeight: z.string().nullable(),
  rewardGatesApplied: z.array(z.unknown()),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CompensationProfile = z.infer<typeof CompensationProfileSchema>;

export const CompensationProfilePositionParamSchema = z.object({ positionId: z.string().uuid() });

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
  rewardGateResultId: z.string().uuid(),
  rewardGateId: z.string().uuid(),
  tenantId: z.string().uuid(),
  status: RewardGateResultStatusSchema,
  score: z.string().nullable(),
  evaluatorUserId: z.string().uuid().nullable(),
  overrideReason: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
  recordedAt: z.string().datetime(),
});
export type RewardGateResult = z.infer<typeof RewardGateResultSchema>;

export const RewardGateSchema = z.object({
  rewardGateId: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  positionId: z.string().uuid().nullable(),
  catalogId: z.string().uuid(),
  catalogCode: z.string(),
  catalogName: z.string(),
  isBlocking: z.boolean(),
  periodStart: z.string(),
  periodEnd: z.string(),
  payload: z.record(z.string(), z.unknown()),
  latestResult: RewardGateResultSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type RewardGate = z.infer<typeof RewardGateSchema>;

export const RewardGatesListQuerySchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  userId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  status: RewardGateResultStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type RewardGatesListQuery = z.infer<typeof RewardGatesListQuerySchema>;

export const RewardGatesListResponseSchema = z.object({
  items: z.array(RewardGateSchema),
  total: z.number().int().min(0),
});

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

export const CompensationRecommendationSchema = z.object({
  compensationRecommendationId: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  positionId: z.string().uuid().nullable(),
  periodStart: z.string(),
  periodEnd: z.string(),
  signal: CompensationRecommendationSignalSchema,
  amountEur: z.string().nullable(),
  narrative: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
  computedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type CompensationRecommendation = z.infer<typeof CompensationRecommendationSchema>;

export const CreateCompensationRecommendationBodySchema = z.object({
  userId: z.string().uuid(),
  positionId: z.string().uuid().nullable().optional(),
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
  payrollHandoffRecordId: z.string().uuid(),
  tenantId: z.string().uuid(),
  periodStart: z.string(),
  periodEnd: z.string(),
  recipientSystem: z.string(),
  payload: z.record(z.string(), z.unknown()),
  handedOffAt: z.string().datetime(),
  status: PayrollHandoffStatusSchema,
  createdAt: z.string().datetime(),
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
