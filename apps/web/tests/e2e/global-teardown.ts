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

  // #45 C3: blueprint-activation.spec.ts propone un'attivazione per corsa. Resta come
  // fatto registrato — corretto nel prodotto, ma qui va rimossa perché altrimenti cresce
  // di una per corsa. Si cancellano SOLO quelle senza note, create dal test: le
  // attivazioni reali portano metadati.
  try {
    const out = execFileSync(
      "psql",
      [
        "-h", host, "-p", port, "-U", user, "-d", db,
        "-v", "ON_ERROR_STOP=1", "-tAc",
        "WITH d AS (DELETE FROM sys.sys_blueprint_activations WHERE blueprint_activation_status = 'PROPOSED' AND blueprint_activation_metadata = '{}'::jsonb RETURNING 1) SELECT count(*) FROM d",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    )
      .toString()
      .trim();
    console.log(`[e2e teardown] C3: deleted ${out} E2E blueprint activation(s)`);
  } catch (err) {
    console.warn("[e2e teardown] C3 activation cleanup skipped:", (err as Error).message);
  }

  // #131 T6: tenant-blueprints.spec.ts apre un fascicolo per corsa, con un codice
  // che porta il timestamp. Senza questa pulizia la produzione accumulerebbe un
  // fascicolo a ogni giro (misurati 4 residui alla prima esecuzione). Il filtro
  // sul prefisso non puo' toccare `RTL-BANK-CONFIG`, che e' il fascicolo vero.
  // Le versioni e le decisioni scendono in cascata; le fotografie no (ON DELETE
  // RESTRICT, sono immutabili per disegno), quindi un fascicolo gia' firmato
  // resterebbe — ed e' giusto che si noti invece di sparire in silenzio.
  try {
    const out = execFileSync(
      "psql",
      [
        "-h", host, "-p", port, "-U", user, "-d", db,
        "-v", "ON_ERROR_STOP=1", "-tAc",
        "WITH d AS (DELETE FROM sys.sys_tenant_blueprints WHERE tenant_blueprint_code LIKE 'E2E-FASCICOLO-%' RETURNING 1) SELECT count(*) FROM d",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    )
      .toString()
      .trim();
    console.log(`[e2e teardown] T6: deleted ${out} E2E tenant-blueprint(s)`);
  } catch (err) {
    console.warn("[e2e teardown] T6 dossier cleanup skipped:", (err as Error).message);
  }

  // #45 C3: tenants-editing.spec.ts crea un'azienda cliente per corsa e la archivia.
  // L'archiviazione dal prodotto è volutamente soft (stato ARCHIVED), quindi la riga
  // resterebbe: qui si rimuove davvero. Il filtro sul prefisso non può toccare le due
  // aziende reali, che non hanno un codice E2E_TENANT_.
  try {
    const out = execFileSync(
      "psql",
      [
        "-h", host, "-p", port, "-U", user, "-d", db,
        "-v", "ON_ERROR_STOP=1", "-tAc",
        "WITH d AS (DELETE FROM sys.sys_tenancies WHERE tenant_code LIKE 'E2E_TENANT_%' RETURNING 1) SELECT count(*) FROM d",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    )
      .toString()
      .trim();
    console.log(`[e2e teardown] C3: deleted ${out} E2E tenant row(s)`);
  } catch (err) {
    console.warn("[e2e teardown] C3 tenant cleanup skipped:", (err as Error).message);
  }

  // #38 B6: inbox-realtime.spec.ts fa inviare una notifica reale per corsa (POST
  // /v1/notifications) per provare che arrivi senza ricaricare la pagina. Non esiste una
  // cancellazione lato prodotto — la posta in arrivo si legge e si archivia, non si elimina —
  // quindi senza questa pulizia le righe si accumulano di una per corsa.
  try {
    const out = execFileSync(
      "psql",
      [
        "-h", host, "-p", port, "-U", user, "-d", db,
        "-v", "ON_ERROR_STOP=1", "-tAc",
        "WITH d AS (DELETE FROM sys.sys_inbox_notifications WHERE notification_subject LIKE 'E2E SSE %' RETURNING 1) SELECT count(*) FROM d",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    )
      .toString()
      .trim();
    console.log(`[e2e teardown] B6: deleted ${out} E2E inbox notification(s)`);
  } catch (err) {
    console.warn("[e2e teardown] B6 inbox cleanup skipped:", (err as Error).message);
  }

  // #44 C1: organization-editing.spec.ts crea un'unità per corsa e la
  // DISATTIVA (l'API espone solo la cancellazione logica). Senza questa
  // spazzata le unità spente si accumulerebbero nell'organigramma reale.
  // Best-effort, stesse regole di igiene dei segreti.
  try {
    const out = execFileSync(
      "psql",
      [
        "-h", host, "-p", port, "-U", user, "-d", db,
        "-v", "ON_ERROR_STOP=1", "-tAc",
        "WITH d AS (DELETE FROM sys.sys_organization_units WHERE organization_unit_code LIKE 'E2E-OU-%' RETURNING 1) SELECT count(*) FROM d",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    )
      .toString()
      .trim();
    console.log(`[e2e teardown] C1: deleted ${out} E2E org-unit row(s)`);
  } catch (err) {
    console.warn("[e2e teardown] C1 org-unit cleanup skipped:", (err as Error).message);
  }

  // #43 C2: job-catalog.spec.ts crea una famiglia professionale e un ruolo che
  // vi appartiene. Ordine OBBLIGATO: prima i ruoli, poi le famiglie — una
  // famiglia referenziata da un ruolo non si cancella. I ruoli non hanno una
  // DELETE sull'API, quindi la pulizia vive per forza qui.
  // Best-effort, stesse regole di igiene dei segreti.
  try {
    const out = execFileSync(
      "psql",
      [
        "-h", host, "-p", port, "-U", user, "-d", db,
        "-v", "ON_ERROR_STOP=1", "-tAc",
        "WITH r AS (DELETE FROM sys.sys_job_roles WHERE job_role_code LIKE 'E2E-JOBROLE-%' RETURNING 1), " +
          "f AS (DELETE FROM sys.sys_job_families WHERE job_family_code LIKE 'E2E-JOBFAM-%' RETURNING 1) " +
          "SELECT (SELECT count(*) FROM r) || '/' || (SELECT count(*) FROM f)",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    )
      .toString()
      .trim();
    console.log(`[e2e teardown] C2: deleted ${out} E2E job role/family row(s)`);
  } catch (err) {
    console.warn("[e2e teardown] C2 job-catalog cleanup skipped:", (err as Error).message);
  }

  // #43 C2: skills-editing.spec.ts crea una competenza per corsa. Le
  // competenze non hanno una DELETE sull'API, quindi la pulizia vive qui.
  // Best-effort, stesse regole di igiene dei segreti.
  try {
    const out = execFileSync(
      "psql",
      [
        "-h", host, "-p", port, "-U", user, "-d", db,
        "-v", "ON_ERROR_STOP=1", "-tAc",
        "WITH d AS (DELETE FROM sys.sys_skills WHERE skill_code LIKE 'E2E-SKILL-%' RETURNING 1) SELECT count(*) FROM d",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    )
      .toString()
      .trim();
    console.log(`[e2e teardown] C2-skills: deleted ${out} E2E skill row(s)`);
  } catch (err) {
    console.warn("[e2e teardown] C2 skill cleanup skipped:", (err as Error).message);
  }

  // #43 C2: learning-paths.spec.ts e learning-editing.spec.ts creano moduli e
  // percorsi. Ordine OBBLIGATO: passi -> percorsi -> moduli (un passo
  // referenzia entrambi). Serve qui perche' una corsa interrotta a meta' non
  // arriva al proprio smontaggio.
  // Best-effort, stesse regole di igiene dei segreti.
  try {
    const out = execFileSync(
      "psql",
      [
        "-h", host, "-p", port, "-U", user, "-d", db,
        "-v", "ON_ERROR_STOP=1", "-tAc",
        "WITH s AS (DELETE FROM sys.sys_learning_path_steps WHERE learning_path_step_path_id IN " +
          "(SELECT learning_path_id FROM sys.sys_learning_paths WHERE learning_path_code LIKE 'E2E-%') " +
          "OR learning_path_step_module_id IN " +
          "(SELECT learning_module_id FROM sys.sys_learning_modules WHERE learning_module_code LIKE 'E2E-%')), " +
          "p AS (DELETE FROM sys.sys_learning_paths WHERE learning_path_code LIKE 'E2E-%' RETURNING 1), " +
          "m AS (DELETE FROM sys.sys_learning_modules WHERE learning_module_code LIKE 'E2E-%' RETURNING 1) " +
          "SELECT (SELECT count(*) FROM p) || '/' || (SELECT count(*) FROM m)",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    )
      .toString()
      .trim();
    console.log(`[e2e teardown] C2-learning: deleted ${out} E2E path/module row(s)`);
  } catch (err) {
    console.warn("[e2e teardown] C2 learning cleanup skipped:", (err as Error).message);
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
