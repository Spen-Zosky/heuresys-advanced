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
//# sourceMappingURL=analytics.d.ts.map