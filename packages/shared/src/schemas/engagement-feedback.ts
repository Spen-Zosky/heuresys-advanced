/**
 * @heuresys/shared — engagement feedback schemas (R1 Fase3, S988).
 * Backs /v1/engagement-feedback/* over sys.sys_engagement_feedback + sys.sys_engagement_action_plans.
 * Visibility: tenant-scoped (non-PLATFORM_ADMIN sees only own tenant; PLATFORM_ADMIN sees all).
 * Feedback is anonymous (no submitter); reviewer + action plans are full CRUD.
 * Zod v4 API (z.uuid()/z.iso.datetime()/z.record(z.string(), z.unknown())).
 */
import { z } from "zod";

const META = z.record(z.string(), z.unknown());

// ─────────────────────────── Feedback ───────────────────────────
export const FeedbackCategoryEnum = z.enum(["concern", "recognition", "suggestion", "other"]);
export const FeedbackStatusEnum = z.enum(["new", "reviewed", "actioned", "archived"]);

export const EngagementFeedbackSchema = z.object({
  feedbackId: z.uuid(),
  tenantId: z.uuid(),
  naturalKey: z.string(),
  category: FeedbackCategoryEnum,
  message: z.string(),
  status: FeedbackStatusEnum,
  reviewedByUserId: z.uuid().nullable(),
  reviewedAt: z.iso.datetime().nullable(),
  actionNotes: z.string().nullable(),
  metadata: META,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type EngagementFeedback = z.infer<typeof EngagementFeedbackSchema>;

export const EngagementFeedbackListQuerySchema = z.object({
  category: FeedbackCategoryEnum.optional(),
  status: FeedbackStatusEnum.optional(),
  search: z.string().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type EngagementFeedbackListQuery = z.infer<typeof EngagementFeedbackListQuerySchema>;

export const EngagementFeedbackListResponseSchema = z.object({
  items: z.array(EngagementFeedbackSchema),
  total: z.number().int().min(0),
});

export const CreateEngagementFeedbackBodySchema = z.object({
  tenantId: z.uuid().optional(),
  category: FeedbackCategoryEnum.optional().default("other"),
  message: z.string().min(1),
  status: FeedbackStatusEnum.optional().default("new"),
  reviewedByUserId: z.uuid().nullable().optional(),
  reviewedAt: z.iso.datetime().nullable().optional(),
  actionNotes: z.string().nullable().optional(),
  metadata: META.optional().default({}),
});
export type CreateEngagementFeedbackBody = z.infer<typeof CreateEngagementFeedbackBodySchema>;

export const UpdateEngagementFeedbackBodySchema = z.object({
  category: FeedbackCategoryEnum.optional(),
  message: z.string().min(1).optional(),
  status: FeedbackStatusEnum.optional(),
  reviewedByUserId: z.uuid().nullable().optional(),
  reviewedAt: z.iso.datetime().nullable().optional(),
  actionNotes: z.string().nullable().optional(),
  metadata: META.optional(),
});
export type UpdateEngagementFeedbackBody = z.infer<typeof UpdateEngagementFeedbackBodySchema>;

// ─────────────────────────── Action plans ───────────────────────────
export const ActionPlanSourceTypeEnum = z.enum(["feedback", "pulse", "survey"]);
export const ActionPlanStatusEnum = z.enum(["planned", "in_progress", "completed"]);
export const ActionPlanPriorityEnum = z.enum(["low", "medium", "high", "critical"]);

export const EngagementActionPlanSchema = z.object({
  actionPlanId: z.uuid(),
  tenantId: z.uuid(),
  naturalKey: z.string(),
  sourceType: ActionPlanSourceTypeEnum,
  sourceId: z.uuid().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  ownerUserId: z.uuid().nullable(),
  status: ActionPlanStatusEnum,
  priority: ActionPlanPriorityEnum,
  dueDate: z.string().nullable(),
  completedAt: z.iso.datetime().nullable(),
  createdByUserId: z.uuid().nullable(),
  metadata: META,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type EngagementActionPlan = z.infer<typeof EngagementActionPlanSchema>;

export const EngagementActionPlanListQuerySchema = z.object({
  sourceType: ActionPlanSourceTypeEnum.optional(),
  status: ActionPlanStatusEnum.optional(),
  priority: ActionPlanPriorityEnum.optional(),
  ownerUserId: z.uuid().optional(),
  search: z.string().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type EngagementActionPlanListQuery = z.infer<typeof EngagementActionPlanListQuerySchema>;

export const EngagementActionPlanListResponseSchema = z.object({
  items: z.array(EngagementActionPlanSchema),
  total: z.number().int().min(0),
});

export const CreateEngagementActionPlanBodySchema = z.object({
  tenantId: z.uuid().optional(),
  sourceType: ActionPlanSourceTypeEnum.optional().default("feedback"),
  sourceId: z.uuid().nullable().optional(),
  title: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  ownerUserId: z.uuid().nullable().optional(),
  status: ActionPlanStatusEnum.optional().default("planned"),
  priority: ActionPlanPriorityEnum.optional().default("medium"),
  dueDate: z.string().nullable().optional(),
  completedAt: z.iso.datetime().nullable().optional(),
  createdByUserId: z.uuid().nullable().optional(),
  metadata: META.optional().default({}),
});
export type CreateEngagementActionPlanBody = z.infer<typeof CreateEngagementActionPlanBodySchema>;

export const UpdateEngagementActionPlanBodySchema = z.object({
  sourceType: ActionPlanSourceTypeEnum.optional(),
  sourceId: z.uuid().nullable().optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  ownerUserId: z.uuid().nullable().optional(),
  status: ActionPlanStatusEnum.optional(),
  priority: ActionPlanPriorityEnum.optional(),
  dueDate: z.string().nullable().optional(),
  completedAt: z.iso.datetime().nullable().optional(),
  createdByUserId: z.uuid().nullable().optional(),
  metadata: META.optional(),
});
export type UpdateEngagementActionPlanBody = z.infer<typeof UpdateEngagementActionPlanBodySchema>;

// ─────────────────────────── Shared params ───────────────────────────
export const EngagementFeedbackIdParamSchema = z.object({ id: z.uuid() });
