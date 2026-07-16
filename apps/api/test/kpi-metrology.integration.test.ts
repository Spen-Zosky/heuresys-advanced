/**
 * apps/api/test/kpi-metrology.integration.test.ts — #31 (S1018).
 *
 * KPI metrology reads over the 000015 satellites: assessment-method and
 * weighting-rule GLOBAL catalogs, per-KPI metric definitions, per-KPI
 * measurements with org-axis filtering (EVALUATION class — subtree scope sees
 * allow-listed users' rows + NULL-user org-level rows). Expectations derive
 * from the LIVE DB; person-scoped semantics proven with deterministic fixtures
 * (tx-isolation rolls everything back).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const PFX = `IT_KM_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}
async function liveCount(sql: string, params: unknown[] = []): Promise<number> {
  const r = await pool.query<{ n: string }>(sql, params);
  return Number(r.rows[0]!.n);
}

let suite: TestApp;
let federica: S; let paolo: S;
let rtlTenantId: string; let tommasoId: string; let antonioId: string;
let fixtureKpiId: string;

describe("#31 KPI metrology", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    federica = await login(suite, "federica.marchetti@rtl-bank.org");
    paolo = await login(suite, "paolo.caputo@rtl-bank.org");
    const u = await pool.query<{ user_id: string; user_email: string; user_tenant_id: string }>(
      `SELECT user_id, user_email, user_tenant_id FROM sys.sys_users WHERE user_email = ANY($1)`,
      [["tommaso.fiore@rtl-bank.org", "antonio.parisi@rtl-bank.org"]]);
    for (const row of u.rows) {
      if (row.user_email.startsWith("tommaso")) { tommasoId = row.user_id; rtlTenantId = row.user_tenant_id; }
      else antonioId = row.user_id;
    }

    // Fixture KPI (tenant-scoped, via real API) + 3 measurements: tommaso / antonio / org-level(NULL).
    const created = await suite.app.inject({
      method: "POST", url: "/v1/kpi-definitions",
      headers: { cookie: ch(federica.cookies), "x-csrf-token": federica.csrfToken, "content-type": "application/json" },
      payload: { code: `${PFX}_KPI`, name: "#31 fixture KPI", unit: "%" },
    });
    expect(created.statusCode).toBe(201);
    fixtureKpiId = (created.json() as { kpiDefinitionId: string }).kpiDefinitionId;
    await pool.query(
      `INSERT INTO sys.sys_kpi_measurements
         (kpi_measurement_tenant_id, kpi_measurement_kpi_id, kpi_measurement_user_id,
          kpi_measurement_period_start, kpi_measurement_period_end, kpi_measurement_value, kpi_measurement_source)
       VALUES ($1,$2,$3,'2026-01-01','2026-03-31',82.5,'${PFX}'),
              ($1,$2,$4,'2026-01-01','2026-03-31',77.0,'${PFX}'),
              ($1,$2,NULL,'2026-01-01','2026-03-31',80.0,'${PFX}')`,
      [rtlTenantId, fixtureKpiId, tommasoId, antonioId]);
    // 2 fixture metric definitions on the fixture KPI.
    await pool.query(
      `INSERT INTO sys.sys_kpi_metric_definitions
         (kpi_metric_definition_kpi_id, kpi_metric_definition_code, kpi_metric_definition_name, kpi_metric_definition_aggregation)
       VALUES ($1,'${PFX}_M1','numerator','SUM'), ($1,'${PFX}_M2','ratio','RATIO')`,
      [fixtureKpiId]);
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("assessment-methods: global catalog served in full (live-derived count + valid codes)", async () => {
    const live = await liveCount(`SELECT count(*)::text AS n FROM sys.sys_kpi_assessment_methods`);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/kpi-definitions/assessment-methods",
      headers: { cookie: ch(federica.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { code: string }[]; total: number };
    expect(body.total).toBe(live);
    expect(body.total).toBeGreaterThan(0);
    const valid = new Set(["DELTA_VS_TARGET", "PERCENTILE", "BANDED", "LINEAR_SCORE", "STEPPED"]);
    for (const m of body.items) expect(valid.has(m.code)).toBe(true);
  });

  it("weighting-rules: global catalog served in full (live-derived)", async () => {
    const live = await liveCount(`SELECT count(*)::text AS n FROM sys.sys_kpi_weighting_rules`);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/kpi-definitions/weighting-rules",
      headers: { cookie: ch(federica.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { kind: string }[]; total: number };
    expect(body.total).toBe(live);
    expect(body.total).toBeGreaterThan(0);
  });

  it("per-KPI metrics: fixture KPI returns its 2 metric definitions", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/kpi-definitions/${fixtureKpiId}/metrics`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { code: string; aggregation: string }[]; total: number };
    expect(body.total).toBe(2);
    expect(body.items.map((m) => m.aggregation).sort()).toEqual(["RATIO", "SUM"]);
  });

  it("measurements: TENANT_ADMIN sees all 3 fixture rows; MANAGER sees subtree+org-level only (I19)", async () => {
    const asFederica = await suite.app.inject({
      method: "GET", url: `/v1/kpi-definitions/${fixtureKpiId}/measurements`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect(asFederica.statusCode).toBe(200);
    expect((asFederica.json() as { total: number }).total).toBe(3);

    const asPaolo = await suite.app.inject({
      method: "GET", url: `/v1/kpi-definitions/${fixtureKpiId}/measurements`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(asPaolo.statusCode).toBe(200);
    const body = asPaolo.json() as { items: { userId: string | null }[]; total: number };
    expect(body.total).toBe(2); // tommaso (in subtree) + NULL (org-level); antonio filtered out
    expect(body.items.some((m) => m.userId === antonioId)).toBe(false);
    expect(body.items.some((m) => m.userId === tommasoId)).toBe(true);
    expect(body.items.some((m) => m.userId === null)).toBe(true);
  });

  it("measurements: userId filter composes with the org gate", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/kpi-definitions/${fixtureKpiId}/measurements?userId=${tommasoId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    const body = r.json() as { items: { value: number }[]; total: number };
    expect(body.total).toBe(1);
    expect(body.items[0]!.value).toBe(82.5);
  });

  it("LIVE reservoir: a real KPI with live measurements serves them through the API", async () => {
    const g = await pool.query<{ id: string; n: string }>(
      `SELECT kpi_measurement_kpi_id AS id, count(*)::text AS n
         FROM sys.sys_kpi_measurements
        WHERE kpi_measurement_tenant_id = $1 AND kpi_measurement_source IS DISTINCT FROM '${PFX}'
        GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`, [rtlTenantId]);
    if (!g.rows[0]) return; // no live measurements in this tenant — fixture tests cover the path
    const r = await suite.app.inject({
      method: "GET", url: `/v1/kpi-definitions/${g.rows[0].id}/measurements?limit=200`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { total: number }).total).toBe(Number(g.rows[0].n));
  });
});
