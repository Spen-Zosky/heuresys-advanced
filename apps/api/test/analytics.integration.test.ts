/**
 * apps/api/test/analytics.integration.test.ts
 * Integration tests for the BI analytics Phase 1 endpoints (role-gated):
 *   GET /v1/analytics/workforce — headcount distribution
 *   GET /v1/analytics/kpi       — KPI achievement rollup
 *
 * Hits the live OCI VM DB through the tunnel (no mocks). The aggregate numbers
 * (headcount 161, kpi targets 248) are pinned against the live seed (S958).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";

interface S {
  cookies: Map<string, string>;
}
function ch(c: Map<string, string>) {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { email, password: PWD },
  });
  if (r.statusCode !== 200) throw new Error(`login ${email}: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}

let suite: TestApp;
let platformS: S;
let tenantS: S;
let employeeS: S;

describe("GET /v1/analytics/workforce + /v1/analytics/kpi integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    employeeS = await login(suite, "tommaso.fiore@rtl-bank.org");
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("workforce: unauthenticated → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/analytics/workforce" });
    expect(r.statusCode).toBe(401);
  });

  it("workforce: USER (employee) lacks analytics:view → 403", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/workforce",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("workforce: PLATFORM_ADMIN sees full headcount (161)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/workforce",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      scope: { kind: string; tenantId: string | null };
      totalHeadcount: number;
      byOrgUnit: Array<{ dimension: string; headcount: number }>;
      byJobRole: Array<{ dimension: string; headcount: number }>;
      generatedAt: string;
    };
    expect(body.scope.kind).toBe("PLATFORM");
    expect(body.scope.tenantId).toBeNull();
    expect(body.totalHeadcount).toBe(161);
    expect(body.byOrgUnit.length).toBeGreaterThan(0);
    expect(body.byJobRole.length).toBeGreaterThan(0);
    // The OU rollup must sum to the total (one primary active assignment per user).
    const ouSum = body.byOrgUnit.reduce((acc, r2) => acc + r2.headcount, 0);
    expect(ouSum).toBe(161);
    expect(new Date(body.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it("workforce: TENANT_ADMIN sees TENANT scope filtered to own tenant", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/workforce",
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      scope: { kind: string; tenantId: string | null };
      totalHeadcount: number;
    };
    expect(body.scope.kind).toBe("TENANT");
    expect(body.scope.tenantId).not.toBeNull();
    // Own-tenant headcount is a strict subset of the platform total.
    expect(body.totalHeadcount).toBeGreaterThan(0);
    expect(body.totalHeadcount).toBeLessThanOrEqual(161);
  });

  it("kpi: PLATFORM_ADMIN sees the kpi rollup (248 targets)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/kpi",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      scope: { kind: string; tenantId: string | null };
      totalTargets: number;
      distinctKpis: number;
      byKpi: Array<{
        kpiCode: string;
        kpiName: string;
        targetsCount: number;
        avgAchievementPct: number | null;
      }>;
    };
    expect(body.scope.kind).toBe("PLATFORM");
    expect(body.totalTargets).toBe(248);
    expect(body.distinctKpis).toBeGreaterThan(0);
    expect(body.byKpi.length).toBeGreaterThan(0);
    // targetsCount across distinct KPIs sums to the total.
    const cntSum = body.byKpi.reduce((acc, k) => acc + k.targetsCount, 0);
    expect(cntSum).toBe(248);
  });

  it("kpi: USER (employee) lacks analytics:view → 403", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/kpi",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(403);
  });

  // --- Attendance (P2) — deterministic anchors pinned against the live seed
  // (S961/S958): 3180 attendance rows, single tenant (RTL Bank). Overtime is
  // sourced from attendance_hours_overtime (sys_overtime excluded by design).

  interface AttendanceBody {
    scope: { kind: string; tenantId: string | null };
    totalRegularHours: number;
    totalOvertimeHours: number;
    totalHours: number;
    monthly: Array<{ month: string; regularHours: number; overtimeHours: number; totalHours: number }>;
    byOrgUnit: Array<{ dimension: string; regularHours: number; overtimeHours: number; totalHours: number }>;
    generatedAt: string;
  }

  it("attendance: unauthenticated → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/analytics/attendance" });
    expect(r.statusCode).toBe(401);
  });

  it("attendance: USER (employee) lacks analytics:view → 403", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/attendance",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("attendance: PLATFORM_ADMIN sees full worked-hours rollup (deterministic seed anchors)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/attendance",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as AttendanceBody;
    expect(body.scope.kind).toBe("PLATFORM");
    expect(body.scope.tenantId).toBeNull();
    // Grand totals (round to 2 dp, summed over the static 3180-row seed).
    expect(body.totalRegularHours).toBeCloseTo(28347.3, 1);
    expect(body.totalOvertimeHours).toBeCloseTo(3011.6, 1);
    expect(body.totalHours).toBeCloseTo(31358.9, 1);
    // 15 monthly buckets; the monthly totals reconcile to the grand total.
    expect(body.monthly.length).toBe(15);
    const monthlySum = body.monthly.reduce((acc, m) => acc + m.totalHours, 0);
    expect(monthlySum).toBeCloseTo(body.totalHours, 0);
    // Months come back chronological (YYYY-MM string order).
    expect(body.monthly[0]?.month).toBe("2024-10");
    expect(body.monthly[body.monthly.length - 1]?.month).toBe("2025-12");
    // 22 OUs, every attendance row resolves to a real OU (no '(unassigned)').
    expect(body.byOrgUnit.length).toBe(22);
    expect(body.byOrgUnit.some((o) => o.dimension === "(unassigned)")).toBe(false);
    // Top OU by total hours (byOrgUnit is total-desc ordered).
    expect(body.byOrgUnit[0]?.dimension).toBe("Divisione Risk & Compliance");
    expect(body.byOrgUnit[0]?.totalHours).toBeCloseTo(7120, 1);
    expect(new Date(body.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it("attendance: TENANT_ADMIN sees TENANT scope (RTL is the only attendance tenant → equals platform totals)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/attendance",
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as AttendanceBody;
    expect(body.scope.kind).toBe("TENANT");
    expect(body.scope.tenantId).not.toBeNull();
    // All 3180 attendance rows belong to RTL Bank, so the RTL tenant scope
    // returns the same totals as the platform aggregate.
    expect(body.totalHours).toBeCloseTo(31358.9, 1);
    expect(body.byOrgUnit.length).toBe(22);
  });

  // --- Compensation equity (P2) — deterministic anchors: 155 banded profiles
  // across 21 OUs, mid €28k–80k, all in tenant RTL Bank (the other tenant's
  // profiles are unbanded → dropped by the inner JOIN to compensation_bands).

  interface CompensationBody {
    scope: { kind: string; tenantId: string | null };
    totalProfiles: number;
    ouCount: number;
    overallMinMidEur: number | null;
    overallMaxMidEur: number | null;
    overallMedianMidEur: number | null;
    bandingByOu: Array<{ ou: string; count: number; min: number; q1: number; median: number; q3: number; max: number }>;
    scatter: Array<{ ou: string; positionTitle: string; bandCode: string; midEur: number; spreadEur: number }>;
    generatedAt: string;
  }

  it("compensation: USER (employee) lacks analytics:view → 403", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/compensation",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("compensation: PLATFORM_ADMIN sees banded equity rollup (deterministic seed anchors)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/compensation",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as CompensationBody;
    expect(body.scope.kind).toBe("PLATFORM");
    expect(body.scope.tenantId).toBeNull();
    expect(body.totalProfiles).toBe(155);
    expect(body.ouCount).toBe(21);
    expect(body.bandingByOu.length).toBe(21);
    // One scatter point per banded profile.
    expect(body.scatter.length).toBe(155);
    expect(body.scatter.length).toBe(body.totalProfiles);
    // Overall mid-€ range across all banded positions.
    expect(body.overallMinMidEur).toBe(28000);
    expect(body.overallMaxMidEur).toBe(80000);
    // Largest OU cell (Risk & Compliance, 38 banded positions).
    const rc = body.bandingByOu.find((b) => b.ou === "Divisione Risk & Compliance");
    expect(rc?.count).toBe(38);
    expect(rc?.min).toBe(34000);
    expect(rc?.max).toBe(80000);
    expect(rc?.median).toBeCloseTo(45000, 0);
    expect(new Date(body.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it("compensation: TENANT_ADMIN sees TENANT scope (RTL holds all banded profiles → equals platform)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/compensation",
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as CompensationBody;
    expect(body.scope.kind).toBe("TENANT");
    expect(body.scope.tenantId).not.toBeNull();
    expect(body.totalProfiles).toBe(155);
    expect(body.bandingByOu.length).toBe(21);
  });

  // --- Skills coverage (P2) — deterministic anchors: 902 evidences, 156 users,
  // 21 OUs, 47 OU×proficiency cells, 5 proficiency levels (MASTER absent). All
  // single-tenant (RTL). This is COVERAGE, not a held-vs-required gap.

  interface SkillsBody {
    scope: { kind: string; tenantId: string | null };
    orgUnits: string[];
    proficiencyLevels: string[];
    cells: Array<{ orgUnit: string; proficiency: string; evidenceCount: number; distinctUsers: number }>;
    byProficiency: Array<{ proficiency: string; evidenceCount: number; distinctUsers: number }>;
    totalEvidence: number;
    distinctUsers: number;
    distinctOrgUnits: number;
    generatedAt: string;
  }

  it("skills: USER (employee) lacks analytics:view → 403", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/skills",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("skills: PLATFORM_ADMIN sees coverage heatmap rollup (deterministic seed anchors)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/skills",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as SkillsBody;
    expect(body.scope.kind).toBe("PLATFORM");
    expect(body.scope.tenantId).toBeNull();
    expect(body.totalEvidence).toBe(902);
    expect(body.distinctUsers).toBe(156);
    expect(body.distinctOrgUnits).toBe(21);
    expect(body.orgUnits.length).toBe(21);
    // 5 levels present, rank-ordered; MASTER absent in the seed.
    expect(body.proficiencyLevels).toEqual(["NOVICE", "BASIC", "COMPETENT", "PROFICIENT", "EXPERT"]);
    // 47 populated OU×proficiency cells, none falling through to '(unassigned)'.
    expect(body.cells.length).toBe(47);
    expect(body.cells.some((c) => c.orgUnit === "(unassigned)")).toBe(false);
    // Per-proficiency column rollup.
    const byp = (p: string) => body.byProficiency.find((b) => b.proficiency === p);
    expect(byp("EXPERT")).toMatchObject({ evidenceCount: 691, distinctUsers: 147 });
    expect(byp("PROFICIENT")).toMatchObject({ evidenceCount: 166, distinctUsers: 48 });
    expect(byp("COMPETENT")).toMatchObject({ evidenceCount: 35, distinctUsers: 10 });
    expect(byp("BASIC")).toMatchObject({ evidenceCount: 9, distinctUsers: 3 });
    expect(byp("NOVICE")).toMatchObject({ evidenceCount: 1, distinctUsers: 1 });
    // Column totals sum to the grand total of evidences.
    const colSum = body.byProficiency.reduce((acc, b) => acc + b.evidenceCount, 0);
    expect(colSum).toBe(902);
    // distinctUsers is NON-additive: per-bucket user counts exceed the grand total
    // (a user has evidence at multiple proficiency levels).
    const bucketUserSum = body.byProficiency.reduce((acc, b) => acc + b.distinctUsers, 0);
    expect(bucketUserSum).toBeGreaterThan(body.distinctUsers);
    // Largest heatmap cell.
    const maxCell = body.cells.find(
      (c) => c.orgUnit === "Divisione Risk & Compliance" && c.proficiency === "EXPERT",
    );
    expect(maxCell).toMatchObject({ evidenceCount: 170, distinctUsers: 35 });
    expect(new Date(body.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it("skills: TENANT_ADMIN sees TENANT scope (all evidence is single-tenant RTL → equals platform)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/skills",
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as SkillsBody;
    expect(body.scope.kind).toBe("TENANT");
    expect(body.scope.tenantId).not.toBeNull();
    expect(body.totalEvidence).toBe(902);
    expect(body.distinctOrgUnits).toBe(21);
  });
});
