import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import type { EscoFetcher, EscoPage, RawEscoResult } from "../src/modules/reference-sync/esco-connector.js";
import type { AtecoFetcher, RawAtecoRow } from "../src/modules/reference-sync/istat-ateco-connector.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

// Cap⑤ scraping — ESCO reference-sync (/v1/reference-sync/*). Real login + live DB.
// The ESCO fetcher is INJECTED with a fixture (no live HTTP, scraping spec §7). The
// fixture uses SYNTHETIC test URIs only — the real 7645-row ESCO catalog is untouched
// (the synthetic rows are inserted, then deleted in afterAll). PLATFORM_ADMIN-only.

const PWD = TEST_PERSONA_PASSWORD;
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
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let suite: TestApp;
let admin: S;       // PLATFORM_ADMIN — reference_sync:read/trigger (explicit, mig 000084)
let tenantAdmin: S; // TENANT_ADMIN — DENIED: reference_sync is strict PLATFORM_ADMIN-only (mig 000085
                    //   + 000005 denylist), because an ESCO refresh mutates GLOBAL reference data.
let manager: S;     // MANAGER — also denied (never in the 000005 catch-all).

// The test owns the ESCO source lifecycle: synthetic mappings + a reset watermark.
// Resetting the watermark (content_hash/last_succeeded_at → NULL) guarantees the first
// trigger is a genuine INSERT (not a watermark UNCHANGED skip from a prior run).
const RESET_WATERMARK = `
  UPDATE brownfield.source_watermarks
     SET source_watermark_content_hash = NULL, source_watermark_last_succeeded_at = NULL,
         source_watermark_last_fetched_at = NULL, source_watermark_last_import_run_id = NULL,
         source_watermark_status = 'IDLE'
   WHERE source_watermark_source_key = 'ESCO'`;

beforeAll(async () => {
  suite = await buildTestApp({
    referenceSyncDeps: {
      escoFetcher: new FixtureEscoFetcher(FIXTURE),
      // D-37: pin the skill-hierarchy seam + URI source so NO live ESCO HTTP can ever run
      // from this file (it only triggers ESCO/ATECO_2025, never ESCO_SKILL_HIERARCHY) —
      // belt-and-suspenders against future edits. The default HttpEscoSkillFetcher would
      // hit the live EU API; this suite must stay fully offline + deterministic.
      escoSkillFetcher: { fetchSkill: async () => { throw new Error("escoSkillFetcher must not be called in this suite"); } },
      escoSkillUriSource: async () => [],
    },
  });
  admin = await login(suite, "enzo.spenuso@heuresys.com");
  tenantAdmin = await login(suite, "federica.marchetti@rtl-bank.org");
  manager = await login(suite, "paolo.caputo@rtl-bank.org");
  await pool.query("DELETE FROM sys.sys_esco_occupation_mappings WHERE esco_occupation_mapping_esco_uri LIKE $1", [`${TEST_PREFIX}%`]);
  await pool.query(RESET_WATERMARK);
  // D-37: the real cost here is buildTestApp (full Fastify boot + RBAC cache) + 3 live
  // logins + 2 DB writes over the SSH tunnel — under full-suite contention the default
  // 30s hookTimeout is exhausted by DB/login latency (NOT external HTTP). 60s headroom.
}, 60_000);

afterAll(async () => {
  await pool.query("DELETE FROM sys.sys_esco_occupation_mappings WHERE esco_occupation_mapping_esco_uri LIKE $1", [`${TEST_PREFIX}%`]);
  await pool.query(RESET_WATERMARK);
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

  it("first sync inserts the fixture occupations (changed path: watermark was reset → not skipped)", async () => {
    const r = await trigger(admin);
    expect(r.statusCode).toBe(200);
    const b = r.json() as { accepted: boolean; source: string; total: number; inserted: number; updated: number; skipped: boolean; runId: string };
    expect(b.accepted).toBe(true);
    expect(b.source).toBe("ESCO");
    expect(b.total).toBe(3);
    expect(b.inserted).toBe(3);
    expect(b.updated).toBe(0);
    expect(b.skipped).toBe(false); // P2: first ingest after a reset is a real upsert
    // the rows really landed in the catalog
    const { rows } = await pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM sys.sys_esco_occupation_mappings WHERE esco_occupation_mapping_esco_uri LIKE $1",
      [`${TEST_PREFIX}%`],
    );
    expect(Number(rows[0]!.n)).toBe(3);
  });

  it("P2 watermark: re-running the SAME artifact is an UNCHANGED no-op (skipped, 0 upsert)", async () => {
    const r = await trigger(admin);
    expect(r.statusCode).toBe(200);
    const b = r.json() as { total: number; inserted: number; updated: number; skipped: boolean };
    expect(b.skipped).toBe(true);   // content_hash matches the last successful ingest → short-circuit
    expect(b.inserted).toBe(0);
    expect(b.updated).toBe(0);      // catalog upsert was NOT performed
    // still exactly 3 synthetic rows (nothing inserted, nothing deleted)
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

  it("GET /sources lists ESCO with its latest run + delta watermark (P2)", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/reference-sync/sources", headers: { cookie: ch(admin.cookies) } });
    expect(r.statusCode).toBe(200);
    const b = r.json() as {
      items: { key: string; lastRun: { total: number } | null; watermark: { status: string; contentHash: string | null } | null }[];
    };
    expect(b.items[0]!.key).toBe("ESCO");
    expect(b.items[0]!.lastRun).not.toBeNull();
    expect(b.items[0]!.lastRun!.total).toBe(3);
    // P2: the watermark reflects the last ingest (STAGED then UNCHANGED after the re-run)
    expect(b.items[0]!.watermark).not.toBeNull();
    expect(["STAGED", "UNCHANGED"]).toContain(b.items[0]!.watermark!.status);
    expect(b.items[0]!.watermark!.contentHash).not.toBeNull();
  });
});

// ── cap⑤ 2nd source (S983 WS-C): ATECO_2025 via fixture fetcher ─────────────────
// Synthetic codes use the 'ZZ' prefix (real ATECO sections are A..U) so the suite
// never collides with a real ATECO_2025 ingest; rows + watermark reset in afterAll.
const ATECO_TEST_PREFIX = "ZZ";
const ATECO_FIXTURE: RawAtecoRow[] = [
  { ordine: 1, code: "ZZ", titleIt: "synctest sezione", titleEn: "synctest section", titleDe: null, level: 1, parentCode: null },
  { ordine: 2, code: "ZZ.1", titleIt: "synctest divisione", titleEn: null, titleDe: null, level: 2, parentCode: "ZZ" },
  { ordine: 3, code: "ZZ.1.1", titleIt: "synctest classe", titleEn: null, titleDe: null, level: 3, parentCode: "ZZ.1" },
];

class FixtureAtecoFetcher implements AtecoFetcher {
  constructor(private readonly rows: RawAtecoRow[]) {}
  async fetchAll(): Promise<RawAtecoRow[]> {
    return this.rows;
  }
}

const RESET_ATECO_WATERMARK = RESET_WATERMARK.replace("'ESCO'", "'ATECO_2025'");
const DELETE_ATECO_ROWS = `
  DELETE FROM sys.sys_activity_classifications
   WHERE activity_classification_scheme = 'ATECO_2025'
     AND activity_classification_code LIKE '${ATECO_TEST_PREFIX}%'`;

describe("reference-sync API (cap⑤ ATECO_2025, 2nd source)", () => {
  let atecoSuite: TestApp;
  let atecoAdmin: S;

  beforeAll(async () => {
    atecoSuite = await buildTestApp({
      referenceSyncDeps: { atecoFetcher: new FixtureAtecoFetcher(ATECO_FIXTURE) },
    });
    atecoAdmin = await login(atecoSuite, "enzo.spenuso@heuresys.com");
    await pool.query(DELETE_ATECO_ROWS);
    await pool.query(RESET_ATECO_WATERMARK);
  }, 60_000); // D-37: per-hook headroom (DB/login latency under full-suite load)

  afterAll(async () => {
    await pool.query(DELETE_ATECO_ROWS);
    await pool.query(RESET_ATECO_WATERMARK);
    await atecoSuite.app.close();
  });

  async function triggerAteco(s: S) {
    return atecoSuite.app.inject({
      method: "POST", url: "/v1/reference-sync/runs",
      headers: { cookie: ch(s.cookies), "x-csrf-token": s.csrfToken, "content-type": "application/json" },
      payload: { source: "ATECO_2025" },
    });
  }

  it("first ATECO sync inserts the fixture rows under scheme ATECO_2025", async () => {
    const r = await triggerAteco(atecoAdmin);
    expect(r.statusCode).toBe(200);
    const b = r.json() as { source: string; total: number; inserted: number; updated: number; skipped: boolean };
    expect(b.source).toBe("ATECO_2025");
    expect(b.total).toBe(3);
    expect(b.inserted).toBe(3);
    expect(b.skipped).toBe(false);
    // rows really landed: scheme/code/parent/level/metadata round-trip
    const { rows } = await pool.query<{ code: string; parent: string | null; lvl: number; meta: Record<string, unknown> }>(
      `SELECT activity_classification_code AS code, activity_classification_parent_code AS parent,
              activity_classification_level AS lvl, activity_classification_metadata AS meta
         FROM sys.sys_activity_classifications
        WHERE activity_classification_scheme = 'ATECO_2025' AND activity_classification_code LIKE $1
        ORDER BY code`,
      [`${ATECO_TEST_PREFIX}%`],
    );
    expect(rows.map((x) => x.code)).toEqual(["ZZ", "ZZ.1", "ZZ.1.1"]);
    expect(rows[1]!.parent).toBe("ZZ");
    expect(rows[2]!.lvl).toBe(3);
    expect(rows[0]!.meta).toMatchObject({ title_en: "synctest section", ordine: 1 });
  });

  it("re-running the SAME ATECO artifact is an UNCHANGED no-op (per-source watermark)", async () => {
    const r = await triggerAteco(atecoAdmin);
    expect(r.statusCode).toBe(200);
    const b = r.json() as { skipped: boolean; inserted: number; updated: number };
    expect(b.skipped).toBe(true);
    expect(b.inserted).toBe(0);
    expect(b.updated).toBe(0);
  });

  it("#73 — the legacy ATECO/NACE schemes stay DEPRECATED (mig 000211): zero rows", async () => {
    // The legacy schemes were archived to audit.* and deleted in S1028 (Rev-2
    // hybrid, zero business references). The ATECO_2025 ingest must never
    // resurrect them.
    const { rows } = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n
         FROM sys.sys_activity_classifications
        WHERE activity_classification_scheme IN ('ATECO', 'NACE')`,
    );
    expect(rows[0]!.n).toBe("0");
  });

  it("GET /sources now lists BOTH sources (ESCO + ATECO_2025) with per-source watermark", async () => {
    const r = await atecoSuite.app.inject({
      method: "GET", url: "/v1/reference-sync/sources", headers: { cookie: ch(atecoAdmin.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { items: { key: string; watermark: { status: string } | null }[]; total: number };
    // T1.1 added a third source (ESCO_SKILL_HIERARCHY); the display order is the
    // SOURCE_DEFS key order. This suite exercises ESCO + ATECO_2025 only.
    expect(b.total).toBe(3);
    expect(b.items.map((x) => x.key)).toEqual(["ESCO", "ATECO_2025", "ESCO_SKILL_HIERARCHY"]);
    const ateco = b.items.find((x) => x.key === "ATECO_2025")!;
    expect(ateco.watermark).not.toBeNull();
    expect(["STAGED", "UNCHANGED"]).toContain(ateco.watermark!.status);
  });
});

// ── P2 FAILED path + in-flight lock (a separate app injected with a throwing fetcher) ──
class FailingEscoFetcher implements EscoFetcher {
  async fetchPage(): Promise<EscoPage> {
    throw new Error("synthetic ESCO fetch failure");
  }
}

describe("reference-sync API (cap⑤ ESCO) — P2 FAILED path (HWM not advanced)", () => {
  const PRIOR_HASH = "a".repeat(64); // a valid 64-char sha256-shaped hex content hash
  let failSuite: TestApp;
  let failAdmin: S;

  beforeAll(async () => {
    failSuite = await buildTestApp({ referenceSyncDeps: { escoFetcher: new FailingEscoFetcher() } });
    failAdmin = await login(failSuite, "enzo.spenuso@heuresys.com");
    // Simulate a prior SUCCESSFUL ingest so we can prove the failure does NOT advance the HWM.
    await pool.query(
      `UPDATE brownfield.source_watermarks
          SET source_watermark_status = 'STAGED', source_watermark_content_hash = $1,
              source_watermark_last_succeeded_at = now() - interval '1 day',
              source_watermark_last_fetched_at = now() - interval '1 day'
        WHERE source_watermark_source_key = 'ESCO'`,
      [PRIOR_HASH],
    );
  }, 60_000); // D-37: per-hook headroom (DB/login latency under full-suite load)

  afterAll(async () => {
    await pool.query(RESET_WATERMARK);
    await failSuite.app.close();
  });

  it("a failing fetch → FAILED watermark; content_hash + last_succeeded preserved; no partial stage", async () => {
    const wmBefore = await pool.query<{ succ: Date | null }>(
      `SELECT source_watermark_last_succeeded_at AS succ FROM brownfield.source_watermarks WHERE source_watermark_source_key = 'ESCO'`,
    );
    const countBefore = await pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM sys.sys_esco_occupation_mappings WHERE esco_occupation_mapping_job_role_id IS NULL",
    );

    const r = await failSuite.app.inject({
      method: "POST", url: "/v1/reference-sync/runs",
      headers: { cookie: ch(failAdmin.cookies), "x-csrf-token": failAdmin.csrfToken, "content-type": "application/json" },
      payload: { source: "ESCO" },
    });
    expect(r.statusCode).toBe(500); // the synthetic fetch error surfaces as a 500

    const wmAfter = await pool.query<{ status: string; hash: string | null; succ: Date | null }>(
      `SELECT source_watermark_status AS status, source_watermark_content_hash AS hash, source_watermark_last_succeeded_at AS succ
         FROM brownfield.source_watermarks WHERE source_watermark_source_key = 'ESCO'`,
    );
    expect(wmAfter.rows[0]!.status).toBe("FAILED");                 // lock released as FAILED
    expect(wmAfter.rows[0]!.hash).toBe(PRIOR_HASH);                 // content_hash NOT advanced
    expect(wmAfter.rows[0]!.succ?.toISOString()).toBe(wmBefore.rows[0]!.succ?.toISOString()); // last_succeeded NOT advanced
    // no partial stage — the catalog row count is unchanged
    const countAfter = await pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM sys.sys_esco_occupation_mappings WHERE esco_occupation_mapping_job_role_id IS NULL",
    );
    expect(countAfter.rows[0]!.n).toBe(countBefore.rows[0]!.n);
  });
});
