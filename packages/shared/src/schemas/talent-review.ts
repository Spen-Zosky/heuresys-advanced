/**
 * @heuresys/shared — Talent-review read schemas. A/L3 (#29).
 *
 * Backs /v1/talent-review/* over six dormant talent-intelligence `sys.*` tables
 * (all populated, never read by any module until now):
 *   - sys_talent_scores                    → 9-box grid (EVALUATION, org-gated)
 *   - sys_employee_position_fit_scores     → position fit (EVALUATION, org-gated)
 *   - sys_readiness_scores                 → readiness (EVALUATION, org-gated)
 *   - sys_succession_scores                → succession (EVALUATION, org-gated)
 *   - sys_critical_positions               → critical positions (catalog, no person rows)
 *   - sys_critical_role_coverage_status    → critical-role coverage (catalog, no person rows)
 * READ-only (board-ready consultation). Self-view is OFF by product decision
 * (no `talent:read:self`); talent data is a management surface, org-gated.
 */
import { z } from "zod";
import { paginationFields } from "./_pagination.js";

/** Bucketed band on either 9-box axis (potential / performance). */
export const TalentBandEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type TalentBand = z.infer<typeof TalentBandEnum>;

// ── 9-box (sys_talent_scores) ────────────────────────────────────────────────

/** One talent_scores row projected onto the 9-box grid. The DB `band`
 *  (CORE/STAR/HIGH_PERFORMER) stays `z.string()` so a future value can never 500
 *  a read; the two derived bands are the closed enum the grid is built from. */
export const NineBoxRowSchema = z.object({
  talentScoreId: z.uuid(),
  userId: z.uuid(),
  /** Resolved display name of the subject user (null if the user row is gone). */
  subjectUserName: z.string().nullable(),
  // giudizio (mascherabile, ADR-0032 / #124 D4). Le due BANDE sono derivate dai
  // due punteggi: mascherare `potential`/`performance` e lasciare le bande
  // significherebbe pubblicare la casella del 9-box, cioe' la conclusione.
  potential: z.number().nullable().optional(),
  performance: z.number().nullable().optional(),
  band: z.string().nullable().optional(),
  potentialBand: TalentBandEnum.optional(),
  performanceBand: TalentBandEnum.optional(),
  masked: z.array(z.string()).optional(),
  computedAt: z.iso.datetime(),
});
export type NineBoxRow = z.infer<typeof NineBoxRowSchema>;

export const NineBoxListQuerySchema = z.object({
  userId: z.uuid().optional(),
  ...paginationFields(200, 50),
});
export type NineBoxListQuery = z.infer<typeof NineBoxListQuerySchema>;

export const NineBoxListResponseSchema = z.object({
  items: z.array(NineBoxRowSchema),
  total: z.number().int().min(0),
});
export type NineBoxListResponse = z.infer<typeof NineBoxListResponseSchema>;

// ── Position fit (sys_employee_position_fit_scores) ──────────────────────────

export const FitScoreSchema = z.object({
  fitScoreId: z.uuid(),
  tenantId: z.uuid(),
  userId: z.uuid(),
  subjectUserName: z.string().nullable(),
  positionId: z.uuid(),
  dimension: z.string(),
  // giudizio (mascherabile, ADR-0032 / #124 D4): il punteggio e il payload che
  // lo spiega. La DIMENSIONE resta — dice su cosa e' stato valutato, non quanto.
  score: z.number().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  masked: z.array(z.string()).optional(),
  computedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});
export type FitScore = z.infer<typeof FitScoreSchema>;

export const FitScoreListQuerySchema = z.object({
  userId: z.uuid().optional(),
  ...paginationFields(200, 50),
});
export type FitScoreListQuery = z.infer<typeof FitScoreListQuerySchema>;

export const FitScoreListResponseSchema = z.object({
  items: z.array(FitScoreSchema),
  total: z.number().int().min(0),
});
export type FitScoreListResponse = z.infer<typeof FitScoreListResponseSchema>;

// ── Readiness (sys_readiness_scores) ─────────────────────────────────────────

export const ReadinessScoreSchema = z.object({
  readinessScoreId: z.uuid(),
  tenantId: z.uuid(),
  userId: z.uuid(),
  subjectUserName: z.string().nullable(),
  positionId: z.uuid(),
  horizon: z.string(),
  // giudizio (mascherabile, ADR-0032 / #124 D4). L'ORIZZONTE resta: dice entro
  // quando ci si chiede se la persona sia pronta, non la risposta.
  value: z.number().nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  masked: z.array(z.string()).optional(),
  computedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});
export type ReadinessScore = z.infer<typeof ReadinessScoreSchema>;

export const ReadinessScoreListQuerySchema = z.object({
  userId: z.uuid().optional(),
  horizon: z.string().max(32).optional(),
  ...paginationFields(200, 50),
});
export type ReadinessScoreListQuery = z.infer<typeof ReadinessScoreListQuerySchema>;

export const ReadinessScoreListResponseSchema = z.object({
  items: z.array(ReadinessScoreSchema),
  total: z.number().int().min(0),
});
export type ReadinessScoreListResponse = z.infer<typeof ReadinessScoreListResponseSchema>;

// ── Succession (sys_succession_scores) ───────────────────────────────────────

export const SuccessionScoreSchema = z.object({
  successionScoreId: z.uuid(),
  tenantId: z.uuid(),
  userId: z.uuid(),
  subjectUserName: z.string().nullable(),
  positionId: z.uuid(),
  // giudizio (mascherabile, ADR-0032 / #124 D4)
  value: z.number().nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  masked: z.array(z.string()).optional(),
  horizon: z.string().nullable(),
  computedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});
export type SuccessionScore = z.infer<typeof SuccessionScoreSchema>;

export const SuccessionScoreListQuerySchema = z.object({
  userId: z.uuid().optional(),
  horizon: z.string().max(32).optional(),
  ...paginationFields(200, 50),
});
export type SuccessionScoreListQuery = z.infer<typeof SuccessionScoreListQuerySchema>;

export const SuccessionScoreListResponseSchema = z.object({
  items: z.array(SuccessionScoreSchema),
  total: z.number().int().min(0),
});
export type SuccessionScoreListResponse = z.infer<typeof SuccessionScoreListResponseSchema>;

// ── Critical positions (sys_critical_positions — catalog, no person rows) ────

export const CriticalPositionSchema = z.object({
  criticalPositionId: z.uuid(),
  tenantId: z.uuid(),
  positionId: z.uuid(),
  rationale: z.string().nullable(),
  businessImpactScore: z.number().nullable(),
  flaggedAt: z.iso.datetime(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  createdBy: z.uuid().nullable(),
});
export type CriticalPosition = z.infer<typeof CriticalPositionSchema>;

export const CriticalPositionListQuerySchema = z.object({
  ...paginationFields(200, 50),
});
export type CriticalPositionListQuery = z.infer<typeof CriticalPositionListQuerySchema>;

export const CriticalPositionListResponseSchema = z.object({
  items: z.array(CriticalPositionSchema),
  total: z.number().int().min(0),
});
export type CriticalPositionListResponse = z.infer<typeof CriticalPositionListResponseSchema>;

// ── Critical-role coverage (sys_critical_role_coverage_status — catalog) ─────

export const CriticalCoverageSchema = z.object({
  criticalRoleCoverageStatusId: z.uuid(),
  tenantId: z.uuid(),
  positionId: z.uuid(),
  readyNowCount: z.number().int(),
  ready6moCount: z.number().int(),
  ready1yCount: z.number().int(),
  overallScore: z.number().nullable(),
  payload: z.record(z.string(), z.unknown()),
  computedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});
export type CriticalCoverage = z.infer<typeof CriticalCoverageSchema>;

export const CriticalCoverageListQuerySchema = z.object({
  ...paginationFields(200, 50),
});
export type CriticalCoverageListQuery = z.infer<typeof CriticalCoverageListQuerySchema>;

export const CriticalCoverageListResponseSchema = z.object({
  items: z.array(CriticalCoverageSchema),
  total: z.number().int().min(0),
});
export type CriticalCoverageListResponse = z.infer<typeof CriticalCoverageListResponseSchema>;
