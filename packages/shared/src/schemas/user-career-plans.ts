/**
 * packages/shared/src/schemas/user-career-plans.ts
 * Tenant-scoped per-user career plan. Status enum ACTIVE/COMPLETED/PAUSED/CANCELLED.
 */

import { z } from "zod";

export const USER_CAREER_PLAN_STATUS_VALUES = ["ACTIVE", "COMPLETED", "PAUSED", "CANCELLED"] as const;
export const UserCareerPlanStatusSchema = z.enum(USER_CAREER_PLAN_STATUS_VALUES);
export type UserCareerPlanStatus = z.infer<typeof UserCareerPlanStatusSchema>;

export const UserCareerPlanSchema = z.object({
  userCareerPlanId: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  pathId: z.string().uuid().nullable(),
  targetPositionId: z.string().uuid().nullable(),
  horizonMonths: z.number().int().nullable(),
  status: UserCareerPlanStatusSchema,
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UserCareerPlan = z.infer<typeof UserCareerPlanSchema>;

export const UserCareerPlanListQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  pathId: z.string().uuid().optional(),
  targetPositionId: z.string().uuid().optional(),
  status: UserCareerPlanStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type UserCareerPlanListQuery = z.infer<typeof UserCareerPlanListQuerySchema>;

export const UserCareerPlanListResponseSchema = z.object({
  items: z.array(UserCareerPlanSchema),
  total: z.number().int().min(0),
});

export const CreateUserCareerPlanBodySchema = z.object({
  userId: z.string().uuid(),
  pathId: z.string().uuid().nullable().optional(),
  targetPositionId: z.string().uuid().nullable().optional(),
  horizonMonths: z.number().int().min(0).max(1200).nullable().optional(),
  status: UserCareerPlanStatusSchema.optional().default("ACTIVE"),
  tenantId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateUserCareerPlanBody = z.infer<typeof CreateUserCareerPlanBodySchema>;

export const UpdateUserCareerPlanBodySchema = z.object({
  pathId: z.string().uuid().nullable().optional(),
  targetPositionId: z.string().uuid().nullable().optional(),
  horizonMonths: z.number().int().min(0).max(1200).nullable().optional(),
  status: UserCareerPlanStatusSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateUserCareerPlanBody = z.infer<typeof UpdateUserCareerPlanBodySchema>;

export const UserCareerPlanIdParamSchema = z.object({ id: z.string().uuid() });
