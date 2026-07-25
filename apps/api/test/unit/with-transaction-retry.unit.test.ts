/**
 * apps/api/test/unit/with-transaction-retry.unit.test.ts — D-64 unit layer + D-55.
 *
 * `withTransaction` must re-run a transaction that Postgres aborted through no fault
 * of its own (deadlock / serialization failure) and must NOT re-run anything else.
 * This is the fix for D-55: an intermittent `500 INTERNAL_ERROR` on the MFA login
 * second step that aborted whole test files, whose real cause (`deadlock detected`,
 * two backends in a lock cycle) only surfaced in a full-run log in S1029.
 *
 * Unit-level because the failure mode is a race: reproducing a real deadlock on
 * demand is not something an integration test can do reliably, but the retry
 * CONTRACT is fully specifiable here.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/** pg-shaped error: node-postgres exposes the SQLSTATE as `code`. */
function pgError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

/** Statements seen by the stub client, so the BEGIN/ROLLBACK discipline is assertable. */
let statements: string[] = [];
let connectCount = 0;

const client = {
  query: (text: string) => {
    statements.push(String(text).trim().split(/\s+/)[0]!.toUpperCase());
    return Promise.resolve({ rows: [] });
  },
  release: () => {},
};

// src/db/client.ts does `import pg from "pg"` + `new pg.Pool(...)`, so the DEFAULT
// export is what has to be replaced — a named-only mock leaves the real driver in
// place and the module tries to open a socket at import time.
class FakePool {
  connect() {
    connectCount++;
    return Promise.resolve(client);
  }
  query() {
    return Promise.resolve({ rows: [] });
  }
  end() {
    return Promise.resolve();
  }
  on() {
    return this;
  }
}

vi.mock("pg", () => ({
  default: { Pool: FakePool },
  Pool: FakePool,
}));

const { withTransaction } = await import("../../src/db/client.js");

beforeEach(() => {
  statements = [];
  connectCount = 0;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/**
 * Advances the fake clock so the inter-attempt backoff resolves.
 *
 * The no-op `catch` is attached BEFORE the clock moves: without it, a promise that
 * rejects while we are still advancing timers is momentarily unobserved and the
 * runner reports it as an unhandled rejection — failing the run even though every
 * assertion passed. Attaching a second handler does not consume the rejection: the
 * original promise is still returned, and the caller's `rejects.toThrow` sees it.
 */
function runWithTimers<T>(p: Promise<T>): Promise<T> {
  p.catch(() => {});
  return (async () => {
    await vi.advanceTimersByTimeAsync(2000);
    return p;
  })();
}

describe("withTransaction — retry on transient transaction failures (unit)", () => {
  it("commits once when the callback succeeds — no retry, no rollback", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const r = await withTransaction(fn);

    expect(r).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(connectCount).toBe(1);
    expect(statements).toEqual(["BEGIN", "COMMIT"]);
  });

  it("deadlock (40P01) → retries and succeeds on the second attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(pgError("40P01", "deadlock detected"))
      .mockResolvedValueOnce("recovered");

    const r = await runWithTimers(withTransaction(fn));

    expect(r).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
    // a FRESH connection per attempt: reusing the aborted one would fail immediately
    expect(connectCount).toBe(2);
    expect(statements).toEqual(["BEGIN", "ROLLBACK", "BEGIN", "COMMIT"]);
  });

  it("serialization failure (40001) is retried too", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(pgError("40001", "could not serialize access"))
      .mockResolvedValueOnce("ok");

    await expect(runWithTimers(withTransaction(fn))).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("a persistent deadlock exhausts the attempts and reports how many were made", async () => {
    const fn = vi.fn().mockRejectedValue(pgError("40P01", "deadlock detected"));

    // default is 2 retries → 3 attempts total
    await expect(runWithTimers(withTransaction(fn))).rejects.toThrow(/after 3 attempts/);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("honours an explicit retry budget", async () => {
    const fn = vi.fn().mockRejectedValue(pgError("40P01", "deadlock detected"));

    await expect(runWithTimers(withTransaction(fn, { retries: 0 }))).rejects.toThrow(
      /deadlock detected/,
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("a NON-transient database error is not retried — a unique violation must surface at once", async () => {
    // Retrying a constraint violation would turn a deterministic 409 into a slow 409,
    // and could hide a genuine bug behind three identical failures.
    const fn = vi.fn().mockRejectedValue(pgError("23505", "duplicate key value"));

    await expect(withTransaction(fn)).rejects.toThrow(/duplicate key/);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(statements).toEqual(["BEGIN", "ROLLBACK"]);
  });

  it("an error without a SQLSTATE is not retried either", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"));

    await expect(withTransaction(fn)).rejects.toThrow("boom");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("a failing ROLLBACK does not shadow the error that drives the retry decision", async () => {
    const failingClient = {
      query: (text: string) => {
        const verb = String(text).trim().split(/\s+/)[0]!.toUpperCase();
        statements.push(verb);
        if (verb === "ROLLBACK") return Promise.reject(new Error("connection terminated"));
        return Promise.resolve({ rows: [] });
      },
      release: () => {},
    };
    const { pool } = await import("../../src/db/client.js");
    const spy = vi.spyOn(pool, "connect").mockResolvedValue(failingClient as never);

    const fn = vi
      .fn()
      .mockRejectedValueOnce(pgError("40P01", "deadlock detected"))
      .mockResolvedValueOnce("ok");

    // The deadlock must still be seen as retryable even though the ROLLBACK blew up.
    await expect(runWithTimers(withTransaction(fn))).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});
