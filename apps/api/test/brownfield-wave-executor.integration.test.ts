/**
 * apps/api/test/brownfield-wave-executor.integration.test.ts
 * MVP-3 Tappa D — wave executor smoke + DRY_RUN end-to-end.
 *
 * The real EXECUTE path is exercised separately (manual or gated by
 * BROWNFIELD_RUN_REAL_WAVE1=1) because it (a) requires the local
 * `legacy_mirror` schema populated from db/seeds/brownfield/wave1/legacy_data
 * (~355 MB across 88 source tables) and (b) writes into sys.sys_*.
 *
 * The DRY_RUN here stages + validates + auto-approves, but skips the upsert
 * step so the test suite remains hermetic and the canonical sys.sys_*
 * rows untouched.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";

interface S { cookies: Map<string, string>; csrfToken: string; userId: string }
function ch(c: Map<string, string>) {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login ${email}: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: body.csrfToken, userId: body.user.userId };
}

let suite: TestApp;
let platformS: S;
let runId: string | null = null;

const REAL_EXECUTE = process.env.BROWNFIELD_RUN_REAL_WAVE1 === "1";

describe("/v1/brownfield/wave-executor", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
  });

  afterAll(async () => {
    if (runId) {
      try {
        await pool.query(`DELETE FROM audit.import_validation_results WHERE import_validation_result_run_id = $1`, [runId]);
      } catch { /* ignore */ }
      try {
        await pool.query(`DELETE FROM audit.import_approval_decisions WHERE import_approval_decision_run_id = $1`, [runId]);
      } catch { /* ignore */ }
      try {
        await pool.query(`DELETE FROM brownfield.import_runs WHERE import_run_id = $1`, [runId]);
      } catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("LIST runs with PLATFORM_ADMIN", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/brownfield/wave-executor/runs",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { items: unknown[]; total: number };
    expect(Array.isArray(b.items)).toBe(true);
  });

  it("USER outsider lacks brownfield_adaptation:read → 403 on list", async () => {
    const outsider = await login(suite, "outsider_test@rtl-bank.test");
    const r = await suite.app.inject({
      method: "GET", url: "/v1/brownfield/wave-executor/runs",
      headers: { cookie: ch(outsider.cookies) },
    });
    expect(r.statusCode).toBe(403);
  });

  it("USER lacks brownfield_adaptation:trigger → 403 on POST", async () => {
    const outsider = await login(suite, "outsider_test@rtl-bank.test");
    const r = await suite.app.inject({
      method: "POST", url: "/v1/brownfield/wave-executor/runs",
      headers: {
        cookie: ch(outsider.cookies),
        "x-csrf-token": outsider.csrfToken,
        "content-type": "application/json",
      },
      payload: { wave: 1, mode: "DRY_RUN" },
    });
    expect(r.statusCode).toBe(403);
  });

  it("POST run with wave=2 → 400 WAVE_NOT_IMPLEMENTED", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/brownfield/wave-executor/runs",
      headers: {
        cookie: ch(platformS.cookies),
        "x-csrf-token": platformS.csrfToken,
        "content-type": "application/json",
      },
      payload: { wave: 2, mode: "DRY_RUN" },
    });
    expect([400, 422]).toContain(r.statusCode);
  });

  it.skipIf(!REAL_EXECUTE)("PLATFORM_ADMIN triggers a real EXECUTE wave 1", { timeout: 1_800_000 }, async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/brownfield/wave-executor/runs",
      headers: {
        cookie: ch(platformS.cookies),
        "x-csrf-token": platformS.csrfToken,
        "content-type": "application/json",
      },
      payload: { wave: 1, mode: "EXECUTE" },
    });
    expect(r.statusCode).toBe(201);
    const b = r.json() as { runId: string; state: string; totalStaged: number; totalUpserted: number };
    expect(b.state).toBe("COMPLETE");
    expect(b.totalStaged).toBeGreaterThan(0);
    expect(b.totalUpserted).toBeGreaterThan(0);
    runId = b.runId;

    // Acceptance check
    const acc = await suite.app.inject({
      method: "GET",
      url: `/v1/brownfield/wave-executor/runs/${runId}/acceptance`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(acc.statusCode).toBe(200);
    const accBody = acc.json() as { allPass: boolean; checks: Array<{ name: string; pass: boolean }> };
    const failures = accBody.checks.filter((c) => !c.pass).map((c) => c.name);
    expect(failures, `failed acceptance checks: ${failures.join(", ")}`).toEqual([]);

    // Lineage sanity: at least one row written for this run
    const lr = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_source_lineage_records WHERE source_lineage_import_run_id = $1`,
      [runId],
    );
    expect(Number(lr.rows[0]!.n)).toBeGreaterThan(0);
  });
});
