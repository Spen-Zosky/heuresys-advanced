/**
 * packages/shared/src/schemas/user-career-plans.ts
 * Tenant-scoped per-user career plan. Status enum ACTIVE/COMPLETED/PAUSED/CANCELLED.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";
export const USER_CAREER_PLAN_STATUS_VALUES = ["ACTIVE", "COMPLETED", "PAUSED", "CANCELLED"] as const;
export const UserCareerPlanStatusSchema = z.enum(USER_CAREER_PLAN_STATUS_VALUES);
export type UserCareerPlanStatus = z.infer<typeof UserCareerPlanStatusSchema>;

export const UserCareerPlanSchema = z.object({
  userCareerPlanId: z.uuid(),
  tenantId: z.uuid(),
  userId: z.uuid(),
  pathId: z.uuid().nullable(),
  targetPositionId: z.uuid().nullable(),
  horizonMonths: z.number().int().nullable(),
  status: UserCareerPlanStatusSchema,
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type UserCareerPlan = z.infer<typeof UserCareerPlanSchema>;

export const UserCareerPlanListQuerySchema = z.object({
  userId: z.uuid().optional(),
  pathId: z.uuid().optional(),
  targetPositionId: z.uuid().optional(),
  status: UserCareerPlanStatusSchema.optional(),
  ...paginationFields(200, 50),
});
export type UserCareerPlanListQuery = z.infer<typeof UserCareerPlanListQuerySchema>;

export const UserCareerPlanListResponseSchema = z.object({
  items: z.array(UserCareerPlanSchema),
  total: z.number().int().min(0),
});

export const CreateUserCareerPlanBodySchema = z.object({
  userId: z.uuid(),
  pathId: z.uuid().nullable().optional(),
  targetPositionId: z.uuid().nullable().optional(),
  horizonMonths: z.number().int().min(0).max(1200).nullable().optional(),
  status: UserCareerPlanStatusSchema.optional().default("ACTIVE"),
  tenantId: z.uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateUserCareerPlanBody = z.infer<typeof CreateUserCareerPlanBodySchema>;

export const UpdateUserCareerPlanBodySchema = z.object({
  pathId: z.uuid().nullable().optional(),
  targetPositionId: z.uuid().nullable().optional(),
  horizonMonths: z.number().int().min(0).max(1200).nullable().optional(),
  status: UserCareerPlanStatusSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateUserCareerPlanBody = z.infer<typeof UpdateUserCareerPlanBodySchema>;

export const UserCareerPlanIdParamSchema = z.object({ id: z.uuid() });
