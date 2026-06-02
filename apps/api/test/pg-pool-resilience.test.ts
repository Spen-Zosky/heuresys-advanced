/**
 * apps/api/test/pg-pool-resilience.test.ts
 * WS-6 6b (S952 finding R3): the shared pg.Pool MUST have an 'error' listener so
 * an idle-client connection drop (ECONNRESET / server restart / network blip)
 * is logged-and-swallowed rather than escalating to an unhandled 'error' event
 * that crashes the Node process. Pure unit test — imports the singleton pool but
 * never queries the DB (no tunnel/DB required).
 */
import { describe, it, expect, vi } from "vitest";
import { pool } from "../src/db/client.js";

describe("pg.Pool ECONNRESET resilience (WS-6 6b / S952 R3)", () => {
  it("registers at least one 'error' listener (prevents process crash on idle-client drop)", () => {
    expect(pool.listenerCount("error")).toBeGreaterThanOrEqual(1);
  });

  it("logs a structured event and swallows a synthetic idle-client error without throwing", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    // With a listener present, emit('error', ...) must NOT throw (a listener-less
    // EventEmitter 'error' emit throws). It must also produce a structured log.
    expect(() => pool.emit("error", new Error("synthetic ECONNRESET"))).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
    const logged = String(spy.mock.calls[0]?.[0] ?? "");
    expect(logged).toContain("pg-pool");
    expect(logged).toContain("idle-client-error");
    spy.mockRestore();
  });
});
