import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

// Gap#1 MLCE Phase-1 — in-platform capability composition (/v1/capability/composition/*).
// Real login + live DB (RTL_BANK). capability:read = PLATFORM_ADMIN/TENANT_ADMIN/ORG_DIRECTOR/
// HRMS_MANAGER (no MANAGER, no ESS). capability:admin (recompute, CSRF) = PLATFORM_ADMIN/TENANT_ADMIN.
// Score is a DETERMINISTIC bottom-up rule (employee->position->org-unit->org) over live sys.*.

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

interface Lineage { childType: string; childId: string; childLabel: string | null; childValue: number; weight: number }
interface Score { subjectType: string; subjectId: string; tenantId: string; label: string | null; value: number; coverage: number; aggregationMode: string; modelVersion: string; childCount: number; computedAt: string; lineage: Lineage[] }
interface ListBody { scope: { kind: string; tenantId: string | null }; items: Score[]; total: number }
const TYPES = ["EMPLOYEE", "POSITION", "ORG_UNIT", "ORG"];

let suite: TestApp;
let admin: S;        // PLATFORM_ADMIN — read + admin
let tenantAdmin: S;  // TENANT_ADMIN (RTL) — read + admin, TENANT scope
let manager: S;      // MANAGER (RTL) — NO capability perms
let plainUser: S;    // USER — NO capability perms

async function recompute(s: S) {
  return suite.app.inject({
    method: "POST", url: "/v1/capability/composition/recompute",
    headers: { cookie: ch(s.cookies), "x-csrf-token": s.csrfToken, "content-type": "application/json" },
    payload: {},
  });
}
async function list(s: S, subjectType?: string) {
  const q = subjectType ? `?subjectType=${subjectType}` : "";
  return suite.app.inject({ method: "GET", url: `/v1/capability/composition${q}`, headers: { cookie: ch(s.cookies) } });
}
async function single(s: S, subjectType: string, subjectId: string) {
  return suite.app.inject({ method: "GET", url: `/v1/capability/composition/${subjectType}/${subjectId}`, headers: { cookie: ch(s.cookies) } });
}

beforeAll(async () => {
  suite = await buildTestApp();
  admin = await login(suite, "admin@heuresys.com");
  tenantAdmin = await login(suite, "federica.marchetti@rtl-bank.org");
  manager = await login(suite, "paolo.caputo@rtl-bank.org");
  plainUser = await login(suite, "tommaso.fiore@rtl-bank.org");
  await recompute(admin); // guarantee a cohort exists regardless of test order
});

afterAll(async () => { await suite.app.close(); });

describe("capability-composition API (Gap#1 MLCE)", () => {
  it("RBAC: plain USER lacks capability:read → 403 on list", async () => {
    expect((await list(plainUser)).statusCode).toBe(403);
  });

  it("RBAC: MANAGER lacks capability:read → 403 on list, and cannot recompute → 403", async () => {
    expect((await list(manager)).statusCode).toBe(403);
    expect((await recompute(manager)).statusCode).toBe(403);
  });

  it("CSRF: admin recompute without x-csrf-token → 403 CSRF_FAIL", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/capability/composition/recompute",
      headers: { cookie: ch(admin.cookies), "content-type": "application/json" }, payload: {},
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("CSRF_FAIL");
  });

  it("recompute (admin) scores all four levels in-platform", async () => {
    const r = await recompute(admin);
    expect(r.statusCode).toBe(200);
    const b = r.json() as { accepted: boolean; scored: { employee: number; position: number; orgUnit: number; org: number; total: number }; modelVersion: string };
    expect(b.accepted).toBe(true);
    expect(b.modelVersion).toBe("capability-composition-v1");
    expect(b.scored.employee).toBeGreaterThan(0);
    expect(b.scored.position).toBeGreaterThan(0);
    expect(b.scored.orgUnit).toBeGreaterThan(0);
    expect(b.scored.org).toBeGreaterThan(0);
    expect(b.scored.total).toBe(b.scored.employee + b.scored.position + b.scored.orgUnit + b.scored.org);
  });

  it("list ORG_UNIT (admin): valid 0..100 values, scope PLATFORM", async () => {
    const r = await list(admin, "ORG_UNIT");
    expect(r.statusCode).toBe(200);
    const b = r.json() as ListBody;
    expect(b.scope.kind).toBe("PLATFORM");
    expect(b.items.length).toBeGreaterThan(0);
    for (const s of b.items) {
      expect(s.subjectType).toBe("ORG_UNIT");
      expect(s.value).toBeGreaterThanOrEqual(0);
      expect(s.value).toBeLessThanOrEqual(100);
      expect(s.coverage).toBeGreaterThanOrEqual(0);
      expect(s.coverage).toBeLessThanOrEqual(100);
      expect(s.modelVersion).toBe("capability-composition-v1");
      expect(TYPES).toContain(s.subjectType);
    }
  });

  it("single ORG_UNIT (admin): 200 + non-empty lineage with normalized weights (~1.0)", async () => {
    const ou = ((await list(admin, "ORG_UNIT")).json() as ListBody).items.find((s) => s.childCount > 0);
    expect(ou).toBeTruthy();
    const r = await single(admin, "ORG_UNIT", ou!.subjectId);
    expect(r.statusCode).toBe(200);
    const b = r.json() as Score;
    expect(b.subjectId).toBe(ou!.subjectId);
    expect(b.lineage.length).toBeGreaterThan(0);
    for (const l of b.lineage) {
      expect(TYPES).toContain(l.childType);
      expect(l.childValue).toBeGreaterThanOrEqual(0);
      expect(l.childValue).toBeLessThanOrEqual(100);
    }
    const wsum = b.lineage.reduce((a, l) => a + l.weight, 0);
    expect(Math.abs(wsum - 1)).toBeLessThan(0.01);
  });

  it("ORG lineage children are all ORG_UNIT (roll-up chain)", async () => {
    const org = ((await list(admin, "ORG")).json() as ListBody).items[0];
    expect(org).toBeTruthy();
    const r = await single(admin, "ORG", org!.subjectId);
    expect(r.statusCode).toBe(200);
    const b = r.json() as Score;
    expect(b.lineage.length).toBeGreaterThan(0);
    for (const l of b.lineage) expect(l.childType).toBe("ORG_UNIT");
  });

  it("deterministic: recompute twice → identical active value for an ORG_UNIT subject", async () => {
    const ou = ((await list(admin, "ORG_UNIT")).json() as ListBody).items[0]!;
    expect((await recompute(admin)).statusCode).toBe(200);
    const after = (await single(admin, "ORG_UNIT", ou.subjectId)).json() as Score;
    expect(after.value).toBe(ou.value);
    expect(after.coverage).toBe(ou.coverage);
  });

  it("D-18: recompute is bounded — one active row per (subject_type, subject_id), no growth", async () => {
    const stats = async () => {
      const r = await pool.query<{ rows: string; subjects: string }>(
        `SELECT count(*)::int AS rows,
                count(DISTINCT (capability_score_subject_type, capability_score_subject_id))::int AS subjects
           FROM sys.sys_capability_scores`,
      );
      return { rows: Number(r.rows[0]!.rows), subjects: Number(r.rows[0]!.subjects) };
    };
    expect((await recompute(admin)).statusCode).toBe(200);
    const s1 = await stats();
    expect(s1.rows).toBe(s1.subjects);
    expect((await recompute(admin)).statusCode).toBe(200);
    const s2 = await stats();
    expect(s2.rows).toBe(s1.rows);
    expect(s2.rows).toBe(s2.subjects);
  });

  // #88 — the aggregation mass used to be COALESCE(position_economic_weight, criticalityFactor).
  // That column is NULL on every row, so the mass was always the criticality factor, which takes
  // exactly four values (0.5/1.0/1.5/2.0) and is MEDIUM on 160 of 181 positions. These tests fail
  // against that implementation: it cannot produce more than four distinct masses, and it cannot
  // separate two MEDIUM positions that sit in different pay bands.
  describe("aggregation mass comes from the compensation band (#88)", () => {
    interface MassRow { subject_id: string; mass: string; criticality: string | null; base: string | null }

    async function massesWithBands(): Promise<MassRow[]> {
      expect((await recompute(admin)).statusCode).toBe(200);
      const r = await pool.query<MassRow>(
        `WITH latest AS (
           SELECT DISTINCT ON (capability_score_subject_id)
                  capability_score_subject_id AS subject_id,
                  capability_score_payload->'derivation'->>'weightMass' AS mass
             FROM sys.sys_capability_scores
            WHERE capability_score_subject_type = 'POSITION'
            ORDER BY capability_score_subject_id, capability_score_computed_at DESC
         )
         SELECT l.subject_id, l.mass, p.position_criticality AS criticality,
                avg(cb.compensation_band_mid_eur)::text AS base
           FROM latest l
           JOIN sys.sys_positions p ON p.position_id = l.subject_id
           LEFT JOIN sys.sys_position_compensation_profiles pcp ON pcp.position_id = p.position_id
           LEFT JOIN sys.sys_compensation_bands cb ON cb.compensation_band_id = pcp.compensation_band_id
          GROUP BY 1, 2, 3`,
      );
      return r.rows;
    }

    it("the mass takes more values than the four the criticality factor can produce", async () => {
      const rows = await massesWithBands();
      expect(rows.length).toBeGreaterThan(0);
      const distinct = new Set(rows.map((r) => r.mass));
      expect(distinct.size).toBeGreaterThan(4);
    });

    it("two positions with the same criticality but different bands get different mass", async () => {
      const rows = (await massesWithBands()).filter((r) => r.criticality === "MEDIUM" && r.base !== null);
      const byBand = new Map<string, string>();
      for (const r of rows) byBand.set(String(Number(r.base)), r.mass!);
      expect(byBand.size).toBeGreaterThan(1); // the fixture must actually contain the contrast
      const masses = new Set(byBand.values());
      expect(masses.size).toBe(byBand.size);
    });

    it("mass rises with the band — the ordering is preserved, not merely scattered", async () => {
      const rows = (await massesWithBands())
        .filter((r) => r.base !== null)
        .sort((a, b) => Number(a.base) - Number(b.base));
      expect(rows.length).toBeGreaterThan(2);
      const first = rows[0]!, last = rows[rows.length - 1]!;
      expect(Number(last.mass)).toBeGreaterThan(Number(first.mass));
      for (let i = 1; i < rows.length; i++) {
        const prev = rows[i - 1]!, cur = rows[i]!;
        if (Number(cur.base) > Number(prev.base)) {
          expect(Number(cur.mass)).toBeGreaterThanOrEqual(Number(prev.mass));
        }
      }
    });

    it("a position without a band falls back to criticality, never to zero", async () => {
      const rows = (await massesWithBands()).filter((r) => r.base === null);
      for (const r of rows) expect(Number(r.mass)).toBeGreaterThan(0);
      // And the mass stays inside the same span as the criticality factor it replaces.
      for (const r of await massesWithBands()) {
        expect(Number(r.mass)).toBeGreaterThanOrEqual(0.5);
        expect(Number(r.mass)).toBeLessThanOrEqual(2.0);
      }
    });
  });

  it("single subject: 404 for an unknown id", async () => {
    const r = await single(admin, "ORG_UNIT", "00000000-0000-0000-0000-000000000000");
    expect(r.statusCode).toBe(404);
  });

  it("I5: TENANT_ADMIN sees only its own tenant's scores (platform is a superset)", async () => {
    const adminList = (await list(admin)).json() as ListBody;
    const taResp = await list(tenantAdmin);
    expect(taResp.statusCode).toBe(200);
    const ta = taResp.json() as ListBody;
    expect(ta.scope.kind).toBe("TENANT");
    expect(ta.items.length).toBeGreaterThan(0);
    expect(new Set(ta.items.map((i) => i.tenantId)).size).toBe(1);
    expect(adminList.total).toBeGreaterThanOrEqual(ta.total);
  });
});
