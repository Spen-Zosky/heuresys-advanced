/**
 * packages/shared/src/schemas/analytics.ts
 * BI analytics — Phase 1: workforce headcount distribution + KPI achievement rollup.
 * Descriptive analytics only (predictive is a later capability).
 */
import { z } from "zod";
export declare const AnalyticsScopeKindSchema: z.ZodEnum<{
    PLATFORM: "PLATFORM";
    TENANT: "TENANT";
    TEAM: "TEAM";
}>;
export type AnalyticsScopeKind = z.infer<typeof AnalyticsScopeKindSchema>;
export declare const WorkforceByDimensionRowSchema: z.ZodObject<{
    dimension: z.ZodString;
    headcount: z.ZodNumber;
}, z.core.$strip>;
export type WorkforceByDimensionRow = z.infer<typeof WorkforceByDimensionRowSchema>;
export declare const WorkforceAnalyticsResponseSchema: z.ZodObject<{
    scope: z.ZodObject<{
        kind: z.ZodEnum<{
            PLATFORM: "PLATFORM";
            TENANT: "TENANT";
            TEAM: "TEAM";
        }>;
        tenantId: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>;
    totalHeadcount: z.ZodNumber;
    byOrgUnit: z.ZodArray<z.ZodObject<{
        dimension: z.ZodString;
        headcount: z.ZodNumber;
    }, z.core.$strip>>;
    byJobRole: z.ZodArray<z.ZodObject<{
        dimension: z.ZodString;
        headcount: z.ZodNumber;
    }, z.core.$strip>>;
    generatedAt: z.ZodString;
}, z.core.$strip>;
export type WorkforceAnalyticsResponse = z.infer<typeof WorkforceAnalyticsResponseSchema>;
export declare const KpiAchievementRowSchema: z.ZodObject<{
    kpiCode: z.ZodString;
    kpiName: z.ZodString;
    targetsCount: z.ZodNumber;
    avgAchievementPct: z.ZodNullable<z.ZodNumber>;
}, z.core.$strip>;
export type KpiAchievementRow = z.infer<typeof KpiAchievementRowSchema>;
export declare const KpiAnalyticsResponseSchema: z.ZodObject<{
    scope: z.ZodObject<{
        kind: z.ZodEnum<{
            PLATFORM: "PLATFORM";
            TENANT: "TENANT";
            TEAM: "TEAM";
        }>;
        tenantId: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>;
    totalTargets: z.ZodNumber;
    distinctKpis: z.ZodNumber;
    byKpi: z.ZodArray<z.ZodObject<{
        kpiCode: z.ZodString;
        kpiName: z.ZodString;
        targetsCount: z.ZodNumber;
        avgAchievementPct: z.ZodNullable<z.ZodNumber>;
    }, z.core.$strip>>;
    generatedAt: z.ZodString;
}, z.core.$strip>;
export type KpiAnalyticsResponse = z.infer<typeof KpiAnalyticsResponseSchema>;
export declare const AttendanceMonthlyRowSchema: z.ZodObject<{
    month: z.ZodString;
    regularHours: z.ZodNumber;
    overtimeHours: z.ZodNumber;
    totalHours: z.ZodNumber;
}, z.core.$strip>;
export type AttendanceMonthlyRow = z.infer<typeof AttendanceMonthlyRowSchema>;
export declare const AttendanceByOrgUnitRowSchema: z.ZodObject<{
    dimension: z.ZodString;
    regularHours: z.ZodNumber;
    overtimeHours: z.ZodNumber;
    totalHours: z.ZodNumber;
}, z.core.$strip>;
export type AttendanceByOrgUnitRow = z.infer<typeof AttendanceByOrgUnitRowSchema>;
export declare const AttendanceAnalyticsResponseSchema: z.ZodObject<{
    scope: z.ZodObject<{
        kind: z.ZodEnum<{
            PLATFORM: "PLATFORM";
            TENANT: "TENANT";
            TEAM: "TEAM";
        }>;
        tenantId: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>;
    totalRegularHours: z.ZodNumber;
    totalOvertimeHours: z.ZodNumber;
    totalHours: z.ZodNumber;
    monthly: z.ZodArray<z.ZodObject<{
        month: z.ZodString;
        regularHours: z.ZodNumber;
        overtimeHours: z.ZodNumber;
        totalHours: z.ZodNumber;
    }, z.core.$strip>>;
    byOrgUnit: z.ZodArray<z.ZodObject<{
        dimension: z.ZodString;
        regularHours: z.ZodNumber;
        overtimeHours: z.ZodNumber;
        totalHours: z.ZodNumber;
    }, z.core.$strip>>;
    generatedAt: z.ZodString;
}, z.core.$strip>;
export type AttendanceAnalyticsResponse = z.infer<typeof AttendanceAnalyticsResponseSchema>;
//# sourceMappingURL=analytics.d.ts.map