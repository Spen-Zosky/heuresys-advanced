/**
 * apps/api/test/analytics.integration.test.ts
 * Integration tests for the BI analytics endpoints (role-gated):
 *   GET /v1/analytics/workforce · /kpi · /attendance · /compensation · /skills
 *   /skills-by-category · /org-network · /overtime · /skills-group-share
 *
 * Hits the live OCI VM DB through the tunnel (no mocks). DATA-DERIVED doctrine
 * (S1025, D-74): no pinned live counts — every expected scalar is derived from
 * the same source tables the endpoint aggregates, and the rest is asserted as
 * INVARIANTS (rollups reconcile, ordering, scope semantics, no '(unassigned)'
 * fallthrough). TENANT-scope tests compare against the PLATFORM body fetched in
 * the same test, gated on live-derived single-tenancy of the source.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { closePool, pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;

interface S {
  cookies: Map<string, string>;
}
function ch(c: Map<string, string>) {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}

/** Scalar derivation helper: first column aliased n, numeric. */
async function num(sql: string): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(sql);
  return Number(rows[0]?.n ?? 0);
}
/** First-row text derivation helper: first column aliased v. */
async function txt(sql: string): Promise<string> {
  const { rows } = await pool.query<{ v: string }>(sql);
  return rows[0]?.v ?? "";
}

// The user → PRIMARY/ACTIVE assignment → position → OU chain, as the analytics
// repository resolves the org-unit dimension.
const OU_CHAIN = `
  JOIN sys.sys_user_position_assignments a
    ON a.user_position_assignment_user_id = u_id
   AND a.user_position_assignment_kind = 'PRIMARY'
   AND a.user_position_assignment_status = 'ACTIVE'
  JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
  JOIN sys.sys_organization_units ou ON ou.organization_unit_id = p.position_organization_unit_id`;

// Canonical proficiency rank (design contract, not data).
const PROFICIENCY_RANK = ["NOVICE", "BASIC", "COMPETENT", "PROFICIENT", "EXPERT", "MASTER"];

let suite: TestApp;
let platformS: S;
let tenantS: S;
let employeeS: S;

async function getJson<T>(url: string, s: S): Promise<T> {
  const r = await suite.app.inject({ method: "GET", url, headers: { cookie: ch(s.cookies) } });
  expect(r.statusCode).toBe(200);
  return r.json() as T;
}

describe("GET /v1/analytics/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "enzo.spenuso@heuresys.com");
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

  interface WorkforceBody {
    scope: { kind: string; tenantId: string | null };
    totalHeadcount: number;
    byOrgUnit: Array<{ dimension: string; headcount: number }>;
    byJobRole: Array<{ dimension: string; headcount: number }>;
    generatedAt: string;
  }

  it("workforce: PLATFORM_ADMIN sees the full headcount (derived live)", async () => {
    const body = await getJson<WorkforceBody>("/v1/analytics/workforce", platformS);
    expect(body.scope.kind).toBe("PLATFORM");
    expect(body.scope.tenantId).toBeNull();
    const expectedHeadcount = await num(`SELECT count(*)::text AS n FROM sys.sys_users`);
    expect(body.totalHeadcount).toBe(expectedHeadcount);
    expect(body.byOrgUnit.length).toBeGreaterThan(0);
    expect(body.byJobRole.length).toBeGreaterThan(0);
    // The OU rollup must sum to the total: position-less users fall into the
    // COALESCE '(unassigned)' bucket, so total == ouSum still holds.
    const ouSum = body.byOrgUnit.reduce((acc, r2) => acc + r2.headcount, 0);
    expect(ouSum).toBe(body.totalHeadcount);
    expect(new Date(body.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it("workforce: TENANT_ADMIN sees TENANT scope filtered to own tenant", async () => {
    const body = await getJson<WorkforceBody>("/v1/analytics/workforce", tenantS);
    expect(body.scope.kind).toBe("TENANT");
    expect(body.scope.tenantId).not.toBeNull();
    // Own-tenant headcount equals the live per-tenant user count.
    const { rows } = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_users WHERE user_tenant_id = $1::uuid`,
      [body.scope.tenantId],
    );
    expect(body.totalHeadcount).toBe(Number(rows[0]?.n ?? 0));
    expect(body.totalHeadcount).toBeGreaterThan(0);
  });

  interface KpiBody {
    scope: { kind: string; tenantId: string | null };
    totalTargets: number;
    distinctKpis: number;
    byKpi: Array<{ kpiCode: string; kpiName: string; targetsCount: number; avgAchievementPct: number | null }>;
  }

  it("kpi: PLATFORM_ADMIN sees the kpi rollup (derived live)", async () => {
    const body = await getJson<KpiBody>("/v1/analytics/kpi", platformS);
    expect(body.scope.kind).toBe("PLATFORM");
    const expectedTargets = await num(`SELECT count(*)::text AS n FROM sys.sys_kpi_targets`);
    const expectedKpis = await num(`SELECT count(DISTINCT kpi_target_kpi_id)::text AS n FROM sys.sys_kpi_targets`);
    expect(body.totalTargets).toBe(expectedTargets);
    expect(body.distinctKpis).toBe(expectedKpis);
    expect(body.byKpi.length).toBeGreaterThan(0);
    // targetsCount across distinct KPIs sums to the total.
    const cntSum = body.byKpi.reduce((acc, k) => acc + k.targetsCount, 0);
    expect(cntSum).toBe(body.totalTargets);
  });

  it("kpi: USER (employee) lacks analytics:view → 403", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/kpi",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(403);
  });

  // --- Attendance — anchors derived live from sys.sys_attendance.

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

  it("attendance: PLATFORM_ADMIN sees the full worked-hours rollup (derived live)", async () => {
    const body = await getJson<AttendanceBody>("/v1/analytics/attendance", platformS);
    expect(body.scope.kind).toBe("PLATFORM");
    expect(body.scope.tenantId).toBeNull();
    // Grand totals derived from the source table (endpoint rounds buckets to 2dp).
    const reg = await num(`SELECT round(sum(attendance_hours_regular), 2)::text AS n FROM sys.sys_attendance`);
    const ot = await num(`SELECT round(sum(attendance_hours_overtime), 2)::text AS n FROM sys.sys_attendance`);
    const tot = await num(`SELECT round(sum(attendance_hours_total), 2)::text AS n FROM sys.sys_attendance`);
    expect(body.totalRegularHours).toBeCloseTo(reg, 1);
    expect(body.totalOvertimeHours).toBeCloseTo(ot, 1);
    expect(body.totalHours).toBeCloseTo(tot, 1);
    // Monthly buckets: count + first/last month derived; totals reconcile.
    const monthCount = await num(
      `SELECT count(DISTINCT date_trunc('month', attendance_date))::text AS n FROM sys.sys_attendance`,
    );
    expect(body.monthly.length).toBe(monthCount);
    expect(body.monthly[0]?.month).toBe(
      await txt(`SELECT to_char(min(attendance_date), 'YYYY-MM') AS v FROM sys.sys_attendance`),
    );
    expect(body.monthly[body.monthly.length - 1]?.month).toBe(
      await txt(`SELECT to_char(max(attendance_date), 'YYYY-MM') AS v FROM sys.sys_attendance`),
    );
    const monthlySum = body.monthly.reduce((acc, m) => acc + m.totalHours, 0);
    expect(monthlySum).toBeCloseTo(body.totalHours, 0);
    // Every attendance row resolves to a real OU (no '(unassigned)') and the OU
    // dimension count matches the live chain.
    expect(body.byOrgUnit.some((o) => o.dimension === "(unassigned)")).toBe(false);
    const ouCount = await num(
      `SELECT count(DISTINCT ou.organization_unit_id)::text AS n
         FROM (SELECT DISTINCT attendance_subject_user_id AS u_id FROM sys.sys_attendance) att
         ${OU_CHAIN}`,
    );
    expect(body.byOrgUnit.length).toBe(ouCount);
    // byOrgUnit is total-desc ordered.
    for (let i = 1; i < body.byOrgUnit.length; i++) {
      expect(body.byOrgUnit[i]!.totalHours).toBeLessThanOrEqual(body.byOrgUnit[i - 1]!.totalHours);
    }
    const ouSum = body.byOrgUnit.reduce((acc, o) => acc + o.totalHours, 0);
    expect(ouSum).toBeCloseTo(body.totalHours, 0);
    expect(new Date(body.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it("attendance: TENANT_ADMIN sees TENANT scope (equals platform when the source is single-tenant)", async () => {
    const platformBody = await getJson<AttendanceBody>("/v1/analytics/attendance", platformS);
    const body = await getJson<AttendanceBody>("/v1/analytics/attendance", tenantS);
    expect(body.scope.kind).toBe("TENANT");
    expect(body.scope.tenantId).not.toBeNull();
    const tenants = await num(
      `SELECT count(DISTINCT u.user_tenant_id)::text AS n
         FROM sys.sys_attendance at JOIN sys.sys_users u ON u.user_id = at.attendance_subject_user_id`,
    );
    if (tenants === 1) {
      expect(body.totalHours).toBeCloseTo(platformBody.totalHours, 1);
      expect(body.byOrgUnit.length).toBe(platformBody.byOrgUnit.length);
    } else {
      expect(body.totalHours).toBeLessThanOrEqual(platformBody.totalHours);
    }
  });

  // --- Compensation equity — anchors derived live from the banded-profile join.

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

  const BANDED_JOIN = `FROM sys.sys_position_compensation_profiles pcp
    JOIN sys.sys_compensation_bands b ON b.compensation_band_id = pcp.compensation_band_id`;

  it("compensation: USER (employee) lacks analytics:view → 403", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/compensation",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("compensation: PLATFORM_ADMIN sees the banded equity rollup (derived live)", async () => {
    const body = await getJson<CompensationBody>("/v1/analytics/compensation", platformS);
    expect(body.scope.kind).toBe("PLATFORM");
    expect(body.scope.tenantId).toBeNull();
    const expectedProfiles = await num(`SELECT count(*)::text AS n ${BANDED_JOIN}`);
    expect(body.totalProfiles).toBe(expectedProfiles);
    expect(body.ouCount).toBe(body.bandingByOu.length);
    // One scatter point per banded profile.
    expect(body.scatter.length).toBe(body.totalProfiles);
    // Overall mid-€ range across all banded positions, derived live.
    expect(body.overallMinMidEur).toBe(await num(`SELECT min(b.compensation_band_mid_eur)::text AS n ${BANDED_JOIN}`));
    expect(body.overallMaxMidEur).toBe(await num(`SELECT max(b.compensation_band_mid_eur)::text AS n ${BANDED_JOIN}`));
    // Every OU cell is internally consistent (min ≤ q1 ≤ median ≤ q3 ≤ max, count > 0).
    for (const cell of body.bandingByOu) {
      expect(cell.count).toBeGreaterThan(0);
      expect(cell.min).toBeLessThanOrEqual(cell.q1);
      expect(cell.q1).toBeLessThanOrEqual(cell.median);
      expect(cell.median).toBeLessThanOrEqual(cell.q3);
      expect(cell.q3).toBeLessThanOrEqual(cell.max);
    }
    // OU cell counts reconcile to the total.
    const cellSum = body.bandingByOu.reduce((acc, c) => acc + c.count, 0);
    expect(cellSum).toBe(body.totalProfiles);
    expect(new Date(body.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it("compensation: TENANT_ADMIN sees TENANT scope (equals platform when single-tenant)", async () => {
    const platformBody = await getJson<CompensationBody>("/v1/analytics/compensation", platformS);
    const body = await getJson<CompensationBody>("/v1/analytics/compensation", tenantS);
    expect(body.scope.kind).toBe("TENANT");
    expect(body.scope.tenantId).not.toBeNull();
    const tenants = await num(
      `SELECT count(DISTINCT pcp.position_compensation_profile_tenant_id)::text AS n ${BANDED_JOIN}`,
    );
    if (tenants === 1) {
      expect(body.totalProfiles).toBe(platformBody.totalProfiles);
      expect(body.bandingByOu.length).toBe(platformBody.bandingByOu.length);
    } else {
      expect(body.totalProfiles).toBeLessThanOrEqual(platformBody.totalProfiles);
    }
  });

  // --- Skills coverage — anchors derived live from sys_user_skill_evidence.
  // This is COVERAGE, not a held-vs-required gap.

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

  it("skills: PLATFORM_ADMIN sees the coverage heatmap rollup (derived live)", async () => {
    const body = await getJson<SkillsBody>("/v1/analytics/skills", platformS);
    expect(body.scope.kind).toBe("PLATFORM");
    expect(body.scope.tenantId).toBeNull();
    expect(body.totalEvidence).toBe(await num(`SELECT count(*)::text AS n FROM sys.sys_user_skill_evidence`));
    expect(body.distinctUsers).toBe(
      await num(`SELECT count(DISTINCT user_skill_evidence_user_id)::text AS n FROM sys.sys_user_skill_evidence`),
    );
    expect(body.distinctOrgUnits).toBe(body.orgUnits.length);
    // Proficiency levels present = live DISTINCT set, canonical-rank ordered.
    const { rows: lvlRows } = await pool.query<{ p: string }>(
      `SELECT DISTINCT user_skill_evidence_declared_proficiency AS p FROM sys.sys_user_skill_evidence`,
    );
    const expectedLevels = PROFICIENCY_RANK.filter((l) => lvlRows.some((r2) => r2.p === l));
    expect(body.proficiencyLevels).toEqual(expectedLevels);
    // No '(unassigned)' fallthrough in the heatmap.
    expect(body.cells.some((c) => c.orgUnit === "(unassigned)")).toBe(false);
    expect(body.cells.length).toBeGreaterThan(0);
    // Per-proficiency column rollup derived live from the single source table.
    const { rows: bypRows } = await pool.query<{ p: string; ev: string; us: string }>(
      `SELECT user_skill_evidence_declared_proficiency AS p,
              count(*)::text AS ev,
              count(DISTINCT user_skill_evidence_user_id)::text AS us
         FROM sys.sys_user_skill_evidence GROUP BY 1`,
    );
    for (const row of bypRows) {
      const bucket = body.byProficiency.find((b) => b.proficiency === row.p);
      expect(bucket).toMatchObject({ evidenceCount: Number(row.ev), distinctUsers: Number(row.us) });
    }
    expect(body.byProficiency.length).toBe(bypRows.length);
    // Column totals sum to the grand total of evidences.
    const colSum = body.byProficiency.reduce((acc, b) => acc + b.evidenceCount, 0);
    expect(colSum).toBe(body.totalEvidence);
    // distinctUsers is NON-additive across buckets (>= grand total).
    const bucketUserSum = body.byProficiency.reduce((acc, b) => acc + b.distinctUsers, 0);
    expect(bucketUserSum).toBeGreaterThanOrEqual(body.distinctUsers);
    // Heatmap cells reconcile to the grand total too.
    const cellSum = body.cells.reduce((acc, c) => acc + c.evidenceCount, 0);
    expect(cellSum).toBe(body.totalEvidence);
    expect(new Date(body.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it("skills: TENANT_ADMIN sees TENANT scope (equals platform when single-tenant)", async () => {
    const platformBody = await getJson<SkillsBody>("/v1/analytics/skills", platformS);
    const body = await getJson<SkillsBody>("/v1/analytics/skills", tenantS);
    expect(body.scope.kind).toBe("TENANT");
    expect(body.scope.tenantId).not.toBeNull();
    const tenants = await num(
      `SELECT count(DISTINCT user_skill_evidence_tenant_id)::text AS n FROM sys.sys_user_skill_evidence`,
    );
    if (tenants === 1) {
      expect(body.totalEvidence).toBe(platformBody.totalEvidence);
      expect(body.distinctOrgUnits).toBe(platformBody.distinctOrgUnits);
    } else {
      expect(body.totalEvidence).toBeLessThanOrEqual(platformBody.totalEvidence);
    }
  });

  // --- Skills coverage by CATEGORY — the same evidence re-pivoted on
  // skill_category. DENSE: every evidence resolves to a category (invariant
  // enforced by mig 000196) → the by-category total equals the evidence total.

  interface SkillsByCategoryBody {
    scope: { kind: string; tenantId: string | null };
    categories: string[];
    proficiencyLevels: string[];
    cells: Array<{ category: string; proficiency: string; evidenceCount: number; distinctUsers: number }>;
    byCategory: Array<{ category: string; evidenceCount: number; distinctUsers: number }>;
    totalEvidence: number;
    distinctUsers: number;
    distinctCategories: number;
    generatedAt: string;
  }

  const CAT_JOIN = `FROM sys.sys_user_skill_evidence e
    JOIN sys.sys_skills sk ON sk.skill_id = e.user_skill_evidence_skill_id
    JOIN sys.sys_skill_categories sc ON sc.skill_category_id = sk.skill_category_id`;

  it("skills-by-category: unauthenticated → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/analytics/skills-by-category" });
    expect(r.statusCode).toBe(401);
  });

  it("skills-by-category: USER (employee) lacks analytics:view → 403", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/skills-by-category",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("skills-by-category: PLATFORM_ADMIN sees the category heatmap rollup (derived live, DENSE)", async () => {
    const body = await getJson<SkillsByCategoryBody>("/v1/analytics/skills-by-category", platformS);
    expect(body.scope.kind).toBe("PLATFORM");
    expect(body.scope.tenantId).toBeNull();
    const categorized = await num(`SELECT count(*)::text AS n ${CAT_JOIN}`);
    const allEvidence = await num(`SELECT count(*)::text AS n FROM sys.sys_user_skill_evidence`);
    // DENSE invariant: every evidence row resolves to a category.
    expect(categorized).toBe(allEvidence);
    expect(body.totalEvidence).toBe(categorized);
    expect(body.distinctUsers).toBe(
      await num(`SELECT count(DISTINCT e.user_skill_evidence_user_id)::text AS n ${CAT_JOIN}`),
    );
    expect(body.distinctCategories).toBe(
      await num(`SELECT count(DISTINCT sc.skill_category_id)::text AS n ${CAT_JOIN}`),
    );
    expect(body.categories.length).toBe(body.distinctCategories);
    // Per-category row rollup derived live (category display name).
    const { rows: catRows } = await pool.query<{ c: string; ev: string; us: string }>(
      `SELECT sc.skill_category_name AS c,
              count(*)::text AS ev,
              count(DISTINCT e.user_skill_evidence_user_id)::text AS us
         ${CAT_JOIN} GROUP BY 1 ORDER BY count(*) DESC`,
    );
    expect(body.byCategory.length).toBe(catRows.length);
    for (const row of catRows) {
      const bucket = body.byCategory.find((b) => b.category === row.c);
      expect(bucket).toMatchObject({ evidenceCount: Number(row.ev), distinctUsers: Number(row.us) });
    }
    // byCategory is evidence-desc ordered and the axis head matches.
    for (let i = 1; i < body.byCategory.length; i++) {
      expect(body.byCategory[i]!.evidenceCount).toBeLessThanOrEqual(body.byCategory[i - 1]!.evidenceCount);
    }
    expect(body.categories[0]).toBe(body.byCategory[0]?.category);
    // Row totals sum to the grand total.
    const rowSum = body.byCategory.reduce((acc, b) => acc + b.evidenceCount, 0);
    expect(rowSum).toBe(body.totalEvidence);
    // Cells reconcile too.
    const cellSum = body.cells.reduce((acc, c) => acc + c.evidenceCount, 0);
    expect(cellSum).toBe(body.totalEvidence);
    expect(new Date(body.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it("skills-by-category: TENANT_ADMIN sees TENANT scope (equals platform when single-tenant)", async () => {
    const platformBody = await getJson<SkillsByCategoryBody>("/v1/analytics/skills-by-category", platformS);
    const body = await getJson<SkillsByCategoryBody>("/v1/analytics/skills-by-category", tenantS);
    expect(body.scope.kind).toBe("TENANT");
    expect(body.scope.tenantId).not.toBeNull();
    const tenants = await num(
      `SELECT count(DISTINCT user_skill_evidence_tenant_id)::text AS n FROM sys.sys_user_skill_evidence`,
    );
    if (tenants === 1) {
      expect(body.totalEvidence).toBe(platformBody.totalEvidence);
      expect(body.distinctCategories).toBe(platformBody.distinctCategories);
    } else {
      expect(body.totalEvidence).toBeLessThanOrEqual(platformBody.totalEvidence);
    }
  });

  // --- Org-network metrics — structural metrics over the position reports-to graph.

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
    const body = await getJson<OrgNetworkBody>("/v1/analytics/org-network", platformS);
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
    const body = await getJson<OrgNetworkBody>("/v1/analytics/org-network", tenantS);
    expect(body.scope.kind).toBe("TENANT");
    expect(body.scope.tenantId).not.toBeNull();
    expect(body.totalPositions).toBeGreaterThan(0);
  });

  // --- Overtime requests — anchors derived live from sys.sys_overtime
  // (distinct from attendance worked hours).

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

  it("overtime: PLATFORM_ADMIN sees the request rollup (derived live)", async () => {
    const body = await getJson<OvertimeBody>("/v1/analytics/overtime", platformS);
    expect(body.scope.kind).toBe("PLATFORM");
    expect(body.scope.tenantId).toBeNull();
    // Grand totals derived from the source table.
    expect(body.totalRequests).toBe(await num(`SELECT count(*)::text AS n FROM sys.sys_overtime`));
    expect(body.totalHours).toBeCloseTo(
      await num(`SELECT round(sum(overtime_hours), 2)::text AS n FROM sys.sys_overtime`),
      1,
    );
    // byStatus derived live; counts reconcile.
    const { rows: stRows } = await pool.query<{ s: string; c: string }>(
      `SELECT overtime_status AS s, count(*)::text AS c FROM sys.sys_overtime GROUP BY 1`,
    );
    expect(body.byStatus.length).toBe(stRows.length);
    for (const row of stRows) {
      const bucket = body.byStatus.find((b) => b.status === row.s);
      expect(bucket?.count).toBe(Number(row.c));
    }
    const statusCountSum = body.byStatus.reduce((acc, s) => acc + s.count, 0);
    expect(statusCountSum).toBe(body.totalRequests);
    // byType derived live; count-desc ordered; counts reconcile.
    const { rows: tyRows } = await pool.query<{ t: string; c: string }>(
      `SELECT overtime_type AS t, count(*)::text AS c FROM sys.sys_overtime GROUP BY 1`,
    );
    expect(body.byType.length).toBe(tyRows.length);
    for (const row of tyRows) {
      const bucket = body.byType.find((b) => b.type === row.t);
      expect(bucket?.count).toBe(Number(row.c));
    }
    const typeCountSum = body.byType.reduce((acc, t) => acc + t.count, 0);
    expect(typeCountSum).toBe(body.totalRequests);
    for (let i = 1; i < body.byType.length; i++) {
      expect(body.byType[i]!.count).toBeLessThanOrEqual(body.byType[i - 1]!.count);
    }
    // monthly: chronological, first/last derived, totals reconcile.
    expect(body.monthly.length).toBe(
      await num(`SELECT count(DISTINCT date_trunc('month', overtime_date))::text AS n FROM sys.sys_overtime`),
    );
    expect(body.monthly[0]?.month).toBe(
      await txt(`SELECT to_char(min(overtime_date), 'YYYY-MM') AS v FROM sys.sys_overtime`),
    );
    expect(body.monthly[body.monthly.length - 1]?.month).toBe(
      await txt(`SELECT to_char(max(overtime_date), 'YYYY-MM') AS v FROM sys.sys_overtime`),
    );
    const monthlyCountSum = body.monthly.reduce((acc, m) => acc + m.count, 0);
    expect(monthlyCountSum).toBe(body.totalRequests);
    // byOrgUnit: every request resolves (no '(unassigned)'), hours-desc ordered,
    // and the OU dimension count matches the live chain.
    expect(body.byOrgUnit.some((o) => o.dimension === "(unassigned)")).toBe(false);
    const ouCount = await num(
      `SELECT count(DISTINCT ou.organization_unit_id)::text AS n
         FROM (SELECT DISTINCT overtime_subject_user_id AS u_id FROM sys.sys_overtime) ot
         ${OU_CHAIN}`,
    );
    expect(body.byOrgUnit.length).toBe(ouCount);
    for (let i = 1; i < body.byOrgUnit.length; i++) {
      expect(body.byOrgUnit[i]!.hours).toBeLessThanOrEqual(body.byOrgUnit[i - 1]!.hours);
    }
    const ouCountSum = body.byOrgUnit.reduce((acc, o) => acc + o.count, 0);
    expect(ouCountSum).toBe(body.totalRequests);
    expect(new Date(body.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it("overtime: TENANT_ADMIN sees TENANT scope (equals platform when single-tenant)", async () => {
    const platformBody = await getJson<OvertimeBody>("/v1/analytics/overtime", platformS);
    const body = await getJson<OvertimeBody>("/v1/analytics/overtime", tenantS);
    expect(body.scope.kind).toBe("TENANT");
    expect(body.scope.tenantId).not.toBeNull();
    const tenants = await num(`SELECT count(DISTINCT overtime_tenant_id)::text AS n FROM sys.sys_overtime`);
    if (tenants === 1) {
      expect(body.totalRequests).toBe(platformBody.totalRequests);
      expect(body.byOrgUnit.length).toBe(platformBody.byOrgUnit.length);
    } else {
      expect(body.totalRequests).toBeLessThanOrEqual(platformBody.totalRequests);
    }
  });

  // --- Skills-group share — ESCO skill GROUPS, catalogue-global rollup
  // (skill_metadata->>'skill_group_uri'). All anchors derived live.

  interface SkillsGroupShareBody {
    scope: { kind: string; tenantId: string | null };
    groups: Array<{ groupCode: string; groupUri: string; skillCount: number; sharePct: number }>;
    otherGroupsCount: number;
    otherSkillCount: number;
    totalSkills: number;
    totalGrouped: number;
    ungroupedSkills: number;
    distinctGroups: number;
    generatedAt: string;
  }

  it("skills-group-share: unauthenticated → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/analytics/skills-group-share" });
    expect(r.statusCode).toBe(401);
  });

  it("skills-group-share: USER (employee) lacks analytics:view → 403", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/skills-group-share",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("skills-group-share: PLATFORM_ADMIN sees the ESCO group distribution (derived live)", async () => {
    const body = await getJson<SkillsGroupShareBody>("/v1/analytics/skills-group-share", platformS);
    const totalSkills = await num(`SELECT count(*)::text AS n FROM sys.sys_skills`);
    const totalGrouped = await num(
      `SELECT count(skill_metadata->>'skill_group_uri')::text AS n FROM sys.sys_skills`,
    );
    const distinctGroups = await num(
      `SELECT count(DISTINCT skill_metadata->>'skill_group_uri')::text AS n FROM sys.sys_skills`,
    );
    expect(body.totalSkills).toBe(totalSkills);
    expect(body.totalGrouped).toBe(totalGrouped);
    expect(body.distinctGroups).toBe(distinctGroups);
    expect(body.ungroupedSkills).toBe(totalSkills - totalGrouped);
    // top-N groups (capped at 25), skillCount-desc; "other" holds the remainder.
    expect(body.groups.length).toBe(Math.min(25, distinctGroups));
    expect(body.otherGroupsCount).toBe(distinctGroups - body.groups.length);
    for (let i = 1; i < body.groups.length; i++) {
      expect(body.groups[i]!.skillCount).toBeLessThanOrEqual(body.groups[i - 1]!.skillCount);
    }
    // Largest group derived live (count + share).
    const { rows: topRows } = await pool.query<{ uri: string; c: string }>(
      `SELECT skill_metadata->>'skill_group_uri' AS uri, count(*)::text AS c
         FROM sys.sys_skills
        WHERE skill_metadata->>'skill_group_uri' IS NOT NULL
        GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1`,
    );
    expect(body.groups[0]!.groupUri).toBe(topRows[0]!.uri);
    expect(body.groups[0]!.skillCount).toBe(Number(topRows[0]!.c));
    expect(body.groups[0]!.sharePct).toBeCloseTo((Number(topRows[0]!.c) / totalGrouped) * 100, 1);
    // groupCode is the readable vocabulary segment (skill/… or isced-f/…), NOT the API path.
    for (const g of body.groups) {
      expect(g.groupCode).toMatch(/^(skill|isced-f|occupation)\//);
      expect(g.groupCode).not.toContain("api/");
      expect(g.groupUri).toContain("esco");
      expect(g.sharePct).toBeGreaterThan(0);
    }
    // top-N + the "other" bucket reconcile to the grand grouped total.
    const topSum = body.groups.reduce((acc, g) => acc + g.skillCount, 0);
    expect(topSum + body.otherSkillCount).toBe(body.totalGrouped);
    expect(new Date(body.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it("skills-group-share: TENANT_ADMIN sees TENANT scope tag but the same global catalogue", async () => {
    const platformBody = await getJson<SkillsGroupShareBody>("/v1/analytics/skills-group-share", platformS);
    const body = await getJson<SkillsGroupShareBody>("/v1/analytics/skills-group-share", tenantS);
    expect(body.scope.kind).toBe("TENANT");
    // The ESCO catalogue is global → TENANT sees the same totals as PLATFORM.
    expect(body.totalGrouped).toBe(platformBody.totalGrouped);
    expect(body.distinctGroups).toBe(platformBody.distinctGroups);
  });
});
