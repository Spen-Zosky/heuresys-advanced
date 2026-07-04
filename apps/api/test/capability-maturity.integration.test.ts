import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { deriveLevel, type MaturityMetrics } from "../src/modules/capability-maturity/service.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

// Gap#1 Maturity engine Phase-2 (/v1/capability/maturity/*). Real login + live DB.
// Derives L0..L5 per org-unit from the MLCE composite + the v1-full coded rubric
// (bands + gate criteria). capability:read = admin/ORG_DIRECTOR/HR; recompute = admin+CSRF.

const PWD = TEST_PERSONA_PASSWORD;
interface S { cookies: Map<string, string>; csrfToken: string; userId: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: body.csrfToken, userId: body.user.userId };
}

interface Criterion { level: string; met: boolean; metric: string; value: number | null; threshold: number | null; operator: string }
interface MScore { orgUnitId: string; tenantId: string; level: string; levelLabel: string; composite: number; rubricVersion: string; criteria: Criterion[] }
interface MList { scope: { kind: string; tenantId: string | null }; items: MScore[]; total: number }
const LEVELS = ["L0", "L1", "L2", "L3", "L4", "L5"];

let suite: TestApp;
let admin: S; let tenantAdmin: S; let manager: S; let plainUser: S;

function post(s: S, url: string) {
  return suite.app.inject({ method: "POST", url, headers: { cookie: ch(s.cookies), "x-csrf-token": s.csrfToken, "content-type": "application/json" }, payload: {} });
}
const recomputeMlce = (s: S) => post(s, "/v1/capability/composition/recompute");
const recompute = (s: S) => post(s, "/v1/capability/maturity/recompute");
const list = (s: S) => suite.app.inject({ method: "GET", url: "/v1/capability/maturity", headers: { cookie: ch(s.cookies) } });
const single = (s: S, ouId: string) => suite.app.inject({ method: "GET", url: `/v1/capability/maturity/org-units/${ouId}`, headers: { cookie: ch(s.cookies) } });

beforeAll(async () => {
  suite = await buildTestApp();
  admin = await login(suite, "admin@heuresys.com");
  tenantAdmin = await login(suite, "federica.marchetti@rtl-bank.org");
  manager = await login(suite, "paolo.caputo@rtl-bank.org");
  plainUser = await login(suite, "tommaso.fiore@rtl-bank.org");
  await recomputeMlce(admin); // maturity consumes MLCE composites
  await recompute(admin);
});
afterAll(async () => { await suite.app.close(); });

describe("capability-maturity API (Gap#1 Maturity engine)", () => {
  it("rubric deriveLevel is a pure gated ladder (unit, deterministic)", () => {
    const high: MaturityMetrics = { composite: 95, skillCoverage: 1, kpiAchievement: 0.9, readinessCoverage: 0.8, majorGapRatio: 0 };
    expect(deriveLevel(high).level).toBe("L5");
    // composite high but KPI gate fails at L3 → gated downgrade to L2
    const downgraded: MaturityMetrics = { composite: 95, skillCoverage: 1, kpiAchievement: 0.5, readinessCoverage: 0.8, majorGapRatio: 0 };
    expect(downgraded.composite).toBe(95);
    expect(deriveLevel(downgraded).level).toBe("L2");
    expect(deriveLevel({ composite: 10, skillCoverage: 0, kpiAchievement: 0, readinessCoverage: 0, majorGapRatio: 0 }).level).toBe("L0");
  });

  it("RBAC: plain USER → 403 list; MANAGER → 403 list + 403 recompute", async () => {
    expect((await list(plainUser)).statusCode).toBe(403);
    expect((await list(manager)).statusCode).toBe(403);
    expect((await recompute(manager)).statusCode).toBe(403);
  });

  it("CSRF: admin recompute without token → 403 CSRF_FAIL", async () => {
    const r = await suite.app.inject({ method: "POST", url: "/v1/capability/maturity/recompute", headers: { cookie: ch(admin.cookies), "content-type": "application/json" }, payload: {} });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("CSRF_FAIL");
  });

  it("recompute (admin) → 200, scores org-units", async () => {
    const r = await recompute(admin);
    expect(r.statusCode).toBe(200);
    const b = r.json() as { accepted: boolean; scored: number; rubricVersion: string };
    expect(b.accepted).toBe(true);
    expect(b.scored).toBeGreaterThan(0);
    expect(b.rubricVersion).toBe("v1-full");
  });

  it("list (admin): valid levels, scope PLATFORM, criteria present + reproducible", async () => {
    const b = (await list(admin)).json() as MList;
    expect(b.scope.kind).toBe("PLATFORM");
    expect(b.items.length).toBeGreaterThan(0);
    for (const m of b.items) {
      expect(LEVELS).toContain(m.level);
      expect(m.composite).toBeGreaterThanOrEqual(0);
      expect(m.composite).toBeLessThanOrEqual(100);
      expect(m.rubricVersion).toBe("v1-full");
      expect(m.criteria.length).toBeGreaterThan(0);
    }
  });

  it("auditable bridge: maturity.composite == the MLCE ORG_UNIT composite for the same OU", async () => {
    const m = (await list(admin)).json() as MList;
    const sample = m.items[0]!;
    const mlce = await suite.app.inject({ method: "GET", url: `/v1/capability/composition/ORG_UNIT/${sample.orgUnitId}`, headers: { cookie: ch(admin.cookies) } });
    expect(mlce.statusCode).toBe(200);
    expect((mlce.json() as { value: number }).value).toBe(sample.composite);
  });

  it("single org-unit: 200 with criteria; 404 for unknown id", async () => {
    const ouId = ((await list(admin)).json() as MList).items[0]!.orgUnitId;
    const r = await single(admin, ouId);
    expect(r.statusCode).toBe(200);
    const b = r.json() as MScore;
    expect(b.orgUnitId).toBe(ouId);
    expect(b.criteria.some((c) => c.metric === "composite")).toBe(true);
    expect((await single(admin, "00000000-0000-0000-0000-000000000000")).statusCode).toBe(404);
  });

  it("deterministic + D-18 bounded: recompute twice → identical level, no row growth", async () => {
    const before = ((await list(admin)).json() as MList).items[0]!;
    const countRows = async () => {
      const r = await pool.query<{ rows: string; subj: string }>(
        `SELECT count(*)::int AS rows, count(DISTINCT (capability_maturity_score_org_unit_id, capability_maturity_score_capability_ref))::int AS subj
           FROM sys.sys_capability_maturity_scores`);
      return { rows: Number(r.rows[0]!.rows), subj: Number(r.rows[0]!.subj) };
    };
    const s1 = await countRows();
    expect(s1.rows).toBe(s1.subj);
    expect((await recompute(admin)).statusCode).toBe(200);
    const s2 = await countRows();
    expect(s2.rows).toBe(s1.rows);
    const after = ((await list(admin)).json() as MList).items.find((m) => m.orgUnitId === before.orgUnitId)!;
    expect(after.level).toBe(before.level);
    expect(after.composite).toBe(before.composite);
  });

  it("I5: TENANT_ADMIN sees only its own tenant's maturity scores", async () => {
    const ta = (await list(tenantAdmin)).json() as MList;
    expect(ta.scope.kind).toBe("TENANT");
    expect(ta.items.length).toBeGreaterThan(0);
    expect(new Set(ta.items.map((i) => i.tenantId)).size).toBe(1);
  });
});
