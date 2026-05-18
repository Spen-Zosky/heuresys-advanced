/**
 * apps/api/test/run-logger.test.ts
 *
 * Integration tests for `run-logger.ts`. Hits the live DB through the tunnel.
 *
 * Per PLAN v4 §2.2 item 8: tests that `logRunEvent` writes exactly one row
 * per call with the expected column values + payload shape, across all four
 * conventional levels (DEBUG/INFO/WARN/ERROR) + with/without payload.
 *
 * Uses the stuck DEMO run (`67d51a90-…`) as the FK target — it's a stable
 * existing import_runs row. Logs are inserted then cleaned up in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool, closePool } from "../src/db/client.js";
import { logRunEvent } from "../src/modules/brownfield-wave-executor/run-logger.js";

/**
 * Stable existing run_id (the stuck DEMO run, present since 2026-05-16).
 * Using an existing row avoids needing to satisfy `brownfield.import_runs`'s
 * own FKs for a synthetic test row.
 */
const STUCK_RUN_ID = "67d51a90-7ad9-44e2-860d-0d2e0e945af8";

describe("logRunEvent — audit.import_run_logs writer (integration)", () => {
  const writtenLogIds: string[] = [];

  beforeAll(async () => {
    // Sanity: ensure the FK target row still exists. Test infra failure if not.
    const r = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM brownfield.import_runs WHERE import_run_id = $1`,
      [STUCK_RUN_ID],
    );
    if (Number(r.rows[0]!.n) !== 1) {
      throw new Error(
        `Test FK precondition failed: brownfield.import_runs row ${STUCK_RUN_ID} not present. ` +
          `Goal 001a Path B (Step 5) may have transitioned it already; update STUCK_RUN_ID to a different stable row.`,
      );
    }
  });

  afterAll(async () => {
    if (writtenLogIds.length > 0) {
      await pool.query(
        `DELETE FROM audit.import_run_logs WHERE import_run_log_id = ANY($1::uuid[])`,
        [writtenLogIds],
      );
    }
    await closePool();
  });

  it("writes one INFO row with payload", async () => {
    const before = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM audit.import_run_logs WHERE import_run_log_run_id = $1`,
      [STUCK_RUN_ID],
    );
    const logId = await logRunEvent(pool, {
      runId: STUCK_RUN_ID,
      level: "INFO",
      message: "RUN_LOGGER_TEST_INFO",
      payload: { key: "value", n: 42 },
    });
    writtenLogIds.push(logId);

    expect(logId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    const after = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM audit.import_run_logs WHERE import_run_log_run_id = $1`,
      [STUCK_RUN_ID],
    );
    expect(Number(after.rows[0]!.n) - Number(before.rows[0]!.n)).toBe(1);

    const row = await pool.query<{
      level: string;
      message: string;
      payload: Record<string, unknown>;
    }>(
      `SELECT import_run_log_level  AS level,
              import_run_log_message AS message,
              import_run_log_payload AS payload
         FROM audit.import_run_logs
        WHERE import_run_log_id = $1`,
      [logId],
    );
    expect(row.rows[0]!.level).toBe("INFO");
    expect(row.rows[0]!.message).toBe("RUN_LOGGER_TEST_INFO");
    expect(row.rows[0]!.payload).toMatchObject({ key: "value", n: 42 });
  });

  it("writes one row per call (no batching, no idempotency-by-content)", async () => {
    const id1 = await logRunEvent(pool, {
      runId: STUCK_RUN_ID,
      level: "INFO",
      message: "DUPLICATE_TEST",
      payload: { i: 1 },
    });
    const id2 = await logRunEvent(pool, {
      runId: STUCK_RUN_ID,
      level: "INFO",
      message: "DUPLICATE_TEST",
      payload: { i: 1 },
    });
    writtenLogIds.push(id1, id2);
    expect(id1).not.toBe(id2);

    const r = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM audit.import_run_logs WHERE import_run_log_id = ANY($1::uuid[])`,
      [[id1, id2]],
    );
    expect(Number(r.rows[0]!.n)).toBe(2);
  });

  it("accepts each conventional level: DEBUG / INFO / WARN / ERROR", async () => {
    const levels: Array<"DEBUG" | "INFO" | "WARN" | "ERROR"> = ["DEBUG", "INFO", "WARN", "ERROR"];
    for (const level of levels) {
      const logId = await logRunEvent(pool, {
        runId: STUCK_RUN_ID,
        level,
        message: `LEVEL_TEST_${level}`,
      });
      writtenLogIds.push(logId);
    }
    const r = await pool.query<{ level: string; n: string }>(
      `SELECT import_run_log_level AS level, count(*)::text AS n
         FROM audit.import_run_logs
        WHERE import_run_log_id = ANY($1::uuid[])
        GROUP BY import_run_log_level
        ORDER BY 1`,
      [writtenLogIds.slice(-4)],
    );
    expect(r.rows.map((row) => row.level)).toEqual(["DEBUG", "ERROR", "INFO", "WARN"]);
    expect(r.rows.every((row) => Number(row.n) === 1)).toBe(true);
  });

  it("payload defaults to {} when omitted", async () => {
    const logId = await logRunEvent(pool, {
      runId: STUCK_RUN_ID,
      level: "INFO",
      message: "NO_PAYLOAD_TEST",
    });
    writtenLogIds.push(logId);

    const r = await pool.query<{ payload: Record<string, unknown> }>(
      `SELECT import_run_log_payload AS payload FROM audit.import_run_logs WHERE import_run_log_id = $1`,
      [logId],
    );
    expect(r.rows[0]!.payload).toEqual({});
  });

  it("payload accepts nested structured data", async () => {
    const payload = {
      state_transition: { from: "RUNNING", to: "VALIDATING" },
      metrics: { staged: 100, validated: 95, failed: 5 },
      errors: [
        { mapping_id: "abc-123", code: "VAL_NK_MISSING" },
        { mapping_id: "def-456", code: "VAL_CONFIDENCE_LOW" },
      ],
    };
    const logId = await logRunEvent(pool, {
      runId: STUCK_RUN_ID,
      level: "WARN",
      message: "NESTED_PAYLOAD_TEST",
      payload,
    });
    writtenLogIds.push(logId);

    const r = await pool.query<{ payload: typeof payload }>(
      `SELECT import_run_log_payload AS payload FROM audit.import_run_logs WHERE import_run_log_id = $1`,
      [logId],
    );
    expect(r.rows[0]!.payload).toEqual(payload);
  });

  it("FK violation when runId does not reference an existing import_runs row", async () => {
    const bogusId = "00000000-0000-0000-0000-000000000000";
    await expect(
      logRunEvent(pool, { runId: bogusId, level: "INFO", message: "FK_TEST" }),
    ).rejects.toThrow();
  });
});
