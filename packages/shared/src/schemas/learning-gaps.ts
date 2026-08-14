/**
 * packages/shared/src/schemas/learning-gaps.ts
 * Tenant-scoped gap records — what a user lacks vs. position requirements.
 * Severity: LOW / MEDIUM / HIGH / CRITICAL.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";
export const LEARNING_GAP_SEVERITY_VALUES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const LearningGapSeveritySchema = z.enum(LEARNING_GAP_SEVERITY_VALUES);
export type LearningGapSeverity = z.infer<typeof LearningGapSeveritySchema>;

/**
 * Le competenze mancanti di una lacuna, normalizzate.
 *
 * PERCHÉ ESISTE, misurato il 2026-08-14 sulle 270 righe vive: `learning_gap_skill_id` e
 * `learning_gap_position_id` sono NULL su **tutte**, quindi `skillName` e `positionTitle`
 * uscivano `null` da ogni riga e la superficie non sapeva dire di quale competenza
 * parlasse. Il nome però c'era: dentro `metadata.legacy.skill_gaps`, che l'API già
 * restituiva — annegato in un blob e scritto in **due dialetti diversi**, `{skill, gap}`
 * su 66 righe e `{skill_name, current_level, target_level, gap_severity}` sulle altre.
 * Farli conoscere entrambi al client sarebbe stato chiedergli di sapere com'era fatto un
 * database che non esiste più.
 *
 * `skillName` (singolare, sopra) resta `null`: dire il nome NON è agganciare la
 * competenza al catalogo, e riempirlo lascerebbe credere il contrario. Qui il nome è
 * quello che il dato riporta di sé, e vale per quello.
 */
export const LearningGapSkillEntrySchema = z.object({
  /** Come la competenza è nominata nel dato. Non è una chiave del catalogo competenze. */
  skillName: z.string(),
  /** Livello posseduto e livello richiesto, quando il dato li porta (dialetto 2). */
  currentLevel: z.number().nullable(),
  targetLevel: z.number().nullable(),
  /** Ampiezza del divario (dialetto 1) oppure la sua etichetta (dialetto 2). */
  gap: z.number().nullable(),
  gapSeverity: z.string().nullable(),
});
export type LearningGapSkillEntry = z.infer<typeof LearningGapSkillEntrySchema>;

export const LearningGapSchema = z.object({
  learningGapId: z.uuid(),
  tenantId: z.uuid(),
  userId: z.uuid(),
  userName: z.string().nullable(), // G-02: human names resolved on the list endpoint
  positionId: z.uuid().nullable(),
  positionTitle: z.string().nullable(),
  skillId: z.uuid().nullable(),
  skillName: z.string().nullable(),
  /** Le competenze che la lacuna riguarda, lette dal dato e normalizzate. Mai `null`: se
   *  non ce ne sono, è una lista vuota — «non lo so» e «nessuna» non si confondono. */
  skillGaps: z.array(LearningGapSkillEntrySchema),
  requiredProficiency: z.string().nullable(),
  currentProficiency: z.string().nullable(),
  score: z.number().nullable(),
  severity: LearningGapSeveritySchema,
  detectedAt: z.iso.datetime(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type LearningGap = z.infer<typeof LearningGapSchema>;

export const LearningGapListQuerySchema = z.object({
  userId: z.uuid().optional(),
  positionId: z.uuid().optional(),
  skillId: z.uuid().optional(),
  severity: LearningGapSeveritySchema.optional(),
  ...paginationFields(200, 50),
});
export type LearningGapListQuery = z.infer<typeof LearningGapListQuerySchema>;

export const LearningGapListResponseSchema = z.object({
  items: z.array(LearningGapSchema),
  total: z.number().int().min(0),
});

/**
 * C4 (#42): server-side severity aggregate for the /gaps KPI strip. The page used
 * to count severities in the browser over a `?limit=200` fetch, so the strip
 * silently described only the first 200 gaps while the badge showed the true
 * total. Aggregating server-side lets the table paginate without narrowing the
 * summary. Scoped identically to the list endpoint (ADR-0027 organizational read
 * scope), so the counts never exceed what the actor may see.
 */
export const LearningGapSeverityDistributionItemSchema = z.object({
  severity: LearningGapSeveritySchema,
  count: z.number().int().min(0),
});
export type LearningGapSeverityDistributionItem = z.infer<
  typeof LearningGapSeverityDistributionItemSchema
>;

export const LearningGapSummaryResponseSchema = z.object({
  items: z.array(LearningGapSeverityDistributionItemSchema),
  total: z.number().int().min(0),
});
export type LearningGapSummaryResponse = z.infer<typeof LearningGapSummaryResponseSchema>;

export const CreateLearningGapBodySchema = z.object({
  userId: z.uuid(),
  positionId: z.uuid().nullable().optional(),
  skillId: z.uuid().nullable().optional(),
  requiredProficiency: z.string().max(32).nullable().optional(),
  currentProficiency: z.string().max(32).nullable().optional(),
  score: z.number().min(-100).max(100).nullable().optional(),
  severity: LearningGapSeveritySchema.optional().default("MEDIUM"),
  /** PLATFORM_ADMIN may override; non-platform actors pinned to own tenant. */
  tenantId: z.uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateLearningGapBody = z.infer<typeof CreateLearningGapBodySchema>;

export const UpdateLearningGapBodySchema = z.object({
  requiredProficiency: z.string().max(32).nullable().optional(),
  currentProficiency: z.string().max(32).nullable().optional(),
  score: z.number().min(-100).max(100).nullable().optional(),
  severity: LearningGapSeveritySchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateLearningGapBody = z.infer<typeof UpdateLearningGapBodySchema>;

export const LearningGapIdParamSchema = z.object({ id: z.uuid() });

// ─────────────────────────────────────────────────────────────────────────────
// #30 (S1018) — gap-closure layer: READ-only over plans (user+position-keyed,
// NOT gap-keyed), per-gap actions, and analysis results. Enums mirror 000016/17.
// ─────────────────────────────────────────────────────────────────────────────

export const GapClosureActionKindEnum = z.enum([
  "TRAINING_ASSIGNMENT","CERTIFICATION_REQUIRED","MANAGER_INTERVENTION",
  "PEER_COACHING","ON_THE_JOB_EXPOSURE","MENTORING",
]);
export const GapClosureActionStatusEnum = z.enum(["PROPOSED","IN_PROGRESS","COMPLETED","CANCELLED"]);
export const GapClosureActionSchema = z.object({
  actionId: z.uuid(),
  gapId: z.uuid(),
  kind: GapClosureActionKindEnum,
  status: GapClosureActionStatusEnum,
  ownerUserId: z.uuid().nullable(),
  dueDate: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type GapClosureAction = z.infer<typeof GapClosureActionSchema>;
export const GapClosureActionListResponseSchema = z.object({
  items: z.array(GapClosureActionSchema), total: z.number().int().min(0),
});

export const GapClosurePlanStatusEnum = z.enum(["PROPOSED","ACTIVE","COMPLETED","CANCELLED","ON_HOLD"]);
export const GapClosurePlanSchema = z.object({
  planId: z.uuid(),
  userId: z.uuid(),
  positionId: z.uuid().nullable(),
  /** jsonb array — shape is plan-authored, not normalized. */
  milestones: z.array(z.unknown()),
  status: GapClosurePlanStatusEnum,
  ownerUserId: z.uuid().nullable(),
  targetCompletionDate: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type GapClosurePlan = z.infer<typeof GapClosurePlanSchema>;
export const GapClosurePlanListQuerySchema = z.object({
  userId: z.uuid().optional(),
  status: GapClosurePlanStatusEnum.optional(),
  ...paginationFields(200, 50),
});
export type GapClosurePlanListQuery = z.infer<typeof GapClosurePlanListQuerySchema>;
export const GapClosurePlanListResponseSchema = z.object({
  items: z.array(GapClosurePlanSchema), total: z.number().int().min(0),
});

export const GapAnalysisResultKindEnum = z.enum(["SKILL","KPI","LEARNING","CERTIFICATION","BEHAVIORAL","COMPOSITE"]);
export const GapAnalysisResultSchema = z.object({
  resultId: z.uuid(),
  userId: z.uuid(),
  positionId: z.uuid().nullable(),
  kind: GapAnalysisResultKindEnum,
  overallScore: z.number().nullable(),
  payload: z.record(z.string(), z.unknown()),
  computedAt: z.iso.datetime(),
});
export type GapAnalysisResult = z.infer<typeof GapAnalysisResultSchema>;
export const GapAnalysisResultListQuerySchema = z.object({
  userId: z.uuid().optional(),
  kind: GapAnalysisResultKindEnum.optional(),
  ...paginationFields(200, 50),
});
export type GapAnalysisResultListQuery = z.infer<typeof GapAnalysisResultListQuerySchema>;
export const GapAnalysisResultListResponseSchema = z.object({
  items: z.array(GapAnalysisResultSchema), total: z.number().int().min(0),
});

/** GET /v1/me/gaps/closure — own plans + actions on own gaps (I17 self floor). */
export const MeGapClosureResponseSchema = z.object({
  plans: z.array(GapClosurePlanSchema),
  actions: z.array(GapClosureActionSchema),
});
export type MeGapClosureResponse = z.infer<typeof MeGapClosureResponseSchema>;
