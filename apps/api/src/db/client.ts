/**
 * apps/api/src/db/client.ts
 * pg Pool initialisation. Single shared pool for the API runtime. Graceful
 * shutdown is wired in server.ts (SIGINT/SIGTERM). Business queries use raw
 * parameterized SQL over `pool` (ADR-0003 superseded — Drizzle ORM was never
 * adopted as a query builder and the dead `db` export was removed, S989/QW-H1).
 *
 * Pool sizing: 20 (RD-16 — appropriate for shared OCI VM dev/test).
 * Production tuning is post-MVP.
 */

import pg from "pg";
import { env } from "../config/env.js";

export const pool = new pg.Pool({
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  database: env.POSTGRES_DB,
  user: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  ssl: env.POSTGRES_SSL === "require" ? { rejectUnauthorized: true } : undefined,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// WS-6 6b (S952 finding R3) — ECONNRESET resilience. pg.Pool emits 'error' on
// an IDLE client whose backend connection drops (server restart, network blip,
// ECONNRESET). With NO listener attached, Node treats it as an unhandled 'error'
// event and CRASHES the process. We attach a listener that logs the event in a
// structured, observable form and otherwise swallows it — pg.Pool transparently
// discards the dead idle client and establishes a fresh one on the next acquire,
// so no manual reconnect logic is needed. Active-query errors still reject their
// own promise as before; this only covers the idle-client channel.
pool.on("error", (err) => {
  console.error(
    JSON.stringify({
      level: "error",
      phase: "pg-pool",
      sub_phase: "idle-client-error",
      msg: "pg.Pool idle client error (connection dropped); pool will reconnect on next acquire",
      error_name: (err as Error).name,
      error_message: (err as Error).message,
    }),
  );
});

/**
 * Lightweight readiness check used by GET /readyz.
 * Returns true if a SELECT 1 round-trips within the connectionTimeoutMillis.
 */
export async function isDatabaseReady(): Promise<boolean> {
  try {
    const result = await pool.query<{ one: number }>("SELECT 1 AS one");
    return result.rows[0]?.one === 1;
  } catch {
    return false;
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
