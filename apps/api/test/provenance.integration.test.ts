/**
 * apps/api/test/provenance.integration.test.ts — #28 (S1018) Trust Ledger.
 *
 * READ-only API over sys.sys_source_lineage_records (70k+ live rows).
 * RBAC: provenance:read = PLATFORM_ADMIN + TENANT_ADMIN only (mig 000171);
 * tenant filter for non-platform. All expectations derive from the LIVE DB.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;

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
let admin: S; let federica: S; let paolo: S;
let rtlTenantId: string;

describe("#28 provenance trust-ledger", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    admin = await login(suite, "admin@heuresys.com");
    federica = await login(suite, "federica.marchetti@rtl-bank.org");
    paolo = await login(suite, "paolo.caputo@rtl-bank.org");
    const t = await pool.query<{ user_tenant_id: string }>(
      `SELECT user_tenant_id FROM sys.sys_users WHERE user_email = $1`,
      ["federica.marchetti@rtl-bank.org"]);
    rtlTenantId = t.rows[0]!.user_tenant_id;
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("PLATFORM_ADMIN list total == live ledger size (70k+ reservoir reachable)", async () => {
    const live = await liveCount(`SELECT count(*)::text AS n FROM sys.sys_source_lineage_records`);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/provenance?limit=1",
      headers: { cookie: ch(admin.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(body.total).toBe(live);
    expect(body.total).toBeGreaterThan(0);
    expect(body.items.length).toBe(1); // pagination honored
  });

  it("TENANT_ADMIN sees only own-tenant rows (live-derived)", async () => {
    const live = await liveCount(
      `SELECT count(*)::text AS n FROM sys.sys_source_lineage_records WHERE source_lineage_tenant_id = $1`,
      [rtlTenantId]);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/provenance?limit=1",
      headers: { cookie: ch(federica.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { total: number }).total).toBe(live);
  });

  it("MANAGER has no provenance:read → 403", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/provenance",
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(403);
  });

  it("filters compose: validationStatus + minConfidence match live counts", async () => {
    const live = await liveCount(
      `SELECT count(*)::text AS n FROM sys.sys_source_lineage_records
        WHERE source_lineage_validation_status = 'VALID' AND source_lineage_mapping_confidence >= 0.9`);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/provenance?validationStatus=VALID&minConfidence=0.9&limit=1",
      headers: { cookie: ch(admin.cookies) },
    });
    expect((r.json() as { total: number }).total).toBe(live);
  });

  it("targetTable filter narrows to one table's rows", async () => {
    const top = await pool.query<{ t: string; n: string }>(
      `SELECT source_lineage_target_table_name AS t, count(*)::text AS n
         FROM sys.sys_source_lineage_records GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`);
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/provenance?targetTable=${encodeURIComponent(top.rows[0]!.t)}&limit=5`,
      headers: { cookie: ch(admin.cookies) },
    });
    const body = r.json() as { items: { targetTableName: string }[]; total: number };
    expect(body.total).toBe(Number(top.rows[0]!.n));
    expect(body.items.every((i) => i.targetTableName === top.rows[0]!.t)).toBe(true);
  });

  it("summary: per-table rows are exhaustive and totals are internally coherent", async () => {
    const distinctTables = await liveCount(
      `SELECT count(DISTINCT source_lineage_target_table_name)::text AS n FROM sys.sys_source_lineage_records`);
    const liveTotal = await liveCount(`SELECT count(*)::text AS n FROM sys.sys_source_lineage_records`);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/provenance/summary",
      headers: { cookie: ch(admin.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      byTable: { total: number; valid: number; stale: number; conflicted: number; rejected: number }[];
      totals: { records: number; avgConfidence: number | null };
    };
    expect(body.byTable.length).toBe(distinctTables);
    expect(body.totals.records).toBe(liveTotal);
    expect(body.byTable.reduce((s, t) => s + t.total, 0)).toBe(liveTotal);
    for (const t of body.byTable) {
      expect(t.valid + t.stale + t.conflicted + t.rejected).toBe(t.total);
    }
    if (body.totals.records > 0) {
      expect(body.totals.avgConfidence).not.toBeNull();
      expect(body.totals.avgConfidence!).toBeGreaterThan(0);
      expect(body.totals.avgConfidence!).toBeLessThanOrEqual(1);
    }
  });
});
