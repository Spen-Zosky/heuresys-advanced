/**
 * apps/web/tests/e2e/e2e-residue.ts
 *
 * Z-112: assert di drift post-suite. `global-teardown.ts` cancella i residui che
 * gli E2E lasciano sul DB condiviso, ma ogni suo blocco e' best-effort: inghiotte
 * l'errore e logga. Finche' nessuno CONTA le righe dopo la pulizia, una cancellazione
 * che non parte (psql assente, connessione sbagliata, FK, spec interrotta a meta')
 * e' indistinguibile da una che ha funzionato. Misurato il 2026-08-09: 6 documenti
 * `E2E %` fermi in produzione dal 10-11 giugno, su una tabella che il teardown non
 * copriva — due mesi senza che nulla lo segnalasse.
 *
 * Qui vivono tre cose, in un posto solo perche' devono restare allineate:
 *   1. la risoluzione della connessione Postgres (host/porta/db/utente),
 *   2. il MANIFESTO dei marcatori — cosa conta come «residuo E2E»,
 *   3. il conteggio e l'assert che fallisce se il totale e' > 0.
 *
 * La password non e' mai letta ne' loggata: arriva da ~/.pgpass, come nel resto
 * del repo.
 *
 * Eseguibile anche da solo, senza far girare la suite:
 *     cd apps/web && pnpm e2e:residue-check
 * esce 0 se il DB e' pulito, 1 se c'e' residuo (o se non riesce a misurare).
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/** Un marcatore: una tabella piu' il predicato che identifica le righe lasciate dagli E2E. */
export interface ResidueMarker {
  /** Etichetta breve, usata nel log e nel messaggio d'errore. */
  readonly label: string;
  /** Tabella qualificata, come compare nelle DELETE del teardown. */
  readonly table: string;
  /** Predicato SQL, identico a quello della DELETE corrispondente. */
  readonly where: string;
}

/**
 * Il manifesto. Ogni DELETE del teardown DEVE avere qui il suo marcatore — se il
 * controllo fosse piu' stretto della pulizia, esisterebbe un residuo che nessuno
 * conta, che e' il difetto da cui nasce questo file. Il contrario e' ammesso: i
 * marcatori senza DELETE (kpi, tassonomia competenze) sono spec che si ripuliscono
 * da sole via API e lasciano righe solo se la corsa muore a meta'.
 * L'allineamento non e' affidato alla memoria: lo verifica
 * `apps/api/test/e2e-residue-manifest.integration.test.ts`.
 */
export const RESIDUE_MARKERS: readonly ResidueMarker[] = [
  { label: "content documents", table: "sys.sys_content_documents", where: "document_title LIKE 'E2E %'" },
  { label: "certificazioni ESS", table: "sys.sys_user_certifications", where: "user_certification_name LIKE 'E2E Test Cert%'" },
  { label: "richieste di approvazione", table: "sys.sys_approval_requests", where: "approval_request_title LIKE 'E2E Approval%'" },
  { label: "notifiche in posta", table: "sys.sys_inbox_notifications", where: "notification_subject LIKE 'E2E %'" },
  { label: "lead", table: "sys.sys_leads", where: "lead_email LIKE '%@leads-e2e.test'" },
  { label: "attivazioni blueprint", table: "sys.sys_blueprint_activations", where: "blueprint_activation_status = 'PROPOSED' AND blueprint_activation_metadata = '{}'::jsonb" },
  { label: "fascicoli tenant", table: "sys.sys_tenant_blueprints", where: "tenant_blueprint_code LIKE 'E2E-FASCICOLO-%'" },
  { label: "aziende clienti", table: "sys.sys_tenancies", where: "tenant_code LIKE 'E2E_TENANT_%'" },
  { label: "unita' organizzative", table: "sys.sys_organization_units", where: "organization_unit_code LIKE 'E2E-OU-%'" },
  { label: "ruoli professionali", table: "sys.sys_job_roles", where: "job_role_code LIKE 'E2E-JOBROLE-%'" },
  { label: "famiglie professionali", table: "sys.sys_job_families", where: "job_family_code LIKE 'E2E-JOBFAM-%'" },
  { label: "competenze", table: "sys.sys_skills", where: "skill_code LIKE 'E2E-SKILL-%'" },
  { label: "percorsi formativi", table: "sys.sys_learning_paths", where: "learning_path_code LIKE 'E2E-%'" },
  { label: "moduli formativi", table: "sys.sys_learning_modules", where: "learning_module_code LIKE 'E2E-%'" },
  { label: "passi dei percorsi", table: "sys.sys_learning_path_steps", where: "learning_path_step_path_id IN (SELECT learning_path_id FROM sys.sys_learning_paths WHERE learning_path_code LIKE 'E2E-%') OR learning_path_step_module_id IN (SELECT learning_module_id FROM sys.sys_learning_modules WHERE learning_module_code LIKE 'E2E-%')" },
  { label: "risposte ai sondaggi", table: "sys.sys_survey_responses", where: "survey_response_natural_key LIKE 'ESS::%'" },
  { label: "definizioni KPI", table: "sys.sys_kpi_definitions", where: "kpi_definition_code LIKE 'E2E-KPI-%'" },
  { label: "famiglie di competenze", table: "sys.sys_skill_families", where: "skill_family_code LIKE 'E2E-SF-%'" },
  { label: "categorie di competenze", table: "sys.sys_skill_categories", where: "skill_category_code LIKE 'E2E-SC-%'" },
];

/** Legge SOLO le chiavi di connessione non segrete dal .env di radice. */
function readPgEnvFile(): Record<string, string> {
  const envPath = resolve(process.cwd(), "..", "..", ".env");
  const out: Record<string, string> = {};
  if (!existsSync(envPath)) return out;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = /^(POSTGRES_(?:HOST|PORT|DB|USER))=(.*)$/.exec(line.trim());
    if (m) out[m[1]!] = m[2]!;
  }
  return out;
}

/**
 * Precedenza: PG* dell'ambiente -> POSTGRES_* dell'ambiente -> .env di radice -> default.
 *
 * Il passaggio per `process.env.POSTGRES_*` non c'era e non e' un dettaglio: la CI
 * esporta `POSTGRES_DB=heuresys_ci` come variabile d'ambiente e NON scrive un .env
 * in radice (e' gitignored), quindi il teardown ripiegava sui default — porta 5433,
 * database `heuresys_advanced` — che in CI non esistono. Ogni pulizia falliva e
 * l'errore veniva inghiottito: sul runner il teardown era un no-op silenzioso.
 */
export function pgConnection(): { host: string; port: string; db: string; user: string } {
  const f = readPgEnvFile();
  return {
    host: process.env.PGHOST ?? process.env.POSTGRES_HOST ?? f.POSTGRES_HOST ?? "localhost",
    port: process.env.PGPORT ?? process.env.POSTGRES_PORT ?? f.POSTGRES_PORT ?? "5433",
    db: process.env.PGDATABASE ?? process.env.POSTGRES_DB ?? f.POSTGRES_DB ?? "heuresys_advanced",
    user: process.env.PGUSER ?? process.env.POSTGRES_USER ?? f.POSTGRES_USER ?? "heuresys",
  };
}

/** Gli argomenti fissi di psql per questa connessione. */
export function psqlArgs(): string[] {
  const c = pgConnection();
  return ["-h", c.host, "-p", c.port, "-U", c.user, "-d", c.db, "-v", "ON_ERROR_STOP=1", "-tA"];
}

/**
 * La query unica che conta tutti i marcatori in un giro solo.
 *
 * Le etichette NON entrano nell'SQL: restano in JavaScript e si riattaccano per
 * posizione. Non e' un dettaglio di stile — la prima versione le interpolava come
 * letterali e «unita' organizzative» ha rotto la query con il suo apostrofo.
 */
export function residueCountSql(markers: readonly ResidueMarker[] = RESIDUE_MARKERS): string {
  return markers
    .map((m, i) => `SELECT ${i} AS ord, count(*) AS n FROM ${m.table} WHERE ${m.where}`)
    .join(" UNION ALL ")
    .concat(" ORDER BY ord");
}

export interface ResidueRow {
  readonly label: string;
  readonly count: number;
}

/**
 * Conta il residuo. Non inghiotte niente: se non riesce a misurare, solleva.
 * Un controllo che passa quando non ha potuto guardare non e' un controllo.
 */
export function countResidue(markers: readonly ResidueMarker[] = RESIDUE_MARKERS): ResidueRow[] {
  const out = execFileSync("psql", [...psqlArgs(), "-F", "|", "-c", residueCountSql(markers)], {
    stdio: ["ignore", "pipe", "pipe"],
  })
    .toString()
    .trim();
  if (out === "") return [];
  const rows = out.split(/\r?\n/).map((line) => {
    const parts = line.split("|");
    const ord = Number(parts[0] ?? "-1");
    return { label: markers[ord]?.label ?? `marcatore #${ord}`, count: Number(parts[1] ?? "0") };
  });
  if (rows.length !== markers.length) {
    throw new Error(`conteggio residui incompleto: attese ${markers.length} righe, ricevute ${rows.length}`);
  }
  return rows;
}

/**
 * L'assert. Fallisce se resta anche una sola riga, elencando cosa e dove: senza
 * l'elenco chi legge il rosso non sa da dove ripartire.
 */
export function assertNoResidue(markers: readonly ResidueMarker[] = RESIDUE_MARKERS): void {
  const rows = countResidue(markers);
  const dirty = rows.filter((r) => r.count > 0);
  const total = dirty.reduce((s, r) => s + r.count, 0);
  const c = pgConnection();
  if (total === 0) {
    console.log(`[e2e residuo] 0 righe residue su ${rows.length} marcatori (${c.db}@${c.host}:${c.port})`);
    return;
  }
  const detail = dirty.map((r) => `  - ${r.label}: ${r.count}`).join("\n");
  throw new Error(
    `drift E2E: ${total} riga/righe residue su ${c.db}@${c.host}:${c.port} dopo la pulizia\n${detail}\n` +
      "La suite ha lasciato dati sul DB condiviso. Cancellali, poi aggiungi la pulizia " +
      "mancante in tests/e2e/global-teardown.ts (e il marcatore in tests/e2e/e2e-residue.ts).",
  );
}
