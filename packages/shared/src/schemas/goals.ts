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
  // `status` NON e' mascherabile per mandato esplicito: ADR-0032/I20 vuole che
  // «riga, soggetto, periodo e STATO» restino visibili. Se ne va il QUANTO.
  status: GoalStatusEnum,
  progressPercent: z.number().int().min(0).max(100).optional(),
  masked: z.array(z.string()).optional(),
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

// ─────────────────────────────────────────────────────────────────────────────
// #26 (S1018) — goal-life sub-resources: READ-only over the 000037 satellite
// tables (updates / check-ins / milestones / comments / alignments / templates).
// CHECK enums mirror migration 000037. Event logs are immutable (no updatedAt).
// ─────────────────────────────────────────────────────────────────────────────

export const GoalUpdateTypeEnum = z.enum(["PROGRESS","STATUS_CHANGE","MILESTONE","BLOCKER","NOTE"]);
export const GoalUpdateSchema = z.object({
  updateId: z.uuid(),
  goalId: z.uuid(),
  authorUserId: z.uuid().nullable(),
  type: GoalUpdateTypeEnum,
  // giudizio (mascherabile, ADR-0032 / #124 D4): l'avanzamento e il testo scritto.
  // Gli STATI restano (I20), come restano tipo, autore e data: si continua a
  // sapere che l'aggiornamento c'e' stato, chi l'ha fatto e che genere era.
  previousProgress: z.number().nullable().optional(),
  newProgress: z.number().nullable().optional(),
  content: z.string().nullable().optional(),
  attachments: z.array(z.unknown()).optional(),
  masked: z.array(z.string()).optional(),
  previousStatus: z.string().nullable(),
  newStatus: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type GoalUpdate = z.infer<typeof GoalUpdateSchema>;
export const GoalUpdateListResponseSchema = z.object({
  items: z.array(GoalUpdateSchema), total: z.number().int().min(0),
});

export const GoalCheckInStatusEnum = z.enum(["ON_TRACK","AHEAD","AT_RISK","BLOCKED","COMPLETED"]);
export const GoalCheckInSchema = z.object({
  checkInId: z.uuid(),
  goalId: z.uuid(),
  subjectUserId: z.uuid(),
  date: z.string(),
  // giudizio (mascherabile, ADR-0032 / #124 D4). `confidenceLevel` e' quanto la
  // persona si sente sicura di farcela: e' una autovalutazione, e va con le altre.
  previousProgress: z.number().int().nullable().optional(),
  newProgress: z.number().int().min(0).max(100).optional(),
  notes: z.string().nullable().optional(),
  blockers: z.string().nullable().optional(),
  nextSteps: z.string().nullable().optional(),
  confidenceLevel: z.number().int().min(1).max(5).nullable().optional(),
  masked: z.array(z.string()).optional(),
  statusUpdate: GoalCheckInStatusEnum.nullable(),
  createdAt: z.iso.datetime(),
});
export type GoalCheckIn = z.infer<typeof GoalCheckInSchema>;
export const GoalCheckInListResponseSchema = z.object({
  items: z.array(GoalCheckInSchema), total: z.number().int().min(0),
});

export const GoalMilestoneStatusEnum = z.enum(["PENDING","IN_PROGRESS","COMPLETED","MISSED","CANCELLED"]);
export const GoalMilestoneSchema = z.object({
  milestoneId: z.uuid(),
  goalId: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  targetDate: z.string().nullable(),
  completedAt: z.iso.datetime().nullable(),
  status: GoalMilestoneStatusEnum,
  weight: z.number(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type GoalMilestone = z.infer<typeof GoalMilestoneSchema>;
export const GoalMilestoneListResponseSchema = z.object({
  items: z.array(GoalMilestoneSchema), total: z.number().int().min(0),
});

export const GoalCommentSchema = z.object({
  commentId: z.uuid(),
  goalId: z.uuid(),
  authorUserId: z.uuid().nullable(),
  parentCommentId: z.uuid().nullable(),
  // giudizio (mascherabile): il testo di un commento su un obiettivo altrui e'
  // giudizio in lettere, come `narrative` su un'evidenza. Restano autore, data e
  // il fatto che il commento esista.
  content: z.string().optional(),
  masked: z.array(z.string()).optional(),
  isPrivate: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type GoalComment = z.infer<typeof GoalCommentSchema>;
export const GoalCommentListResponseSchema = z.object({
  items: z.array(GoalCommentSchema), total: z.number().int().min(0),
});

export const GoalAlignmentTypeEnum = z.enum(["SUPPORTS","CONTRIBUTES_TO","DERIVED_FROM","DEPENDS_ON"]);
export const GoalAlignmentSchema = z.object({
  alignmentId: z.uuid(),
  sourceGoalId: z.uuid(),
  alignedGoalId: z.uuid(),
  /** Title of the OTHER goal in the pair (joined server-side for display). */
  alignedGoalTitle: z.string().nullable(),
  /** "OUT" = this goal supports/depends-on another; "IN" = another goal aligns to this one. */
  direction: z.enum(["OUT","IN"]),
  type: GoalAlignmentTypeEnum,
  weight: z.number(),
  createdAt: z.iso.datetime(),
});
export type GoalAlignment = z.infer<typeof GoalAlignmentSchema>;
export const GoalAlignmentListResponseSchema = z.object({
  items: z.array(GoalAlignmentSchema), total: z.number().int().min(0),
});

export const GoalTemplateDifficultyEnum = z.enum(["EASY","MEDIUM","HARD","STRETCH"]);
export const GoalTemplateSchema = z.object({
  templateId: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  goalType: GoalTypeEnum,
  suggestedMetrics: z.array(z.string()).nullable(),
  suggestedDurationDays: z.number().int().nullable(),
  suggestedWeight: z.number(),
  difficultyLevel: GoalTemplateDifficultyEnum,
  isCompanyWide: z.boolean(),
  usageCount: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type GoalTemplate = z.infer<typeof GoalTemplateSchema>;
export const GoalTemplateListQuerySchema = z.object({
  category: z.string().max(100).optional(),
  isActive: z.coerce.boolean().optional(),
  ...paginationFields(200, 50),
});
export type GoalTemplateListQuery = z.infer<typeof GoalTemplateListQuerySchema>;
export const GoalTemplateListResponseSchema = z.object({
  items: z.array(GoalTemplateSchema), total: z.number().int().min(0),
});

/** Shared limit/offset for the per-goal sub-resource lists. */
export const GoalSubListQuerySchema = z.object({ ...paginationFields(200, 50) });
export type GoalSubListQuery = z.infer<typeof GoalSubListQuerySchema>;

/** Merged per-goal activity timeline (updates ∪ check-ins ∪ milestones), newest first. */
export const GoalTimelineEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("UPDATE"), at: z.iso.datetime(), update: GoalUpdateSchema }),
  z.object({ kind: z.literal("CHECK_IN"), at: z.iso.datetime(), checkIn: GoalCheckInSchema }),
  z.object({ kind: z.literal("MILESTONE"), at: z.iso.datetime(), milestone: GoalMilestoneSchema }),
]);
export type GoalTimelineEvent = z.infer<typeof GoalTimelineEventSchema>;
export const GoalTimelineResponseSchema = z.object({
  goal: GoalSchema,
  events: z.array(GoalTimelineEventSchema),
});
export type GoalTimelineResponse = z.infer<typeof GoalTimelineResponseSchema>;
