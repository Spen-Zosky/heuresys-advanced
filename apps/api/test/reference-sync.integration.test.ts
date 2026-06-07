import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool } from "../src/db/client.js";
import type { EscoFetcher, EscoPage, RawEscoResult } from "../src/modules/reference-sync/esco-connector.js";

// Cap⑤ scraping — ESCO reference-sync (/v1/reference-sync/*). Real login + live DB.
// The ESCO fetcher is INJECTED with a fixture (no live HTTP, scraping spec §7). The
// fixture uses SYNTHETIC test URIs only — the real 7645-row ESCO catalog is untouched
// (the synthetic rows are inserted, then deleted in afterAll). PLATFORM_ADMIN-only.

const PWD = "Admin#PassW0rd!";
const TEST_PREFIX = "http://data.europa.eu/esco/occupation/HEURESYS-SYNCTEST-";
const FIXTURE: RawEscoResult[] = [
  { uri: `${TEST_PREFIX}0001`, title: "synctest occupation alpha", code: "9001", className: "Occupation", status: "released" },
  { uri: `${TEST_PREFIX}0002`, title: "synctest occupation beta", code: "9002", className: "Occupation", status: "released" },
  { uri: `${TEST_PREFIX}0003`, title: "synctest occupation gamma", code: "9003", className: "Occupation", status: "released" },
];

class FixtureEscoFetcher implements EscoFetcher {
  constructor(private readonly results: RawEscoResult[]) {}
  async fetchPage(offset: number, limit: number): Promise<EscoPage> {
    if (offset > 0) return { results: [], total: this.results.length };
    return { results: this.results.slice(0, limit), total: this.results.length };
  }
}

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login ${email}: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let suite: TestApp;
let admin: S;       // PLATFORM_ADMIN — reference_sync:read/trigger (explicit, mig 000084)
let tenantAdmin: S; // TENANT_ADMIN — DENIED: reference_sync is strict PLATFORM_ADMIN-only (mig 000085
                    //   + 000005 denylist), because an ESCO refresh mutates GLOBAL reference data.
let manager: S;     // MANAGER — also denied (never in the 000005 catch-all).

beforeAll(async () => {
  suite = await buildTestApp({ referenceSyncDeps: { escoFetcher: new FixtureEscoFetcher(FIXTURE) } });
  admin = await login(suite, "admin@heuresys.com");
  tenantAdmin = await login(suite, "federica.marchetti@rtl-bank.org");
  manager = await login(suite, "paolo.caputo@rtl-bank.org");
});

afterAll(async () => {
  await pool.query("DELETE FROM sys.sys_esco_occupation_mappings WHERE esco_occupation_mapping_esco_uri LIKE $1", [`${TEST_PREFIX}%`]);
  await suite.app.close();
});

async function trigger(s: S) {
  return suite.app.inject({
    method: "POST", url: "/v1/reference-sync/runs",
    headers: { cookie: ch(s.cookies), "x-csrf-token": s.csrfToken, "content-type": "application/json" },
    payload: { source: "ESCO" },
  });
}

describe("reference-sync API (cap⑤ ESCO)", () => {
  it("RBAC: MANAGER lacks reference_sync:read → 403 on sources", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/reference-sync/sources", headers: { cookie: ch(manager.cookies) } });
    expect(r.statusCode).toBe(403);
  });

  it("RBAC: MANAGER cannot trigger a sync → 403", async () => {
    expect((await trigger(manager)).statusCode).toBe(403);
  });

  it("RBAC: TENANT_ADMIN is DENIED (reference_sync strict PLATFORM_ADMIN-only)", async () => {
    // ESCO refresh mutates GLOBAL reference data → PLATFORM_ADMIN-only (mig 000085 + 000005 denylist).
    expect((await suite.app.inject({ method: "GET", url: "/v1/reference-sync/sources", headers: { cookie: ch(tenantAdmin.cookies) } })).statusCode).toBe(403);
    expect((await trigger(tenantAdmin)).statusCode).toBe(403);
  });

  it("CSRF: admin trigger without x-csrf-token → 403 CSRF_FAIL", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/reference-sync/runs",
      headers: { cookie: ch(admin.cookies), "content-type": "application/json" },
      payload: { source: "ESCO" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("CSRF_FAIL");
  });

  it("first sync inserts the fixture occupations (idempotent upsert, never deletes)", async () => {
    const r = await trigger(admin);
    expect(r.statusCode).toBe(200);
    const b = r.json() as { accepted: boolean; source: string; total: number; inserted: number; updated: number; runId: string };
    expect(b.accepted).toBe(true);
    expect(b.source).toBe("ESCO");
    expect(b.total).toBe(3);
    expect(b.inserted).toBe(3);
    expect(b.updated).toBe(0);
    // the rows really landed in the catalog
    const { rows } = await pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM sys.sys_esco_occupation_mappings WHERE esco_occupation_mapping_esco_uri LIKE $1",
      [`${TEST_PREFIX}%`],
    );
    expect(Number(rows[0]!.n)).toBe(3);
  });

  it("re-running the same artifact is a pure update (idempotency: 0 net new)", async () => {
    const r = await trigger(admin);
    expect(r.statusCode).toBe(200);
    const b = r.json() as { total: number; inserted: number; updated: number };
    expect(b.total).toBe(3);
    expect(b.inserted).toBe(0);
    expect(b.updated).toBe(3);
    // still exactly 3 synthetic rows (no duplication)
    const { rows } = await pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM sys.sys_esco_occupation_mappings WHERE esco_occupation_mapping_esco_uri LIKE $1",
      [`${TEST_PREFIX}%`],
    );
    expect(Number(rows[0]!.n)).toBe(3);
  });

  it("run-level lineage: GET /runs lists the ESCO runs, newest first", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/reference-sync/runs", headers: { cookie: ch(admin.cookies) } });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { items: { runId: string; source: string; status: string; total: number }[]; total: number };
    expect(b.items.length).toBeGreaterThanOrEqual(2);
    expect(b.items[0]!.source).toBe("ESCO");
    expect(b.items[0]!.status).toBe("COMPLETED");
    expect(b.items[0]!.total).toBe(3);
    // GET /runs/:id round-trips
    const id = b.items[0]!.runId;
    const one = await suite.app.inject({ method: "GET", url: `/v1/reference-sync/runs/${id}`, headers: { cookie: ch(admin.cookies) } });
    expect(one.statusCode).toBe(200);
    expect((one.json() as { runId: string }).runId).toBe(id);
  });

  it("GET /runs/:id → 404 for an unknown run id", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/reference-sync/runs/00000000-0000-0000-0000-000000000000",
      headers: { cookie: ch(admin.cookies) },
    });
    expect(r.statusCode).toBe(404);
  });

  it("GET /sources lists ESCO with its latest run", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/reference-sync/sources", headers: { cookie: ch(admin.cookies) } });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { items: { key: string; lastRun: { total: number } | null }[] };
    expect(b.items[0]!.key).toBe("ESCO");
    expect(b.items[0]!.lastRun).not.toBeNull();
    expect(b.items[0]!.lastRun!.total).toBe(3);
  });
});
