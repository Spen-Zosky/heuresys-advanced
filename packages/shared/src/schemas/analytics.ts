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

// --- Attendance / overtime (P2) ---
// Worked-hours analytics. Overtime is sourced from sys_attendance.attendance_hours_overtime
// (the recorded worked overtime that rolls into attendance_hours_total) — NOT from
// sys_overtime, which is a separate request/approval workflow table (PENDING rows,
// largely disjoint dates/users) and would double-count if merged. Hours are fractional
// (numeric), so fields are z.number() (not .int()).
export const AttendanceMonthlyRowSchema = z.object({
  month: z.string(), // 'YYYY-MM' (date_trunc('month', attendance_date))
  regularHours: z.number(),
  overtimeHours: z.number(),
  totalHours: z.number(),
});
export type AttendanceMonthlyRow = z.infer<typeof AttendanceMonthlyRowSchema>;

export const AttendanceByOrgUnitRowSchema = z.object({
  dimension: z.string(), // organization_unit_name, COALESCE '(unassigned)'
  regularHours: z.number(),
  overtimeHours: z.number(),
  totalHours: z.number(),
});
export type AttendanceByOrgUnitRow = z.infer<typeof AttendanceByOrgUnitRowSchema>;

export const AttendanceAnalyticsResponseSchema = z.object({
  scope: z.object({ kind: AnalyticsScopeKindSchema, tenantId: z.string().uuid().nullable() }),
  totalRegularHours: z.number(),
  totalOvertimeHours: z.number(),
  totalHours: z.number(),
  monthly: z.array(AttendanceMonthlyRowSchema), // chronological
  byOrgUnit: z.array(AttendanceByOrgUnitRowSchema), // total-hours desc
  generatedAt: z.string(),
});
export type AttendanceAnalyticsResponse = z.infer<typeof AttendanceAnalyticsResponseSchema>;
