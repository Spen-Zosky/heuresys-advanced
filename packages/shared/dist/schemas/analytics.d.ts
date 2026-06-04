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
export declare const CompensationBandingByOuRowSchema: z.ZodObject<{
    ou: z.ZodString;
    count: z.ZodNumber;
    min: z.ZodNumber;
    q1: z.ZodNumber;
    median: z.ZodNumber;
    q3: z.ZodNumber;
    max: z.ZodNumber;
}, z.core.$strip>;
export type CompensationBandingByOuRow = z.infer<typeof CompensationBandingByOuRowSchema>;
export declare const CompensationScatterPointSchema: z.ZodObject<{
    ou: z.ZodString;
    positionTitle: z.ZodString;
    bandCode: z.ZodString;
    midEur: z.ZodNumber;
    spreadEur: z.ZodNumber;
}, z.core.$strip>;
export type CompensationScatterPoint = z.infer<typeof CompensationScatterPointSchema>;
export declare const CompensationAnalyticsResponseSchema: z.ZodObject<{
    scope: z.ZodObject<{
        kind: z.ZodEnum<{
            PLATFORM: "PLATFORM";
            TENANT: "TENANT";
            TEAM: "TEAM";
        }>;
        tenantId: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>;
    totalProfiles: z.ZodNumber;
    ouCount: z.ZodNumber;
    overallMinMidEur: z.ZodNullable<z.ZodNumber>;
    overallMaxMidEur: z.ZodNullable<z.ZodNumber>;
    overallMedianMidEur: z.ZodNullable<z.ZodNumber>;
    bandingByOu: z.ZodArray<z.ZodObject<{
        ou: z.ZodString;
        count: z.ZodNumber;
        min: z.ZodNumber;
        q1: z.ZodNumber;
        median: z.ZodNumber;
        q3: z.ZodNumber;
        max: z.ZodNumber;
    }, z.core.$strip>>;
    scatter: z.ZodArray<z.ZodObject<{
        ou: z.ZodString;
        positionTitle: z.ZodString;
        bandCode: z.ZodString;
        midEur: z.ZodNumber;
        spreadEur: z.ZodNumber;
    }, z.core.$strip>>;
    generatedAt: z.ZodString;
}, z.core.$strip>;
export type CompensationAnalyticsResponse = z.infer<typeof CompensationAnalyticsResponseSchema>;
export declare const SkillsCoverageProficiencySchema: z.ZodEnum<{
    NOVICE: "NOVICE";
    BASIC: "BASIC";
    COMPETENT: "COMPETENT";
    PROFICIENT: "PROFICIENT";
    EXPERT: "EXPERT";
    MASTER: "MASTER";
}>;
export type SkillsCoverageProficiency = z.infer<typeof SkillsCoverageProficiencySchema>;
export declare const SkillsCoverageCellSchema: z.ZodObject<{
    orgUnit: z.ZodString;
    proficiency: z.ZodEnum<{
        NOVICE: "NOVICE";
        BASIC: "BASIC";
        COMPETENT: "COMPETENT";
        PROFICIENT: "PROFICIENT";
        EXPERT: "EXPERT";
        MASTER: "MASTER";
    }>;
    evidenceCount: z.ZodNumber;
    distinctUsers: z.ZodNumber;
}, z.core.$strip>;
export type SkillsCoverageCell = z.infer<typeof SkillsCoverageCellSchema>;
export declare const SkillsCoverageByProficiencyRowSchema: z.ZodObject<{
    proficiency: z.ZodEnum<{
        NOVICE: "NOVICE";
        BASIC: "BASIC";
        COMPETENT: "COMPETENT";
        PROFICIENT: "PROFICIENT";
        EXPERT: "EXPERT";
        MASTER: "MASTER";
    }>;
    evidenceCount: z.ZodNumber;
    distinctUsers: z.ZodNumber;
}, z.core.$strip>;
export type SkillsCoverageByProficiencyRow = z.infer<typeof SkillsCoverageByProficiencyRowSchema>;
export declare const SkillsCoverageAnalyticsResponseSchema: z.ZodObject<{
    scope: z.ZodObject<{
        kind: z.ZodEnum<{
            PLATFORM: "PLATFORM";
            TENANT: "TENANT";
            TEAM: "TEAM";
        }>;
        tenantId: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>;
    orgUnits: z.ZodArray<z.ZodString>;
    proficiencyLevels: z.ZodArray<z.ZodEnum<{
        NOVICE: "NOVICE";
        BASIC: "BASIC";
        COMPETENT: "COMPETENT";
        PROFICIENT: "PROFICIENT";
        EXPERT: "EXPERT";
        MASTER: "MASTER";
    }>>;
    cells: z.ZodArray<z.ZodObject<{
        orgUnit: z.ZodString;
        proficiency: z.ZodEnum<{
            NOVICE: "NOVICE";
            BASIC: "BASIC";
            COMPETENT: "COMPETENT";
            PROFICIENT: "PROFICIENT";
            EXPERT: "EXPERT";
            MASTER: "MASTER";
        }>;
        evidenceCount: z.ZodNumber;
        distinctUsers: z.ZodNumber;
    }, z.core.$strip>>;
    byProficiency: z.ZodArray<z.ZodObject<{
        proficiency: z.ZodEnum<{
            NOVICE: "NOVICE";
            BASIC: "BASIC";
            COMPETENT: "COMPETENT";
            PROFICIENT: "PROFICIENT";
            EXPERT: "EXPERT";
            MASTER: "MASTER";
        }>;
        evidenceCount: z.ZodNumber;
        distinctUsers: z.ZodNumber;
    }, z.core.$strip>>;
    totalEvidence: z.ZodNumber;
    distinctUsers: z.ZodNumber;
    distinctOrgUnits: z.ZodNumber;
    generatedAt: z.ZodString;
}, z.core.$strip>;
export type SkillsCoverageAnalyticsResponse = z.infer<typeof SkillsCoverageAnalyticsResponseSchema>;
//# sourceMappingURL=analytics.d.ts.map