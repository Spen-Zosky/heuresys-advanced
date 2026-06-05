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

  // --- Org-network metrics (P3) — structural metrics over the position reports-to
  // graph. The full org chart (~158 positions, is_active not filtered) is the graph.

  interface OrgNetworkBody {
    scope: { kind: string; tenantId: string | null };
    totalPositions: number;
    rootPositions: number;
    managersCount: number;
    avgSpanOfControl: number | null;
    maxDepth: number;
    byDepth: Array<{ depth: number; positionCount: number }>;
    topSpan: Array<{ positionTitle: string; orgUnit: string; directReports: number }>;
    topReach: Array<{ positionTitle: string; orgUnit: string; reach: number }>;
    generatedAt: string;
  }

  it("org-network: unauthenticated → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/analytics/org-network" });
    expect(r.statusCode).toBe(401);
  });

  it("org-network: USER (employee) lacks analytics:view → 403", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/org-network",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("org-network: PLATFORM_ADMIN sees the full org-graph metrics", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/org-network",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as OrgNetworkBody;
    expect(body.scope.kind).toBe("PLATFORM");
    expect(body.scope.tenantId).toBeNull();

    // Full org graph present.
    expect(body.totalPositions).toBeGreaterThan(0);
    expect(body.rootPositions).toBeGreaterThan(0);
    expect(body.rootPositions).toBeLessThanOrEqual(body.totalPositions);
    expect(body.managersCount).toBeGreaterThan(0);

    // avgSpanOfControl is present (managers exist) and self-consistent: ≥ 1 report each.
    expect(body.avgSpanOfControl).not.toBeNull();
    expect(body.avgSpanOfControl!).toBeGreaterThanOrEqual(1);

    // Depth distribution: depth 0 holds the roots, buckets are depth-ascending, and
    // every position lands in exactly one depth bucket (the graph is a forest).
    expect(body.byDepth.length).toBeGreaterThan(0);
    expect(body.maxDepth).toBeGreaterThanOrEqual(0);
    const depth0 = body.byDepth.find((d) => d.depth === 0);
    expect(depth0?.positionCount).toBe(body.rootPositions);
    for (let i = 1; i < body.byDepth.length; i++) {
      expect(body.byDepth[i]!.depth).toBeGreaterThan(body.byDepth[i - 1]!.depth);
    }
    const depthSum = body.byDepth.reduce((acc, d) => acc + d.positionCount, 0);
    expect(depthSum).toBe(body.totalPositions);
    expect(Math.max(...body.byDepth.map((d) => d.depth))).toBe(body.maxDepth);

    // topSpan: present, capped at 15, sorted directReports-desc, every row has ≥1 report.
    expect(body.topSpan.length).toBeGreaterThan(0);
    expect(body.topSpan.length).toBeLessThanOrEqual(15);
    for (const row of body.topSpan) {
      expect(typeof row.positionTitle).toBe("string");
      expect(typeof row.orgUnit).toBe("string");
    }
    expect(body.topSpan[0]!.directReports).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < body.topSpan.length; i++) {
      expect(body.topSpan[i]!.directReports).toBeLessThanOrEqual(body.topSpan[i - 1]!.directReports);
    }

    // topReach: present, capped at 15, sorted reach-desc, every row has reach > 0.
    expect(body.topReach.length).toBeGreaterThan(0);
    expect(body.topReach.length).toBeLessThanOrEqual(15);
    expect(body.topReach.every((row) => row.reach > 0)).toBe(true);
    for (let i = 1; i < body.topReach.length; i++) {
      expect(body.topReach[i]!.reach).toBeLessThanOrEqual(body.topReach[i - 1]!.reach);
    }

    expect(new Date(body.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it("org-network: TENANT_ADMIN sees TENANT scope (positions filtered to own tenant)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/org-network",
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as OrgNetworkBody;
    expect(body.scope.kind).toBe("TENANT");
    expect(body.scope.tenantId).not.toBeNull();
    expect(body.totalPositions).toBeGreaterThan(0);
  });

  // --- Overtime requests (P2 ext) — deterministic anchors pinned against the live
  // seed: 221 overtime REQUESTS (distinct from attendance worked hours), 676.00 h,
  // €34,267.09, all PENDING, all single-tenant RTL Bank. 4 types present (of 7), 4
  // months, 22 OUs (every request resolves to a real OU).

  interface OvertimeBody {
    scope: { kind: string; tenantId: string | null };
    totalRequests: number;
    totalHours: number;
    totalCompensationEur: number | null;
    byStatus: Array<{ status: string; count: number; hours: number; compensationEur: number | null }>;
    byType: Array<{ type: string; count: number; hours: number }>;
    monthly: Array<{ month: string; count: number; hours: number }>;
    byOrgUnit: Array<{ dimension: string; count: number; hours: number }>;
    generatedAt: string;
  }

  it("overtime: unauthenticated → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/analytics/overtime" });
    expect(r.statusCode).toBe(401);
  });

  it("overtime: USER (employee) lacks analytics:view → 403", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/overtime",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("overtime: PLATFORM_ADMIN sees the request rollup (deterministic seed anchors)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/overtime",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as OvertimeBody;
    expect(body.scope.kind).toBe("PLATFORM");
    expect(body.scope.tenantId).toBeNull();
    // Grand totals.
    expect(body.totalRequests).toBe(221);
    expect(body.totalHours).toBeCloseTo(676.0, 1);
    expect(body.totalCompensationEur).toBeCloseTo(34267.09, 1);
    // byStatus: every request is PENDING in the seed → single bucket reconciling to the total.
    expect(body.byStatus.length).toBe(1);
    expect(body.byStatus[0]?.status).toBe("PENDING");
    expect(body.byStatus[0]?.count).toBe(221);
    expect(body.byStatus[0]?.hours).toBeCloseTo(676.0, 1);
    const statusCountSum = body.byStatus.reduce((acc, s) => acc + s.count, 0);
    expect(statusCountSum).toBe(221);
    // byType: 4 of the 7 CHECK types present; counts reconcile; count-desc ordered.
    expect(body.byType.length).toBe(4);
    const typeCountSum = body.byType.reduce((acc, t) => acc + t.count, 0);
    expect(typeCountSum).toBe(221);
    expect(body.byType[0]?.type).toBe("NIGHT");
    expect(body.byType[0]?.count).toBe(62);
    for (let i = 1; i < body.byType.length; i++) {
      expect(body.byType[i]!.count).toBeLessThanOrEqual(body.byType[i - 1]!.count);
    }
    // monthly: 4 chronological buckets reconciling to the grand total.
    expect(body.monthly.length).toBe(4);
    expect(body.monthly[0]?.month).toBe("2025-09");
    expect(body.monthly[body.monthly.length - 1]?.month).toBe("2025-12");
    const monthlyHourSum = body.monthly.reduce((acc, m) => acc + m.hours, 0);
    expect(monthlyHourSum).toBeCloseTo(676.0, 0);
    const monthlyCountSum = body.monthly.reduce((acc, m) => acc + m.count, 0);
    expect(monthlyCountSum).toBe(221);
    // byOrgUnit: 22 OUs, every request resolves (no '(unassigned)'), hours-desc ordered.
    expect(body.byOrgUnit.length).toBe(22);
    expect(body.byOrgUnit.some((o) => o.dimension === "(unassigned)")).toBe(false);
    expect(body.byOrgUnit[0]?.dimension).toBe("Divisione Risk & Compliance");
    expect(body.byOrgUnit[0]?.hours).toBeCloseTo(162.8, 1);
    const ouCountSum = body.byOrgUnit.reduce((acc, o) => acc + o.count, 0);
    expect(ouCountSum).toBe(221);
    expect(new Date(body.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it("overtime: TENANT_ADMIN sees TENANT scope (RTL is the only overtime tenant → equals platform)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/overtime",
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as OvertimeBody;
    expect(body.scope.kind).toBe("TENANT");
    expect(body.scope.tenantId).not.toBeNull();
    // All 221 overtime requests belong to RTL Bank → TENANT equals the platform aggregate.
    expect(body.totalRequests).toBe(221);
    expect(body.byOrgUnit.length).toBe(22);
  });
});
