/**
 * apps/api/src/db/client.ts
 * Drizzle ORM + pg Pool initialisation. Single shared pool for the API
 * runtime. Graceful shutdown is wired in server.ts (SIGINT/SIGTERM).
 *
 * Pool sizing: 20 (RD-16 — appropriate for shared OCI VM dev/test).
 * Production tuning is post-MVP.
 */

import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
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

export const db = drizzle(pool);

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
