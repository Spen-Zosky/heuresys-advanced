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

export const DashboardWidgetsResponseSchema = z.object({
  role: z.string(),
  scope: z.object({
    kind: DashboardScopeKindSchema,
    tenantId: z.string().uuid().nullable(),
    teamPositionIds: z.array(z.string().uuid()),
  }),
  counters: DashboardCountersSchema,
  upcomingLearningDeadlines: z.array(DashboardLearningDeadlineSchema),
  recentActivity: z.array(DashboardRecentActivitySchema),
  generatedAt: z.string().datetime(),
});
export type DashboardWidgetsResponse = z.infer<typeof DashboardWidgetsResponseSchema>;
