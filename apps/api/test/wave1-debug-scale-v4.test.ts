/**
 * apps/api/test/wave1-debug-scale-v4.test.ts
 *
 * Goal 001a v4 §2.6 acceptance integration test. Env-gated by
 * BROWNFIELD_RUN_DEBUG_V4=1 to avoid the ~5min wall-clock cost in default
 * `pnpm test` runs. The gated test triggers a debug-cap=20 wave end-to-end
 * and asserts the audit-machinery + lineage criteria.
 *
 * Verifies acceptance criteria from PLAN v4 §2.6:
 *   #4 — debug-scale 20-cap run completes with state=COMPLETE
 *   #5 — audit.import_run_logs ≥ 5 entries for this run
 *   #6 — sys.sys_source_lineage_records has new rows with non-NULL run_id
 *   #7 — audit.import_validation_results contains ≥ 1 SKIPPED_UNSUPPORTED_TRANSFORM_V1
 *  #10 — FK integrity of source_lineage_import_run_id → import_runs preserved
 *
 * Does NOT clean up the brownfield.import_runs row during the test; assertions
 * happen BEFORE cleanup. Cleanup in afterAll deletes only the test's run (which
 * CASCADE-deletes its audit.* entries via FK).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";

interface S {
  cookies: Map<string, string>;
  csrfToken: string;
  userId: string;
}

function ch(c: Map<string, string>): string {
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
  const body = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: body.csrfToken, userId: body.user.userId };
}

const RUN_DEBUG_V4 = process.env.BROWNFIELD_RUN_DEBUG_V4 === "1";

describe("/v1/brownfield/wave-executor — Goal 001a v4 debug-scale assertions", () => {
  let suite: TestApp;
  let platformS: S;
  let runId: string | null = null;

  beforeAll(async () => {
    if (!RUN_DEBUG_V4) return;
    if (!process.env.WAVE1_DEBUG_LIMIT) process.env.WAVE1_DEBUG_LIMIT = "20";
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
  });

  afterAll(async () => {
    if (!RUN_DEBUG_V4) return;
    if (runId) {
      try {
        // FK ON DELETE CASCADE on audit.import_run_logs → cleans up logs automatically.
        // audit.import_validation_results and import_approval_decisions: explicit delete
        // (no CASCADE — those are owned by the run lifecycle).
        await pool.query(
          `DELETE FROM audit.import_validation_results WHERE import_validation_result_run_id = $1`,
          [runId],
        );
        await pool.query(
          `DELETE FROM audit.import_approval_decisions WHERE import_approval_decision_run_id = $1`,
          [runId],
        );
        await pool.query(`DELETE FROM brownfield.import_runs WHERE import_run_id = $1`, [runId]);
      } catch {
        /* ignore */
      }
    }
    if (suite) await suite.app.close();
    await closePool();
  });

  it.skipIf(!RUN_DEBUG_V4)(
    "runs a debug-cap=20 wave and verifies §2.6 acceptance criteria 4/5/6/7/10",
    { timeout: 1_800_000 },
    async () => {
      // Trigger the wave (POST returns 201 + final state after synchronous orchestration)
      const r = await suite.app.inject({
        method: "POST",
        url: "/v1/brownfield/wave-executor/runs",
        headers: {
          cookie: ch(platformS.cookies),
          "x-csrf-token": platformS.csrfToken,
          "content-type": "application/json",
        },
        payload: { wave: 1, mode: "EXECUTE" },
      });
      expect(r.statusCode).toBe(201);
      const body = r.json() as {
        runId: string;
        state: string;
        totalStaged: number;
        totalUpserted: number;
      };
      runId = body.runId;

      // §2.6 criterion #4 — state = COMPLETE
      expect(body.state).toBe("COMPLETE");
      expect(body.totalStaged).toBeGreaterThan(0);
      expect(body.totalUpserted).toBeGreaterThanOrEqual(0);

      // §2.6 criterion #5 — audit.import_run_logs ≥ 5
      const logsRes = await pool.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM audit.import_run_logs WHERE import_run_log_run_id = $1`,
        [runId],
      );
      const logsCount = Number(logsRes.rows[0]!.n);
      expect(logsCount, "audit.import_run_logs entries").toBeGreaterThanOrEqual(5);

      // Also inspect log message sequence for state-machine completeness
      const logSeq = await pool.query<{ message: string; level: string }>(
        `SELECT import_run_log_message AS message, import_run_log_level AS level
           FROM audit.import_run_logs
          WHERE import_run_log_run_id = $1
          ORDER BY created_at`,
        [runId],
      );
      const messages = logSeq.rows.map((r) => r.message);
      expect(messages).toContain("RUN_CREATED");
      expect(messages).toContain("STATE_STAGING");
      expect(messages).toContain("STATE_VALIDATING");
      expect(messages).toContain("STATE_UPSERTING");
      expect(messages).toContain("STATE_COMPLETE");

      // §2.6 criterion #7 — ≥ 1 SKIPPED_UNSUPPORTED_TRANSFORM_V1 entry
      // (live mappings include JSON_EXTRACT and LINEAGE_SOURCE_NK — definitely ≥ 1 expected)
      const skipRes = await pool.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM audit.import_validation_results
          WHERE import_validation_result_run_id = $1
            AND import_validation_result_rule_code = 'SKIPPED_UNSUPPORTED_TRANSFORM_V1'`,
        [runId],
      );
      const skipCount = Number(skipRes.rows[0]!.n);
      expect(skipCount, "SKIPPED_UNSUPPORTED_TRANSFORM_V1 entries").toBeGreaterThanOrEqual(1);

      // §2.6 criterion #6 — lineage rows with non-NULL source_lineage_import_run_id > 0
      const lineageRes = await pool.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM sys.sys_source_lineage_records WHERE source_lineage_import_run_id = $1`,
        [runId],
      );
      const lineageCount = Number(lineageRes.rows[0]!.n);
      expect(lineageCount, "lineage rows with non-NULL run_id").toBeGreaterThan(0);

      // §2.6 criterion #10 — FK integrity preserved (no lineage orphans introduced)
      const orphanRes = await pool.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM sys.sys_source_lineage_records l
          WHERE l.source_lineage_import_run_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM brownfield.import_runs r WHERE r.import_run_id = l.source_lineage_import_run_id)`,
      );
      expect(Number(orphanRes.rows[0]!.n), "lineage orphans").toBe(0);

      // Acceptance check endpoint sanity
      const acc = await suite.app.inject({
        method: "GET",
        url: `/v1/brownfield/wave-executor/runs/${runId}/acceptance`,
        headers: { cookie: ch(platformS.cookies) },
      });
      expect(acc.statusCode).toBe(200);
      const accBody = acc.json() as {
        allPass: boolean;
        checks: Array<{ name: string; pass: boolean }>;
      };
      const failed = accBody.checks.filter((c) => !c.pass).map((c) => c.name);
      expect(failed, `acceptance checks failed: ${failed.join(", ")}`).toEqual([]);
    },
  );
});
