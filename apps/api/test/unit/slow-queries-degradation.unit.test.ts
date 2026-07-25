/**
 * apps/api/test/unit/slow-queries-degradation.unit.test.ts — D-64 unit layer.
 *
 * `pg_stat_statements` is an OPTIONAL Postgres extension. Three states exist in
 * the wild and the read must survive all three WITHOUT surfacing a 500:
 *   1. not installed at all                       → degraded, probe only
 *   2. installed but not in shared_preload_libraries (55000) → degraded
 *   3. loaded and usable                          → real rows
 * Any OTHER database error must still propagate — degradation must never become
 * a silent swallow of real failures.
 *
 * Unit-level on purpose: the integration suite can only exercise state (3),
 * because the database under test is expected to have the extension loaded.
 * Here the pool is a stub, so the failure modes are reachable deterministically.
 */

import { describe, it, expect } from "vitest";
import type { Pool } from "pg";
import { readSlowQueries } from "../../src/modules/observability/repository.js";

type QueryResult = { rows: unknown[] };

/** Minimal pg-shaped error: node-postgres exposes the SQLSTATE as `code`. */
function pgError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

/** One realistic pg_stat_statements row, as the repository's SQL projects it. */
const SAMPLE_ROW = {
  query: "SELECT * FROM sys.sys_users WHERE user_tenant_id = $1",
  calls: "42",
  mean_ms: 12.5,
  stddev_ms: 3.1,
  max_ms: 90.2,
  total_ms: 525,
  rows_returned: "1200",
  shared_blks_hit: "900",
  shared_blks_read: "12",
};

/**
 * Stub pool. `installed` drives the (unfailable) pg_extension probe; `onRead`
 * decides what the transactional read does; `onMeta` fails only the ancillary
 * `pg_stat_statements_info` lookup; `onRollback` fails the ROLLBACK itself.
 * Records the statements it saw so the transaction discipline is assertable.
 *
 * The two reads return DIFFERENT shapes on purpose — a single shared stub row
 * would let a mapping bug pass unnoticed.
 */
function stubPool(opts: {
  installed: boolean;
  onRead?: () => never;
  onMeta?: () => never;
  onRollback?: () => never;
}): { pool: Pool; statements: string[] } {
  const statements: string[] = [];
  const client = {
    query: (text: string): Promise<QueryResult> => {
      statements.push(text.trim().split(/\s+/)[0]!.toUpperCase());
      if (/^\s*ROLLBACK/i.test(text)) {
        if (opts.onRollback) opts.onRollback();
        return Promise.resolve({ rows: [] });
      }
      if (/^\s*(BEGIN|COMMIT|SAVEPOINT|RELEASE)/i.test(text)) return Promise.resolve({ rows: [] });
      // the meta lookup is the one selecting pg_stat_statements_info
      if (text.includes("pg_stat_statements_info")) {
        if (opts.onMeta) opts.onMeta();
        return Promise.resolve({ rows: [{ n: "7", since: null }] });
      }
      if (opts.onRead) opts.onRead();
      return Promise.resolve({ rows: [SAMPLE_ROW] });
    },
    release: () => {},
  };
  const pool = {
    query: (text: string): Promise<QueryResult> => {
      statements.push("PROBE");
      expect(text).toContain("pg_extension");
      return Promise.resolve({ rows: [{ installed: opts.installed }] });
    },
    connect: () => Promise.resolve(client),
  } as unknown as Pool;
  return { pool, statements };
}

describe("readSlowQueries — optional-extension degradation (unit)", () => {
  it("extension not installed → degraded result, and the view is never touched", async () => {
    const { pool, statements } = stubPool({ installed: false });
    const r = await readSlowQueries(pool, 10, 1);

    expect(r.extensionAvailable).toBe(false);
    expect(r.degradedReason).toBe("NOT_INSTALLED");
    expect(r.rows).toEqual([]);
    expect(r.totalTracked).toBe(0);
    expect(r.statsSince).toBeNull();
    // the probe is the ONLY statement: no connection, no BEGIN, no failing read
    expect(statements).toEqual(["PROBE"]);
  });

  it("installed but not preloaded (55000) → degraded, and the transaction rolls back", async () => {
    const { pool, statements } = stubPool({
      installed: true,
      onRead: () => {
        throw pgError("55000", 'pg_stat_statements must be loaded via "shared_preload_libraries"');
      },
    });
    const r = await readSlowQueries(pool, 10, 1);

    expect(r.extensionAvailable).toBe(false);
    // the reason must survive: the route logs it, otherwise the degradation is mute
    expect(r.degradedReason).toBe("55000");
    expect(r.rows).toEqual([]);
    // rolled back, not committed — under D-52 isolation this is the savepoint
    // rollback that keeps the file transaction usable for the rest of the file
    expect(statements).toContain("ROLLBACK");
    expect(statements).not.toContain("COMMIT");
  });

  it("view missing under a stale extension record (42P01) → degraded", async () => {
    const { pool } = stubPool({
      installed: true,
      onRead: () => {
        throw pgError("42P01", 'relation "pg_stat_statements" does not exist');
      },
    });
    const r = await readSlowQueries(pool, 10, 1);
    expect(r.extensionAvailable).toBe(false);
    expect(r.degradedReason).toBe("42P01");
  });

  it("a failing ROLLBACK must not shadow the error that explains the failure", async () => {
    // Connection lost mid-request: the ROLLBACK cannot land. If its error replaced
    // the original 55000, the caller would classify on the wrong error and answer
    // 500 — precisely the failure this whole degradation path exists to prevent.
    const { pool } = stubPool({
      installed: true,
      onRead: () => {
        throw pgError("55000", 'pg_stat_statements must be loaded via "shared_preload_libraries"');
      },
      onRollback: () => {
        throw new Error("Client has encountered a connection error and is not queryable");
      },
    });
    const r = await readSlowQueries(pool, 10, 1);
    expect(r.extensionAvailable).toBe(false);
    expect(r.degradedReason).toBe("55000");
  });

  it("only the ancillary info lookup fails (pre-1.9 extension) → rows are KEPT, not degraded", async () => {
    // pg_stat_statements_info does not exist before extension v1.9. Degrading the
    // whole endpoint would tell the user "extension not loaded" while it is loaded
    // and serving rows — a false diagnosis plus a lost feature.
    const { pool } = stubPool({
      installed: true,
      onMeta: () => {
        throw pgError("42P01", 'relation "pg_stat_statements_info" does not exist');
      },
    });
    const r = await readSlowQueries(pool, 10, 1);

    expect(r.extensionAvailable).toBe(true);
    expect(r.degradedReason).toBeUndefined();
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.query).toBe(SAMPLE_ROW.query);
    expect(r.totalTracked).toBe(1); // falls back to what we can actually see
    expect(r.statsSince).toBeNull();
  });

  it("any OTHER database error still propagates — degradation is not a catch-all", async () => {
    const { pool } = stubPool({
      installed: true,
      onRead: () => {
        throw pgError("57014", "canceling statement due to statement timeout");
      },
    });
    await expect(readSlowQueries(pool, 10, 1)).rejects.toThrow(/statement timeout/);
  });

  it("an error without a SQLSTATE propagates too (no silent swallow)", async () => {
    const { pool } = stubPool({
      installed: true,
      onRead: () => {
        throw new Error("connection terminated unexpectedly");
      },
    });
    await expect(readSlowQueries(pool, 10, 1)).rejects.toThrow(/connection terminated/);
  });

  it("loaded extension → rows mapped through untouched, and the transaction commits", async () => {
    const { pool, statements } = stubPool({ installed: true });
    const r = await readSlowQueries(pool, 10, 1);

    expect(r.extensionAvailable).toBe(true);
    expect(r.degradedReason).toBeUndefined();
    // the payload itself, not just the flags: a mapping bug must not pass here
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toEqual(SAMPLE_ROW);
    expect(r.totalTracked).toBe(7); // from the info lookup, not from rows.length
    expect(statements).toContain("COMMIT");
    expect(statements).not.toContain("ROLLBACK");
  });
});
