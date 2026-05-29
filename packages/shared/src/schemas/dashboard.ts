/**
 * packages/shared/src/schemas/dashboard.ts
 * Schema for GET /v1/dashboard/widgets — role-gated aggregator for the admin
 * landing page. NOT a separate persisted view — composed at request time
 * from existing tables.
 */

import { z } from "zod";

export const DashboardScopeKindSchema = z.enum([
  "PLATFORM",
  "TENANT",
  "TEAM",
]);
export type DashboardScopeKind = z.infer<typeof DashboardScopeKindSchema>;

export const DashboardCountersSchema = z.object({
  tenants: z.number().int().min(0).nullable(),
  users: z.number().int().min(0),
  positions: z.number().int().min(0),
  organizationUnits: z.number().int().min(0),
  learningPaths: z.number().int().min(0),
  learningGaps: z.number().int().min(0),
  blueprints: z.number().int().min(0).nullable(),
  pendingRecommendations: z.number().int().min(0).nullable(),
});
export type DashboardCounters = z.infer<typeof DashboardCountersSchema>;

export const DashboardLearningDeadlineSchema = z.object({
  learningGapId: z.string().uuid(),
  userId: z.string().uuid(),
  userDisplayName: z.string(),
  positionId: z.string().uuid().nullable(),
  positionTitle: z.string().nullable(),
  skillId: z.string().uuid().nullable(),
  skillName: z.string().nullable(),
  severity: z.string(),
  detectedAt: z.string().datetime(),
});
export type DashboardLearningDeadline = z.infer<typeof DashboardLearningDeadlineSchema>;

export const DashboardRecentActivitySchema = z.object({
  kind: z.enum(["USER_CREATED", "POSITION_CREATED", "ASSIGNMENT_CHANGED"]),
  occurredAt: z.string().datetime(),
  summary: z.string(),
  resourceId: z.string().uuid(),
});
export type DashboardRecentActivity = z.infer<typeof DashboardRecentActivitySchema>;

/**
 * Per-counter trend — week-over-week delta + a weekly cumulative series for
 * StatsCard sparklines. Derived from real `created_at` / `detected_at`
 * timestamps (no fabricated data); a flat or all-zero series faithfully
 * reflects batch-seeded or empty entities. `series` is empty for TEAM scope
 * (MANAGER), where the team-disaggregated history is not yet computed.
 */
export const DashboardTrendKeySchema = z.enum([
  "users",
  "positions",
  "organizationUnits",
  "learningPaths",
  "learningGaps",
]);
export type DashboardTrendKey = z.infer<typeof DashboardTrendKeySchema>;

export const DashboardTrendSchema = z.object({
  key: DashboardTrendKeySchema,
  current: z.number().int().min(0),
  previousWeek: z.number().int().min(0),
  /** Signed week-over-week percent; 0 when not computable (no prior-week data). */
  deltaPct: z.number(),
  direction: z.enum(["up", "down", "flat"]),
  /** Weekly cumulative counts, oldest→newest. Empty for TEAM scope. */
  series: z.array(z.number().int().min(0)),
  weeks: z.number().int().min(0),
});
export type DashboardTrend = z.infer<typeof DashboardTrendSchema>;

export const DashboardWidgetsResponseSchema = z.object({
  role: z.string(),
  scope: z.object({
    kind: DashboardScopeKindSchema,
    tenantId: z.string().uuid().nullable(),
    teamPositionIds: z.array(z.string().uuid()),
  }),
  counters: DashboardCountersSchema,
  trends: z.array(DashboardTrendSchema),
  upcomingLearningDeadlines: z.array(DashboardLearningDeadlineSchema),
  recentActivity: z.array(DashboardRecentActivitySchema),
  generatedAt: z.string().datetime(),
});
export type DashboardWidgetsResponse = z.infer<typeof DashboardWidgetsResponseSchema>;
