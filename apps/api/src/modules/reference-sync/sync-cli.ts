/**
 * apps/api/src/modules/reference-sync/sync-cli.ts
 * Cap⑤ scraping P2 — CLI-bypass entrypoint for the systemd timer (D-2).
 *
 *   pnpm --filter @heuresys/api reference-sync:run
 *
 * Runs the ESCO reference-data refresh IN-PROCESS against the DB — no HTTP, no
 * auth/CSRF (the scheduler is a clock, not a user). The watermark short-circuits
 * when the upstream catalogue is unchanged (cheap UNCHANGED no-op). System runs are
 * recorded with import_run_initiated_by = NULL (nullable FK). The production serving
 * API never runs this; it is invoked only by `heuresys-advanced-scraping.timer`
 * (or manually by an operator). Mirrors the embeddings:backfill CLI pattern.
 */
import { pool } from "../../db/client.js";
import { referenceSyncService } from "./service.js";

const log = (o: Record<string, unknown>): void => console.log(JSON.stringify({ cli: "reference-sync", ...o }));

export async function runEscoSyncCli(): Promise<void> {
  const started = Date.now();
  // System actor: no human userId → recorded as a NULL initiator in import_runs.
  const result = await referenceSyncService.runEscoSync({ userId: null });
  log({ phase: "done", ...result, ms: Date.now() - started });
}

// Run when invoked directly (tsx). Closes the pool so the process exits cleanly.
const invoked = process.argv[1] ?? "";
if (invoked.endsWith("sync-cli.ts") || invoked.endsWith("sync-cli.js")) {
  runEscoSyncCli()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error("reference-sync CLI FAILED:", err);
      void pool.end().finally(() => process.exit(1));
    });
}
