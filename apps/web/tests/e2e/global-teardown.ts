/**
 * apps/web/tests/e2e/global-teardown.ts
 *
 * D-29: the ESS certifications spec (ess-certifications-upload.spec.ts) creates
 * one `E2E Test Cert <ts>` row per run — the ESS cert surface is create+list
 * only (no DELETE endpoint) and Playwright has no DB client, so without this the
 * rows accumulate (drift ~1/run). This global teardown deletes them via psql
 * after the suite, using the same Postgres connection the API uses (host/port/db/
 * user read from the repo-root .env; the password comes from ~/.pgpass, never
 * read or logged here — secret hygiene). Best-effort: any failure is logged and
 * swallowed so it never fails the run (the rows are harmless and a11y-neutral
 * since @heuresys/ui@0.1.6 made the table region keyboard-focusable regardless
 * of row count — see D-27).
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/** Read ONLY the non-secret Postgres connection keys from the repo-root .env. */
function readPgEnv(): Record<string, string> {
  const envPath = resolve(process.cwd(), "..", "..", ".env");
  const out: Record<string, string> = {};
  if (!existsSync(envPath)) return out;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = /^(POSTGRES_(?:HOST|PORT|DB|USER))=(.*)$/.exec(line.trim());
    if (m) out[m[1]!] = m[2]!;
  }
  return out;
}

export default async function globalTeardown(): Promise<void> {
  const env = readPgEnv();
  const host = process.env.PGHOST ?? env.POSTGRES_HOST ?? "localhost";
  const port = process.env.PGPORT ?? env.POSTGRES_PORT ?? "5433";
  const db = process.env.PGDATABASE ?? env.POSTGRES_DB ?? "heuresys_advanced";
  const user = process.env.PGUSER ?? env.POSTGRES_USER ?? "heuresys";
  try {
    const out = execFileSync(
      "psql",
      [
        "-h", host, "-p", port, "-U", user, "-d", db,
        "-v", "ON_ERROR_STOP=1", "-tAc",
        "WITH d AS (DELETE FROM sys.sys_user_certifications WHERE user_certification_name LIKE 'E2E Test Cert%' RETURNING 1) SELECT count(*) FROM d",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    )
      .toString()
      .trim();
    console.log(`[e2e teardown] D-29: deleted ${out} E2E cert row(s)`);
  } catch (err) {
    console.warn("[e2e teardown] D-29 cert cleanup skipped:", (err as Error).message);
  }

  // 3.3 slice-D: the approvals E2E creates `E2E Approval <ts>` requests on the RTL
  // test tenant (no DELETE endpoint exposed). Purge them + their emitted inbox
  // tasks (CASCADE drops the steps). Best-effort, same secret-hygiene rules.
  try {
    const out = execFileSync(
      "psql",
      [
        "-h", host, "-p", port, "-U", user, "-d", db,
        "-v", "ON_ERROR_STOP=1", "-tAc",
        "WITH n AS (DELETE FROM sys.sys_inbox_notifications WHERE notification_subject LIKE 'E2E Approval%'), " +
          "d AS (DELETE FROM sys.sys_approval_requests WHERE approval_request_title LIKE 'E2E Approval%' RETURNING 1) SELECT count(*) FROM d",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    )
      .toString()
      .trim();
    console.log(`[e2e teardown] slice-D: deleted ${out} E2E approval request(s)`);
  } catch (err) {
    console.warn("[e2e teardown] approval cleanup skipped:", (err as Error).message);
  }

  // GTM lead-capture: the landing E2E creates a `%@leads-e2e.test` row per run
  // (no DELETE endpoint). Purge them so leads don't accumulate in the DB.
  // Best-effort, same secret-hygiene rules.
  try {
    const out = execFileSync(
      "psql",
      [
        "-h", host, "-p", port, "-U", user, "-d", db,
        "-v", "ON_ERROR_STOP=1", "-tAc",
        "WITH d AS (DELETE FROM sys.sys_leads WHERE lead_email LIKE '%@leads-e2e.test' RETURNING 1) SELECT count(*) FROM d",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    )
      .toString()
      .trim();
    console.log(`[e2e teardown] GTM: deleted ${out} E2E lead row(s)`);
  } catch (err) {
    console.warn("[e2e teardown] GTM lead cleanup skipped:", (err as Error).message);
  }

  // Surveys-M2: the ESS spec answers an assigned survey (tommaso → Q4 Pulse),
  // which inserts ESS responses + flips the assignment to completed. Reset both
  // so the spec is re-runnable (the survey must be pending again next run).
  // Only touches the test persona's ESS-prefixed responses on the RTL tenant.
  try {
    const out = execFileSync(
      "psql",
      [
        "-h", host, "-p", port, "-U", user, "-d", db,
        "-v", "ON_ERROR_STOP=1", "-tAc",
        "WITH tom AS (SELECT user_id FROM sys.sys_users WHERE user_email='tommaso.fiore@rtl-bank.org'), " +
          "r AS (DELETE FROM sys.sys_survey_responses WHERE survey_response_subject_user_id IN (SELECT user_id FROM tom) " +
          "AND survey_response_natural_key LIKE 'ESS::%' RETURNING 1) " +
          "SELECT count(*) FROM r; " +
          "UPDATE sys.sys_survey_assignments SET survey_assignment_completed_at=NULL " +
          "WHERE survey_assignment_user_id IN (SELECT user_id FROM sys.sys_users WHERE user_email='tommaso.fiore@rtl-bank.org');",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    )
      .toString()
      .trim();
    console.log(`[e2e teardown] Surveys-M2: reset ESS survey responses/assignment (${out})`);
  } catch (err) {
    console.warn("[e2e teardown] survey cleanup skipped:", (err as Error).message);
  }
}
