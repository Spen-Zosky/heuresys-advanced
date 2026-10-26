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
import type { ReferenceSyncSourceKey } from "@heuresys/shared";
import { pool } from "../../db/client.js";
import { referenceSyncService } from "./service.js";
import { EscoUnavailableError } from "./esco-connector.js";

const log = (o: Record<string, unknown>): void => console.log(JSON.stringify({ cli: "reference-sync", ...o }));

/** All registered sources, refreshed in sequence (per-source try/catch: one
 *  failing upstream must not starve the others; any failure → exit 1). */
// ATECO first: while ESCO is unavailable its fetcher waits up to ~6 h in-process.
const SOURCES: ReferenceSyncSourceKey[] = ["ATECO_2025", "ESCO"];

/**
 * An upstream outage (ESCO behind the EC maintenance page, 25/10/2026) is retried here,
 * every 30 minutes for about 5.5 hours, each attempt a whole runSync that takes and
 * releases the source lock. Not a systemd Restart=: on the VM every `daemon-reload`
 * fired the pending restart at once and the day's attempts were gone in ten minutes.
 * The unit's TimeoutStartSec must cover this (heuresys-advanced-scraping.service).
 */
const OUTAGE_RETRY_EVERY_MS = 30 * 60_000;
const OUTAGE_RETRIES = 11;

export async function runReferenceSyncCli(): Promise<void> {
  const failures: string[] = [];
  for (const source of SOURCES) {
    const started = Date.now();
    for (let retry = 0; ; retry++) {
      try {
        // System actor: no human userId → recorded as a NULL initiator in import_runs.
        const result = await referenceSyncService.runSync({ userId: null }, source);
        log({ phase: "done", ...result, retries: retry, ms: Date.now() - started });
        break;
      } catch (err) {
        if (err instanceof EscoUnavailableError && retry < OUTAGE_RETRIES) {
          log({ phase: "unavailable", source, retry: retry + 1, of: OUTAGE_RETRIES, retryInMs: OUTAGE_RETRY_EVERY_MS });
          await new Promise((r) => setTimeout(r, OUTAGE_RETRY_EVERY_MS));
          continue;
        }
        failures.push(source);
        log({ phase: "failed", source, retries: retry, ms: Date.now() - started });
        console.error(`reference-sync ${source} FAILED:`, err);
        break;
      }
    }
  }
  if (failures.length > 0) {
    throw new Error(`reference-sync: ${failures.length}/${SOURCES.length} source(s) failed: ${failures.join(", ")}`);
  }
}

// Run when invoked directly (tsx). Closes the pool so the process exits cleanly.
const invoked = process.argv[1] ?? "";
if (invoked.endsWith("sync-cli.ts") || invoked.endsWith("sync-cli.js")) {
  runReferenceSyncCli()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error("reference-sync CLI FAILED:", err);
      void pool.end().finally(() => process.exit(1));
    });
}
