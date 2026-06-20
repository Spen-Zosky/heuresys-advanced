/**
 * @heuresys/shared — Goals schemas. Backs /v1/goals/* over sys.sys_goals.
 * Visibility: tenant-scoped. Zod v4 API. CHECK enums mirror migration 000037.
 */
import { z } from "zod";
import { paginationFields } from "./_pagination.js";

const META = z.record(z.string(), z.unknown());

export const GoalTypeEnum = z.enum([
  "OBJECTIVE","INDIVIDUAL","TECHNICAL","SALES","CUSTOMER","PERFORMANCE","PROJECT",
  "FINANCIAL","SECURITY","LEADERSHIP","DEVELOPMENT","EFFICIENCY","COMPLIANCE",
]);
export const GoalPriorityEnum = z.enum(["LOW","MEDIUM","HIGH","CRITICAL"]);
export const GoalStatusEnum = z.enum([
  "NOT_STARTED","IN_PROGRESS","ON_TRACK","AT_RISK","BLOCKED","COMPLETED","CANCELLED",
]);

export const GoalSchema = z.object({
  goalId: z.uuid(),
  tenantId: z.uuid(),
  naturalKey: z.string(),
  subjectUserId: z.uuid().nullable(),
  ownerUserId: z.uuid().nullable(),
  parentGoalId: z.uuid().nullable(),
  templateId: z.uuid().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  type: GoalTypeEnum,
  category: z.string().nullable(),
  priority: GoalPriorityEnum,
  status: GoalStatusEnum,
  progressPercent: z.number().int().min(0).max(100),
  weight: z.number(),
  startDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  completedAt: z.iso.datetime().nullable(),
  tags: z.array(z.unknown()),
  metadata: META,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Goal = z.infer<typeof GoalSchema>;

export const GoalListQuerySchema = z.object({
  status: GoalStatusEnum.optional(),
  type: GoalTypeEnum.optional(),
  priority: GoalPriorityEnum.optional(),
  ownerUserId: z.uuid().optional(),
  subjectUserId: z.uuid().optional(),
  search: z.string().min(1).max(255).optional(),
  ...paginationFields(200, 50),
});
export type GoalListQuery = z.infer<typeof GoalListQuerySchema>;

export const GoalListResponseSchema = z.object({
  items: z.array(GoalSchema),
  total: z.number().int().min(0),
});

export const CreateGoalBodySchema = z.object({
  tenantId: z.uuid().optional(),
  subjectUserId: z.uuid().nullable().optional(),
  ownerUserId: z.uuid().nullable().optional(),
  parentGoalId: z.uuid().nullable().optional(),
  templateId: z.uuid().nullable().optional(),
  title: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  type: GoalTypeEnum.optional().default("OBJECTIVE"),
  category: z.string().max(100).nullable().optional(),
  priority: GoalPriorityEnum.optional().default("MEDIUM"),
  status: GoalStatusEnum.optional().default("NOT_STARTED"),
  progressPercent: z.number().int().min(0).max(100).optional().default(0),
  weight: z.number().optional().default(1),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  metadata: META.optional().default({}),
});
export type CreateGoalBody = z.infer<typeof CreateGoalBodySchema>;

export const UpdateGoalBodySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  type: GoalTypeEnum.optional(),
  category: z.string().max(100).nullable().optional(),
  priority: GoalPriorityEnum.optional(),
  status: GoalStatusEnum.optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  weight: z.number().optional(),
  ownerUserId: z.uuid().nullable().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  completedAt: z.iso.datetime().nullable().optional(),
  metadata: META.optional(),
});
export type UpdateGoalBody = z.infer<typeof UpdateGoalBodySchema>;

export const GoalIdParamSchema = z.object({ id: z.uuid() });
