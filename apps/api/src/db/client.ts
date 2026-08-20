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
import type { PoolClient } from "pg";
import { env } from "../config/env.js";

/**
 * #223 F3 (rilievi F5-01, F4-08) — l'API si collega con l'identita' MENO potente
 * che le basta.
 *
 * `POSTGRES_USER` resta il proprietario e il migrator: possiede gli oggetti e
 * applica la catena (`db/scripts/migrate.sh`, `verify_gate`). Se l'API usasse
 * lui, un difetto dell'applicazione — una injection, un endpoint sbagliato —
 * avrebbe in mano i privilegi per cancellare TABELLE, non solo righe.
 *
 * Dove `POSTGRES_APP_USER` e' impostata (produzione), il pool usa quella: legge
 * e scrive le righe, e non ha CREATE su alcuno schema. Dove non c'e' (PC di
 * sviluppo, test, CI) si ricade sul proprietario, cosi' nessun ambiente si rompe
 * per una variabile che non ha.
 *
 * Il fallback e' volutamente silenzioso su un punto e rumoroso su un altro:
 * usare il proprietario NON e' un errore in sviluppo, ma in produzione va visto.
 * Per questo l'identita' scelta finisce nel log di avvio — non la password.
 */
const dbUser = env.POSTGRES_APP_USER ?? env.POSTGRES_USER;
const dbPassword = env.POSTGRES_APP_USER ? (env.POSTGRES_APP_PASSWORD ?? "") : env.POSTGRES_PASSWORD;

if (env.POSTGRES_APP_USER && !env.POSTGRES_APP_PASSWORD) {
  // Meglio fermarsi all'avvio che collegarsi senza password e scoprire il
  // problema alla prima query.
  throw new Error("POSTGRES_APP_USER e' impostata ma POSTGRES_APP_PASSWORD manca");
}

console.info(
  JSON.stringify({
    level: "info",
    phase: "pg-pool",
    msg: "identita di connessione",
    user: dbUser,
    separata: dbUser !== env.POSTGRES_USER,
  }),
);

export const pool = new pg.Pool({
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  database: env.POSTGRES_DB,
  user: dbUser,
  password: dbPassword,
  ssl: env.POSTGRES_SSL === "require" ? { rejectUnauthorized: true } : undefined,
  max: env.POSTGRES_POOL_MAX,
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

/* === Transaction helper ================================================== */

/**
 * SQLSTATEs a transaction can hit through no fault of its own, where the only
 * correct response is to run it again:
 *   40P01 deadlock_detected      — Postgres picked this transaction as the victim
 *                                  of a lock cycle; the other side committed fine.
 *   40001 serialization_failure  — concurrent update under a stricter isolation.
 * Both are rolled back COMPLETELY by the server before the error surfaces, so a
 * retry starts from a clean state — it is not a partial re-application.
 */
const RETRYABLE_TX_CODES = new Set(["40P01", "40001"]);

/** Retries with a little jitter so two victims of the same cycle don't collide again. */
function retryDelayMs(attempt: number): number {
  return 25 * attempt + Math.floor(Math.random() * 25);
}

/**
 * Runs the callback inside a single transaction. Auto-commits on success,
 * rolls back on any thrown error. The callback receives the PoolClient and
 * passes it to the repository functions to ensure all queries share the
 * same transaction.
 *
 * **Deadlock retry (D-55, S1029).** The shared database serves the API, the test
 * suite and the scheduled jobs at the same time, so lock cycles happen: the login
 * MFA second step surfaced them as an intermittent `500 INTERNAL_ERROR` that
 * aborted a whole test file — misdiagnosed for nine sessions as connection jitter,
 * until a full-run log showed `deadlock detected` with the two blocked backends.
 * A deadlock is transient BY CONSTRUCTION (the server aborts one side precisely so
 * the other can proceed), so failing the request is the wrong answer: we re-run the
 * transaction. Retries are logged by the caller only if they exhaust — silence here
 * would hide a database that deadlocks constantly, so the count is surfaced on the
 * error message when it does.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
  opts: { retries?: number } = {},
): Promise<T> {
  const maxAttempts = Math.max(1, (opts.retries ?? 2) + 1);
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      // A failed ROLLBACK (connection already gone) must not replace the error that
      // explains the failure — the retry decision is made on `err`.
      try {
        await client.query("ROLLBACK");
      } catch {
        /* connection unusable; `err` is the diagnostic that matters */
      }
      lastErr = err;
      const code = (err as { code?: unknown } | null)?.code;
      const retryable = typeof code === "string" && RETRYABLE_TX_CODES.has(code);
      if (!retryable || attempt === maxAttempts) {
        if (retryable) {
          // Exhausted: say so, otherwise the caller sees a bare deadlock and cannot
          // tell it was already retried.
          (err as { message?: string }).message =
            `${(err as { message?: string }).message ?? "transaction failed"} (after ${maxAttempts} attempts)`;
        }
        throw err;
      }
      await new Promise((r) => setTimeout(r, retryDelayMs(attempt)));
    } finally {
      client.release();
    }
  }

  /* istanbul ignore next — the loop either returns or throws */
  throw lastErr;
}
