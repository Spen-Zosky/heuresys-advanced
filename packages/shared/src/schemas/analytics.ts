/**
 * packages/shared/src/schemas/analytics.ts
 * BI analytics — Phase 1: workforce headcount distribution + KPI achievement rollup.
 * Descriptive analytics only (predictive is a later capability).
 */
import { z } from "zod";

export const AnalyticsScopeKindSchema = z.enum(["PLATFORM", "TENANT", "TEAM"]);
export type AnalyticsScopeKind = z.infer<typeof AnalyticsScopeKindSchema>;

// --- Workforce ---
export const WorkforceByDimensionRowSchema = z.object({
  dimension: z.string(), // OU name / position title
  headcount: z.number().int(),
});
export type WorkforceByDimensionRow = z.infer<typeof WorkforceByDimensionRowSchema>;

export const WorkforceAnalyticsResponseSchema = z.object({
  scope: z.object({ kind: AnalyticsScopeKindSchema, tenantId: z.string().uuid().nullable() }),
  totalHeadcount: z.number().int(),
  byOrgUnit: z.array(WorkforceByDimensionRowSchema),
  byJobRole: z.array(WorkforceByDimensionRowSchema),
  generatedAt: z.string(),
});
export type WorkforceAnalyticsResponse = z.infer<typeof WorkforceAnalyticsResponseSchema>;

// --- KPI ---
export const KpiAchievementRowSchema = z.object({
  kpiCode: z.string(),
  kpiName: z.string(),
  targetsCount: z.number().int(),
  avgAchievementPct: z.number().nullable(), // mean(actual/target*100) where actual present
});
export type KpiAchievementRow = z.infer<typeof KpiAchievementRowSchema>;

export const KpiAnalyticsResponseSchema = z.object({
  scope: z.object({ kind: AnalyticsScopeKindSchema, tenantId: z.string().uuid().nullable() }),
  totalTargets: z.number().int(),
  distinctKpis: z.number().int(),
  byKpi: z.array(KpiAchievementRowSchema),
  generatedAt: z.string(),
});
export type KpiAnalyticsResponse = z.infer<typeof KpiAnalyticsResponseSchema>;
