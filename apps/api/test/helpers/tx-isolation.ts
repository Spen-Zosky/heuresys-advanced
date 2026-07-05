/**
 * apps/api/test/helpers/tx-isolation.ts — D-52: file-level transactional isolation.
 *
 * Every test FILE runs inside ONE real transaction on the live VM database and is rolled back
 * at file end, so the suite leaves ZERO residue and files can no longer couple through leftover
 * rows (the old model: per-file afterAll DELETE cleanup, drift-prone — debt class D-23/D-29).
 *
 * How it composes with the app's own pool usage (the reason D-52 needed a design):
 *  - `pool.query(...)` is routed to a single dedicated client holding the file transaction.
 *    Under vitest singleThread semantics queries serialize on that client — same behaviour,
 *    same data visibility (everything the file wrote, still uncommitted).
 *  - `pool.connect()` (used by `withTransaction` and the brownfield loader) returns a facade on
 *    the same client that maps BEGIN → SAVEPOINT, COMMIT → RELEASE SAVEPOINT and ROLLBACK →
 *    ROLLBACK TO SAVEPOINT, so the app's commit/rollback semantics keep working *inside* the
 *    file transaction (savepoint nesting), and `release()` is a no-op.
 *  - Intra-file sequential flows (create → get → update → delete across tests) are preserved:
 *    isolation is per FILE, not per test — nothing a test wrote is undone before the next one.
 *
 * Known, accepted deltas vs. autocommit:
 *  - now()/DEFAULT now() is transaction_timestamp() → constant for the whole file. Files whose
 *    assertions need distinct created_at instants must order by a secondary key (or opt out).
 *  - Sequence values are consumed and not rolled back (ids simply advance) — irrelevant.
 *  - Vitest isolates the module graph per file, so the pool (and this patch) is per-file state;
 *    nothing leaks across files.
 *
 * Statement-level atomicity: in autocommit a failed statement kills only itself; inside one big
 * transaction it would abort the WHOLE file (25P02) — and the suite intentionally exercises DB
 * error paths (FK/unique violations → 404/409). So direct `pool.query` WRITE statements run
 * inside their own savepoint (rolled back on error), restoring autocommit error semantics.
 * Two constraints shaped this:
 *  - WRITES ONLY: the intentional-failure class is INSERT/UPDATE/DELETE (FK/unique violations);
 *    wrapping every SELECT tripled the tunnel round-trips (suite 1112s → 2078s) and pushed heavy
 *    beforeAll hooks past hookTimeout. Reads go straight through.
 *  - MUTEX: concurrent triples (app code uses Promise.all on pool.query) interleave on the ONE
 *    physical client and RELEASE destroys later savepoints ("savepoint … does not exist"), so
 *    write-triples are serialized through a promise chain. Plain reads may still land between a
 *    triple's statements — harmless: ROLLBACK TO only undoes the triple's own write.
 * The `withTransaction` facade path needs none of this: a failure aborts up to the app's own
 * savepoint and the app's ROLLBACK (→ ROLLBACK TO SAVEPOINT) clears the aborted state, exactly
 * like a real transaction. Residual known hole: an intentionally-failing SELECT would still
 * abort the file tx — no such test exists today; extend the write-detector if one appears.
 *
 * Escape hatch: TEST_TX_ISOLATION=0 runs the suite in the legacy autocommit mode.
 */

import type { PoolClient } from "pg";
import { pool } from "../../src/db/client.js";

/* eslint-disable @typescript-eslint/no-explicit-any */

let fileClient: PoolClient | null = null;
let savepointSeq = 0;
const savepointStack: string[] = [];
let origQuery: any = null;
let origConnect: any = null;
let origEnd: any = null;

function firstStatement(args: any[]): string {
  const text = typeof args[0] === "string" ? args[0] : (args[0]?.text as string | undefined);
  return (text ?? "").trim().toUpperCase().replace(/;$/, "");
}

/** Serializer for write-triples (SAVEPOINT / stmt / RELEASE must not interleave). */
let writeChain: Promise<unknown> = Promise.resolve();

/** True iff the statement can mutate rows — the class whose intentional failures the suite
 *  exercises (FK/unique violations). Covers WITH … INSERT/UPDATE/DELETE CTEs too. */
function isWriteStatement(args: any[]): boolean {
  const stmt = firstStatement(args);
  if (/^(INSERT|UPDATE|DELETE|MERGE|TRUNCATE)\b/.test(stmt)) return true;
  if (stmt.startsWith("WITH")) return /\b(INSERT|UPDATE|DELETE|MERGE)\b/.test(stmt);
  return false;
}

/** A PoolClient facade over the file-transaction client: tx verbs become savepoint ops. */
function makeClientFacade(): PoolClient {
  const facade: any = {
    query: (...args: any[]) => {
      const stmt = firstStatement(args);
      if (stmt === "BEGIN") {
        const name = `d52_sp_${++savepointSeq}`;
        savepointStack.push(name);
        return (fileClient as any).query(`SAVEPOINT ${name}`);
      }
      if (stmt === "COMMIT") {
        const name = savepointStack.pop();
        return (fileClient as any).query(name ? `RELEASE SAVEPOINT ${name}` : "SELECT 1");
      }
      if (stmt === "ROLLBACK") {
        const name = savepointStack.pop();
        return (fileClient as any).query(
          name ? `ROLLBACK TO SAVEPOINT ${name}; RELEASE SAVEPOINT ${name}` : "SELECT 1",
        );
      }
      return (fileClient as any).query(...args);
    },
    release: () => {
      /* the underlying client belongs to the file transaction — never released here */
    },
  };
  return facade as PoolClient;
}

/** Open the file transaction and route the app's pool through it. Idempotent per file. */
export async function beginFileTx(): Promise<void> {
  if (fileClient) return;
  fileClient = await pool.connect();
  await fileClient.query("BEGIN");
  origQuery = pool.query;
  origConnect = pool.connect;
  origEnd = pool.end;
  // Direct pool.query: WRITE statements get autocommit-like atomicity via a per-statement
  // savepoint; the triples are serialized (writeChain) so Promise.all writes can't interleave
  // SAVEPOINT/RELEASE pairs on the single client. Reads pass straight through.
  (pool as any).query = (...args: any[]) => {
    if (!isWriteStatement(args)) return (fileClient as any).query(...args);
    const run = async () => {
      const sp = `d52_q_${++savepointSeq}`;
      await (fileClient as any).query(`SAVEPOINT ${sp}`);
      try {
        const res = await (fileClient as any).query(...args);
        await (fileClient as any).query(`RELEASE SAVEPOINT ${sp}`);
        return res;
      } catch (err) {
        await (fileClient as any).query(`ROLLBACK TO SAVEPOINT ${sp}; RELEASE SAVEPOINT ${sp}`);
        throw err;
      }
    };
    const p = writeChain.then(run, run);
    writeChain = p.then(
      () => undefined,
      () => undefined,
    );
    return p;
  };
  (pool as any).connect = async () => makeClientFacade();
  // ~110 files call closePool() in their afterAll (per-file pool, vitest module isolation).
  // pool.end() waits for every client to be released — the file-tx client would deadlock it.
  // So closing the pool FIRST ends the file transaction, then really ends the pool.
  const realEnd = origEnd;
  (pool as any).end = async (...args: any[]) => {
    await endFileTx();
    return realEnd.apply(pool, args);
  };
}

/** Roll the whole file back and restore the real pool. Safe to call once at file end. */
export async function endFileTx(): Promise<void> {
  if (!fileClient) return;
  const client = fileClient;
  fileClient = null;
  savepointStack.length = 0;
  writeChain = Promise.resolve();
  (pool as any).query = origQuery;
  (pool as any).connect = origConnect;
  (pool as any).end = origEnd;
  try {
    await client.query("ROLLBACK");
    client.release();
  } catch (err) {
    // Broken connection state — destroy it instead of returning it to the pool.
    client.release(err as Error);
  }
}
