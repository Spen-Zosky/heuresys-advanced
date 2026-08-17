/**
 * packages/shared/src/schemas/position-succession-relevance.ts
 * 1:1 with sys_positions. Upsert by position_id.
 * readiness_horizon enum: READY_NOW/READY_6_MONTHS/READY_1_YEAR/READY_2_YEARS/NOT_READY.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";
import { queryBoolean } from "./_query-boolean.js";
export const READINESS_HORIZON_VALUES = [
  "READY_NOW",
  "READY_6_MONTHS",
  "READY_1_YEAR",
  "READY_2_YEARS",
  "NOT_READY",
] as const;
export const ReadinessHorizonSchema = z.enum(READINESS_HORIZON_VALUES);
export type ReadinessHorizon = z.infer<typeof ReadinessHorizonSchema>;

export const PositionSuccessionRelevanceSchema = z.object({
  positionSuccessionRelevanceId: z.uuid(),
  positionId: z.uuid(),
  tenantId: z.uuid(),
  isCritical: z.boolean(),
  readinessHorizon: ReadinessHorizonSchema.nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type PositionSuccessionRelevance = z.infer<typeof PositionSuccessionRelevanceSchema>;

export const PositionSuccessionRelevanceListQuerySchema = z.object({
  isCritical: queryBoolean().optional(),
  readinessHorizon: ReadinessHorizonSchema.optional(),
  ...paginationFields(200, 50),
});
export type PositionSuccessionRelevanceListQuery = z.infer<typeof PositionSuccessionRelevanceListQuerySchema>;

export const PositionSuccessionRelevanceListResponseSchema = z.object({
  items: z.array(PositionSuccessionRelevanceSchema),
  total: z.number().int().min(0),
});

export const UpsertPositionSuccessionRelevanceBodySchema = z.object({
  positionId: z.uuid(),
  isCritical: z.boolean().optional().default(false),
  readinessHorizon: ReadinessHorizonSchema.nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type UpsertPositionSuccessionRelevanceBody = z.infer<typeof UpsertPositionSuccessionRelevanceBodySchema>;

export const PositionSuccessionRelevanceIdParamSchema = z.object({ id: z.uuid() });
